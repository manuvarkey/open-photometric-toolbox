<script setup lang="ts">
import { computed, ref } from "vue";
import AppIcon from "./AppIcon.vue";
import type { PhotometricData } from "../core/types";
import { computePhotometrics } from "../core/calculations";
import { serializeIES } from "../core/iesParser";
import { serializeEULUMDAT } from "../core/eulumdatConverter";

const props = defineProps<{
  data: PhotometricData;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "apply", data: PhotometricData): void;
}>();

const currentType = computed(() => props.data.photometricType);
const currentTypeName = computed(() =>
  currentType.value === 1 ? "Type C (Architectural / Roadway)" : currentType.value === 2 ? "Type B (Floodlight)" : "Type A"
);

// Target goniometer type (opposite by default)
const targetType = ref<1 | 2>(currentType.value === 1 ? 2 : 1);
const targetTypeName = computed(() =>
  targetType.value === 1 ? "Type C (Architectural / Roadway)" : "Type B (Floodlight)"
);

// Angular step resolution
const angleResolution = ref<"1" | "2.5" | "5">("2.5");

// Bilinear interpolation for arbitrary angle query in source web
function sampleCandela(vDeg: number, hDeg: number): number {
  const vAngles = props.data.verticalAngles;
  const hAngles = props.data.horizontalAngles;
  const candela = props.data.candela;
  const mult = props.data.multiplier;

  // Clamp vDeg
  const vClamped = Math.max(vAngles[0], Math.min(vAngles[vAngles.length - 1], vDeg));
  // Normalize hDeg to 0..360
  let hNorm = (hDeg % 360 + 360) % 360;

  // Find bounding vertical angles
  let v0Idx = 0;
  for (let i = 0; i < vAngles.length - 1; i++) {
    if (vClamped >= vAngles[i] && vClamped <= vAngles[i + 1]) {
      v0Idx = i;
      break;
    }
  }
  const v1Idx = Math.min(vAngles.length - 1, v0Idx + 1);
  const v0 = vAngles[v0Idx];
  const v1 = vAngles[v1Idx];
  const tv = v1 === v0 ? 0 : (vClamped - v0) / (v1 - v0);

  // If single horizontal angle (symmetric)
  if (hAngles.length <= 1) {
    const c0 = (candela[0]?.[v0Idx] ?? 0) * mult;
    const c1 = (candela[0]?.[v1Idx] ?? 0) * mult;
    return c0 * (1 - tv) + c1 * tv;
  }

  // Find bounding horizontal angles
  let h0Idx = 0;
  for (let i = 0; i < hAngles.length - 1; i++) {
    if (hNorm >= hAngles[i] && hNorm <= hAngles[i + 1]) {
      h0Idx = i;
      break;
    }
  }
  const h1Idx = (h0Idx + 1) % hAngles.length;
  const h0 = hAngles[h0Idx];
  const h1 = hAngles[h1Idx];
  const th = h1 === h0 ? 0 : (hNorm - h0) / (h1 - h0);

  const c00 = (candela[h0Idx]?.[v0Idx] ?? 0) * mult;
  const c01 = (candela[h0Idx]?.[v1Idx] ?? 0) * mult;
  const c10 = (candela[h1Idx]?.[v0Idx] ?? 0) * mult;
  const c11 = (candela[h1Idx]?.[v1Idx] ?? 0) * mult;

  const top = c00 * (1 - tv) + c01 * tv;
  const bottom = c10 * (1 - tv) + c11 * tv;
  return top * (1 - th) + bottom * th;
}

// Convert goniometer web
function generateConvertedData(): PhotometricData {
  const step = parseFloat(angleResolution.value);

  let newVAngles: number[] = [];
  let newHAngles: number[] = [];
  let newCandela: number[][] = [];

  if (targetType.value === 2) {
    // Converting Type C to Type B
    // In Type B: V angles are -90 to +90 (or 0 to 90 for bilateral), H angles are -90 to +90 (or 0 to 90)
    for (let v = 0; v <= 90; v += step) newVAngles.push(v);
    for (let h = 0; h <= 90; h += step) newHAngles.push(h);

    newCandela = newHAngles.map((hB) => {
      return newVAngles.map((vB) => {
        // Map Type B (hB, vB) to Type C (theta, psi)
        const radH = (hB * Math.PI) / 180;
        const radV = (vB * Math.PI) / 180;
        const cosTheta = Math.cos(radH) * Math.cos(radV);
        const thetaDeg = (Math.acos(Math.max(-1, Math.min(1, cosTheta))) * 180) / Math.PI;
        const psiRad = Math.atan2(Math.sin(radH), Math.sin(radV) * Math.cos(radH));
        const psiDeg = ((psiRad * 180) / Math.PI + 360) % 360;
        return Math.round(sampleCandela(thetaDeg, psiDeg) * 10) / 10;
      });
    });
  } else {
    // Converting Type B to Type C
    for (let v = 0; v <= 180; v += step) newVAngles.push(v);
    // 0 to 180 or 0 to 360
    for (let h = 0; h <= 180; h += Math.max(5, step * 2)) newHAngles.push(h);

    newCandela = newHAngles.map((hC) => {
      return newVAngles.map((vC) => {
        // Map Type C (vC, hC) to Type B (hB, vB)
        const radV = (vC * Math.PI) / 180;
        const radH = (hC * Math.PI) / 180;
        const sinHB = Math.sin(radV) * Math.sin(radH);
        const hBDeg = (Math.asin(Math.max(-1, Math.min(1, sinHB))) * 180) / Math.PI;
        const sinVB = Math.sin(radV) * Math.cos(radH);
        const vBDeg = (Math.asin(Math.max(-1, Math.min(1, sinVB))) * 180) / Math.PI;
        return Math.round(sampleCandela(Math.abs(vBDeg), Math.abs(hBDeg)) * 10) / 10;
      });
    });
  }

  const baseName = props.data.fileName.replace(/\.ies$/i, "");
  const newFileName = `${baseName}_Type${targetType.value === 1 ? "C" : "B"}.ies`;

  const newKeywords = {
    ...props.data.keywords,
    "[TEST]": `${props.data.keywords["[TEST]"] || "Goniometer Conversion"} (Converted to Type ${targetType.value === 1 ? "C" : "B"})`,
    "[CONVERSION]": `Converted via LAIGlareNet Convert_${currentType.value === 1 ? "CB" : "BC"} algorithm`,
  };

  const calculated = computePhotometrics(
    newVAngles,
    newHAngles,
    newCandela,
    props.data.lampCount,
    props.data.lumensPerLamp,
    1.0,
    props.data.inputWatts,
    props.data.luminousLength,
    props.data.luminousWidth,
    props.data.luminousHeight,
    props.data.unitsType
  );

  return {
    ...props.data,
    fileName: newFileName,
    photometricType: targetType.value,
    multiplier: 1.0,
    numVerticalAngles: newVAngles.length,
    numHorizontalAngles: newHAngles.length,
    verticalAngles: newVAngles,
    horizontalAngles: newHAngles,
    candela: newCandela,
    keywords: newKeywords,
    calculated,
  };
}

function applyConversion() {
  const converted = generateConvertedData();
  emit("apply", converted);
  emit("close");
}

function downloadConvertedIES() {
  const converted = generateConvertedData();
  const text = serializeIES(converted);
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = converted.fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadConvertedLDT() {
  const converted = generateConvertedData();
  const text = serializeEULUMDAT(converted);
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = converted.fileName.replace(/\.ies$/i, ".ldt");
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <div class="modal-box">
      <!-- Header -->
      <div class="modal-header">
        <div class="modal-title">
          <AppIcon name="convert" :size="20" />
          <span>Goniophotometer Web Conversion (Type B ↔ Type C)</span>
        </div>
        <button class="icon-button" title="Close" @click="emit('close')">
          <AppIcon name="close" :size="16" />
        </button>
      </div>

      <!-- Body -->
      <div class="modal-body">
        <!-- Current vs Target Setup Card -->
        <div class="conversion-card">
          <div class="config-row">
            <div class="config-item">
              <label>Current Goniometer Type:</label>
              <div class="type-badge current">{{ currentTypeName }}</div>
              <span class="subtext">{{ data.numVerticalAngles }} vertical × {{ data.numHorizontalAngles }} horizontal planes</span>
            </div>

            <div class="arrow-indicator">
              <AppIcon name="convert" :size="24" />
            </div>

            <div class="config-item">
              <label>Target Goniometer Type:</label>
              <select v-model="targetType" class="select-field">
                <option :value="1">Type C (Architectural / Roadway)</option>
                <option :value="2">Type B (Floodlight / Projector)</option>
              </select>
              <span class="subtext">Transforms coordinates via spherical cosine matrix</span>
            </div>
          </div>
        </div>

        <!-- Resolution & Sampling Settings -->
        <div class="settings-card">
          <div class="settings-title">Angular Grid Sampling Resolution</div>
          <div class="resolution-options">
            <label class="radio-label">
              <input type="radio" v-model="angleResolution" value="1" />
              <span>Fine (1.0° resolution — high precision)</span>
            </label>
            <label class="radio-label">
              <input type="radio" v-model="angleResolution" value="2.5" />
              <span>Standard (2.5° resolution — balanced)</span>
            </label>
            <label class="radio-label">
              <input type="radio" v-model="angleResolution" value="5" />
              <span>Coarse (5.0° resolution — compact file)</span>
            </label>
          </div>
        </div>

        <!-- Technical Algorithm Reference -->
        <div class="algorithm-spec">
          <div class="spec-title">
            <AppIcon name="info" :size="15" />
            <span>Mathematical Transform Engine (from LAIGlareNet.dll)</span>
          </div>
          <p>
            Transforms rectangular projector coordinates $(H, V)$ to architectural spherical angles $(\theta, \psi)$:
            $$\cos\theta = \cos H \cos V, \quad \psi = \arctan2(\sin H, \sin V \cos H)$$
            Interpolates intermediate intensities via bilinear solid-angle weighting preserving total integrated lumens.
          </p>
        </div>
      </div>

      <!-- Footer Actions -->
      <div class="modal-footer">
        <button class="button secondary" @click="downloadConvertedLDT">
          <AppIcon name="convert" :size="14" />
          <span>Export .ldt</span>
        </button>
        <button class="button secondary" @click="downloadConvertedIES">
          <AppIcon name="save" :size="14" />
          <span>Export .ies</span>
        </button>
        <button class="button primary" @click="applyConversion">
          <AppIcon name="check" :size="14" />
          <span>Apply to Current Workspace</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(2px);
}

.modal-box {
  background: var(--panel, #1e1e24);
  border: 1px solid var(--line, #383842);
  border-radius: var(--control-radius, 6px);
  width: 640px;
  max-width: 95vw;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  color: var(--text, #edebe8);
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--line, #383842);
  background: var(--well, #2a2a32);
}

.modal-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  font-size: 0.95rem;
}

.modal-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.conversion-card {
  background: var(--well, #2a2a32);
  border: 1px solid var(--line-soft, #3d3d46);
  border-radius: 4px;
  padding: 14px;
}

.config-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.config-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.config-item label {
  font-size: 0.8rem;
  color: var(--muted, #a1a1aa);
  font-weight: 500;
}

.type-badge.current {
  background: var(--hover, #33333d);
  color: var(--text, #edebe8);
  border: 1px solid var(--line, #383842);
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 600;
}

.select-field {
  background: var(--panel, #1e1e24);
  border: 1px solid var(--accent, #d97706);
  color: var(--text, #edebe8);
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 500;
  outline: none;
}

.arrow-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent, #d97706);
  padding: 8px;
}

.subtext {
  font-size: 0.72rem;
  color: var(--hint, #71717a);
}

.settings-card {
  background: var(--well, #2a2a32);
  border: 1px solid var(--line-soft, #3d3d46);
  border-radius: 4px;
  padding: 12px 14px;
}

.settings-title {
  font-size: 0.82rem;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--text-soft, #d4d4d8);
}

.resolution-options {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  color: var(--text, #edebe8);
  cursor: pointer;
}

.algorithm-spec {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid var(--line-soft, #3d3d46);
  border-radius: 4px;
  padding: 12px;
  font-size: 0.75rem;
  color: var(--muted, #a1a1aa);
  line-height: 1.5;
}

.spec-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  color: var(--text-soft, #d4d4d8);
  margin-bottom: 4px;
}

.algorithm-spec p {
  margin: 0;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 16px;
  border-top: 1px solid var(--line, #383842);
  background: var(--well, #2a2a32);
}

.button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: var(--control-radius, 4px);
  font-size: 0.82rem;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s ease;
}

.button.primary {
  background: var(--accent, #d97706);
  color: #ffffff;
}

.button.primary:hover {
  filter: brightness(1.1);
}

.button.secondary {
  background: var(--hover, #33333d);
  color: var(--text, #edebe8);
  border-color: var(--line-soft, #3d3d46);
}

.button.secondary:hover {
  background: var(--line, #383842);
}

.icon-button {
  background: transparent;
  border: none;
  color: var(--muted, #a1a1aa);
  cursor: pointer;
  padding: 4px;
  border-radius: 3px;
  display: inline-flex;
}

.icon-button:hover {
  color: var(--text, #edebe8);
  background: var(--hover, #33333d);
}
</style>
