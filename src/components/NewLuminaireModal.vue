<script setup lang="ts">
import { computed, ref } from "vue";
import AppIcon from "./AppIcon.vue";
import ThemedSelect from "./ThemedSelect.vue";
import type { PhotometricData } from "../core/types";
import { computePhotometrics } from "../core/calculations";
import { convertPhotometric } from "../core/goniometerConversion";

const emit = defineEmits<{
  (e: "close"): void;
  (e: "created", data: PhotometricData): void;
}>();

type PresetType = "downlight" | "batwing" | "highbay" | "floodlight" | "indirect" | "wallwash";

const selectedPreset = ref<PresetType>("downlight");
const luminaireName = ref("Commercial LED Downlight");
const catalogNumber = ref("CDL-40W-4000K");
const manufacturer = ref("Architectural Lighting Co.");
const totalLumens = ref(3600);
const inputWatts = ref(36);
const beamAngle = ref(55);
const length = ref(0.65);
const width = ref(0.65);
const height = ref(0.3);
const unitsType = ref<1 | 2>(2); // 1 = Feet, 2 = Meters

function selectPreset(preset: PresetType) {
  selectedPreset.value = preset;
  if (preset === "downlight") {
    luminaireName.value = "Commercial Recessed LED Downlight";
    catalogNumber.value = "CRD-36W-55DEG";
    totalLumens.value = 3600;
    inputWatts.value = 36;
    beamAngle.value = 55;
    length.value = 0.65;
    width.value = 0.65;
    height.value = 0.25;
  } else if (preset === "batwing") {
    luminaireName.value = "Linear Suspended Batwing Luminaire";
    catalogNumber.value = "BAT-4FT-45W";
    totalLumens.value = 4800;
    inputWatts.value = 45;
    beamAngle.value = 75;
    length.value = 4.0;
    width.value = 0.5;
    height.value = 0.3;
  } else if (preset === "highbay") {
    luminaireName.value = "Industrial UFO High Bay LED";
    catalogNumber.value = "HB-UFO-150W-90D";
    totalLumens.value = 21000;
    inputWatts.value = 150;
    beamAngle.value = 90;
    length.value = 1.2;
    width.value = 1.2;
    height.value = 0.4;
  } else if (preset === "floodlight") {
    luminaireName.value = "Architectural Floodlight Projector";
    catalogNumber.value = "FLD-100W-NEMA4";
    totalLumens.value = 12500;
    inputWatts.value = 100;
    beamAngle.value = 35;
    length.value = 1.0;
    width.value = 0.8;
    height.value = 0.5;
  } else if (preset === "indirect") {
    luminaireName.value = "Suspended Direct/Indirect Office Luminaire";
    catalogNumber.value = "SDI-4FT-50W";
    totalLumens.value = 5500;
    inputWatts.value = 50;
    beamAngle.value = 60;
    length.value = 4.0;
    width.value = 0.8;
    height.value = 0.3;
  } else if (preset === "wallwash") {
    luminaireName.value = "Asymmetric Recessed Wall Washer";
    catalogNumber.value = "WW-AS-30W";
    totalLumens.value = 3200;
    inputWatts.value = 30;
    beamAngle.value = 45;
    length.value = 1.2;
    width.value = 0.5;
    height.value = 0.3;
  }
}

// Generate vertical and horizontal angles & candela
const generatedProfile = computed(() => {
  const vAngles: number[] = [];
  for (let a = 0; a <= 180; a += 5) vAngles.push(a);

  const halfBeamRad = ((beamAngle.value / 2) * Math.PI) / 180;
  // Compute exponent for cos^n(theta) = 0.5 at theta = halfBeam
  const n = Math.max(0.5, Math.log(0.5) / Math.log(Math.max(0.001, Math.cos(halfBeamRad))));

  // Estimate peak intensity from total lumens: Lumens ~ 2*pi * I_0 / (n + 1)
  const estI0 = (totalLumens.value * (n + 1)) / (2 * Math.PI);

  const isBilateral = selectedPreset.value === "wallwash" || selectedPreset.value === "batwing";
  const hAngles = isBilateral ? [0, 45, 90, 135, 180] : [0];

  const candela: number[][] = hAngles.map((hDeg) => {
    return vAngles.map((vDeg) => {
      const vRad = (vDeg * Math.PI) / 180;

      if (selectedPreset.value === "downlight" || selectedPreset.value === "highbay" || selectedPreset.value === "floodlight") {
        if (vDeg > 90) return 0;
        return Math.round(estI0 * Math.pow(Math.cos(vRad), n));
      } else if (selectedPreset.value === "batwing") {
        if (vDeg > 90) return 0;
        // Batwing: peak at 30 deg in 90 deg plane, cosine in 0 deg plane
        const peakAngleRad = (32 * Math.PI) / 180;
        const hFactor = Math.sin((hDeg * Math.PI) / 180);
        const shift = Math.exp(-Math.pow((vRad - peakAngleRad) / 0.3, 2)) * 1.35 * hFactor * Math.sin(vRad);
        const base = Math.pow(Math.cos(vRad), 1.2);
        return Math.round(estI0 * 0.8 * (base + shift));
      } else if (selectedPreset.value === "indirect") {
        // 70% down, 30% up
        if (vDeg <= 90) {
          return Math.round(estI0 * 0.7 * Math.pow(Math.cos(vRad), n));
        } else {
          // Upward lobe (zenith = 180 deg)
          const upRad = Math.PI - vRad;
          return Math.round(estI0 * 0.35 * Math.pow(Math.cos(upRad), 1.5));
        }
      } else if (selectedPreset.value === "wallwash") {
        if (vDeg > 90) return 0;
        // Asymmetric lobe tilted toward 0 deg plane
        const hRad = (hDeg * Math.PI) / 180;
        const tiltEffect = Math.cos(hRad) * 0.45 * Math.sin(vRad);
        const lobeCenter = (25 * Math.PI) / 180;
        const lobe = Math.exp(-Math.pow((vRad - lobeCenter) / 0.4, 2));
        return Math.round(estI0 * (Math.pow(Math.cos(vRad), 1.5) + lobe * (0.6 + tiltEffect)));
      }
      return 0;
    });
  });

  return { vAngles, hAngles, candela, estI0 };
});

// Mini Preview Curve Path
const previewPath = computed(() => {
  const { vAngles, candela, estI0 } = generatedProfile.value;
  const maxI = Math.max(1, estI0 * 1.2);
  const cx = 110;
  const cy = 110;
  const rMax = 90;

  const ptsRight: string[] = [];
  for (let i = 0; i < vAngles.length; i++) {
    const deg = vAngles[i];
    const cd = candela[0][i];
    const r = (cd / maxI) * rMax;
    const rad = (deg * Math.PI) / 180 + Math.PI / 2;
    const x = cx + r * Math.cos(rad);
    const y = cy + r * Math.sin(rad);
    ptsRight.push(`${x.toFixed(1)} ${y.toFixed(1)}`);
  }

  const ptsLeft: string[] = [];
  for (let i = vAngles.length - 1; i >= 0; i--) {
    const deg = vAngles[i];
    const cd = candela[0][i];
    const r = (cd / maxI) * rMax;
    const rad = (-deg * Math.PI) / 180 + Math.PI / 2;
    const x = cx + r * Math.cos(rad);
    const y = cy + r * Math.sin(rad);
    ptsLeft.push(`${x.toFixed(1)} ${y.toFixed(1)}`);
  }

  return `M ${ptsRight.join(" L ")} L ${ptsLeft.join(" L ")} Z`;
});

function handleCreate() {
  const { vAngles, hAngles, candela } = generatedProfile.value;
  // The synthesis model below is expressed in C/gamma directions. A flood
  // preset is resampled into a genuine signed B grid after synthesis.
  const photometricType = 1;

  const calculated = computePhotometrics(
    vAngles,
    hAngles,
    candela,
    1,
    totalLumens.value,
    1.0,
    inputWatts.value,
    length.value,
    width.value,
    height.value,
    unitsType.value,
    photometricType
  );

  const newFile: PhotometricData = {
    fileName: `${catalogNumber.value.replace(/[^a-zA-Z0-9_-]/g, "_")}.ies`,
    fileFormat: "IES",
    headerVersion: "IESNA:LM-63-2002",
    keywords: {
      "TEST": `SYNTHETIC-${Date.now()}`,
      "TESTLAB": "Photometric Synthesis Engine",
      "MANUFAC": manufacturer.value,
      "LUMCAT": catalogNumber.value,
      "LUMINAIRE": luminaireName.value,
      "LAMP": `Integrated LED (${totalLumens.value} lm, ${inputWatts.value}W)`,
    },
    lampCount: 1,
    lumensPerLamp: totalLumens.value,
    multiplier: 1.0,
    numVerticalAngles: vAngles.length,
    numHorizontalAngles: hAngles.length,
    photometricType,
    unitsType: unitsType.value,
    luminousWidth: width.value,
    luminousLength: length.value,
    luminousHeight: height.value,
    ballastFactor: 1.0,
    inputWatts: inputWatts.value,
    verticalAngles: vAngles,
    horizontalAngles: hAngles,
    candela,
    calculated,
  };

  emit("created", selectedPreset.value === "floodlight" ? convertPhotometric(newFile, 2) : newFile);
  emit("close");
}
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <div class="modal-box" role="dialog" aria-modal="true" aria-label="New Luminaire">
      <!-- Header -->
      <div class="modal-header">
        <div class="modal-title">
          <AppIcon name="lightbulb" :size="20" />
          <span>New Luminaire</span>
        </div>
        <button class="icon-button" aria-label="Close" title="Close" @click="emit('close')">
          <AppIcon name="close" :size="16" />
        </button>
      </div>

      <!-- Body -->
      <div class="modal-body">
        <!-- Preset Templates Selector -->
        <div class="presets-section">
          <div class="section-label">1. Select Distribution Profile Preset</div>
          <div class="preset-grid">
            <button
              class="preset-card"
              :class="{ active: selectedPreset === 'downlight' }"
              @click="selectPreset('downlight')"
            >
              <span class="preset-title">LED Downlight</span>
              <span class="preset-desc">Direct cosine beam with sharp cutoff</span>
            </button>
            <button
              class="preset-card"
              :class="{ active: selectedPreset === 'batwing' }"
              @click="selectPreset('batwing')"
            >
              <span class="preset-title">Office Batwing</span>
              <span class="preset-desc">Wide ambient peak at 30°–35° for low glare</span>
            </button>
            <button
              class="preset-card"
              :class="{ active: selectedPreset === 'highbay' }"
              @click="selectPreset('highbay')"
            >
              <span class="preset-title">UFO High Bay</span>
              <span class="preset-desc">High-lumen industrial direct distribution</span>
            </button>
            <button
              class="preset-card"
              :class="{ active: selectedPreset === 'floodlight' }"
              @click="selectPreset('floodlight')"
            >
              <span class="preset-title">NEMA Floodlight</span>
              <span class="preset-desc">Type B projector with focused beam</span>
            </button>
            <button
              class="preset-card"
              :class="{ active: selectedPreset === 'indirect' }"
              @click="selectPreset('indirect')"
            >
              <span class="preset-title">Direct / Indirect</span>
              <span class="preset-desc">Dual emission: 70% down, 30% upward ceiling wash</span>
            </button>
            <button
              class="preset-card"
              :class="{ active: selectedPreset === 'wallwash' }"
              @click="selectPreset('wallwash')"
            >
              <span class="preset-title">Asymmetric Wall Wash</span>
              <span class="preset-desc">Asymmetric lobe directed toward wall plane</span>
            </button>
          </div>
        </div>

        <div class="config-columns">
          <!-- Form Inputs -->
          <div class="form-pane">
            <div class="section-label">2. Photometric & Physical Parameters</div>
            <div class="field-row">
              <div class="field-item">
                <label for="new-field-1">Luminaire Name</label>
                <input id="new-field-1" v-model="luminaireName" type="text" class="text-input" />
              </div>
              <div class="field-item">
                <label for="new-field-2">Catalog Number</label>
                <input id="new-field-2" v-model="catalogNumber" type="text" class="text-input" />
              </div>
            </div>

            <div class="field-row">
              <div class="field-item">
                <label for="new-field-3">Manufacturer</label>
                <input id="new-field-3" v-model="manufacturer" type="text" class="text-input" />
              </div>
              <div class="field-item">
                <label for="new-field-4">Units</label>
                <ThemedSelect label="Units" v-model="unitsType" :options="[{label:'Feet',value:1},{label:'Metres',value:2}]" />
              </div>
            </div>

            <div class="field-row">
              <div class="field-item">
                <label for="new-field-5">Total Lumens (lm)</label>
                <input id="new-field-5" v-model.number="totalLumens" type="number" step="100" class="text-input" />
              </div>
              <div class="field-item">
                <label for="new-field-6">Input Power (Watts)</label>
                <input id="new-field-6" v-model.number="inputWatts" type="number" step="1" class="text-input" />
              </div>
              <div class="field-item">
                <label for="new-field-7">Beam Angle (2θ½)</label>
                <input id="new-field-7" v-model.number="beamAngle" type="number" step="5" min="10" max="140" class="text-input" />
              </div>
            </div>

            <div class="field-row">
              <div class="field-item">
                <label for="new-field-8">Length</label>
                <input id="new-field-8" v-model.number="length" type="number" step="0.1" class="text-input" />
              </div>
              <div class="field-item">
                <label for="new-field-9">Width</label>
                <input id="new-field-9" v-model.number="width" type="number" step="0.1" class="text-input" />
              </div>
              <div class="field-item">
                <label for="new-field-10">Height</label>
                <input id="new-field-10" v-model.number="height" type="number" step="0.05" class="text-input" />
              </div>
            </div>
          </div>

          <!-- Real-Time Curve Preview -->
          <div class="preview-pane">
            <div class="section-label">Distribution Preview</div>
            <div class="mini-polar-box">
              <svg width="220" height="220" viewBox="0 0 220 220" class="mini-svg">
                <!-- Concentric Rings -->
                <circle cx="110" cy="110" r="22.5" fill="none" stroke="#383842" stroke-width="1" />
                <circle cx="110" cy="110" r="45" fill="none" stroke="#383842" stroke-width="1" />
                <circle cx="110" cy="110" r="67.5" fill="none" stroke="#383842" stroke-width="1" />
                <circle cx="110" cy="110" r="90" fill="none" stroke="#484854" stroke-width="1.2" />
                <!-- Spokes -->
                <line x1="20" y1="110" x2="200" y2="110" stroke="#383842" stroke-width="1" stroke-dasharray="2,3" />
                <line x1="110" y1="20" x2="110" y2="200" stroke="#383842" stroke-width="1" stroke-dasharray="2,3" />
                <!-- Candela Curve -->
                <path :d="previewPath" fill="rgba(217, 119, 6, 0.15)" stroke="#d97706" stroke-width="2" />
                <circle cx="110" cy="110" r="3" fill="#fbbf24" />
              </svg>
              <div class="preview-stats">
                <span>Efficacy: <strong>{{ (totalLumens / (inputWatts || 1)).toFixed(1) }} lm/W</strong></span>
                <span>Peak: <strong>{{ Math.round(generatedProfile.estI0) }} cd</strong></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="modal-footer">
        <button class="button secondary" @click="emit('close')">Cancel</button>
        <button class="button primary" @click="handleCreate">
          <AppIcon name="plus" :size="14" />
          <span>Create & Load Luminaire</span>
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
  width: 780px;
  max-width: 95vw;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  color: var(--text, #edebe8);
  overflow: hidden;
  container-type: inline-size;
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
  max-height: 80vh;
  overflow-y: auto;
}

.section-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-soft, #d4d4d8);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.preset-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  background: var(--well, #2a2a32);
  border: 1px solid var(--line-soft, #3d3d46);
  border-radius: 4px;
  padding: 10px;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
}

.preset-card:hover {
  background: var(--hover, #33333d);
  border-color: var(--line, #383842);
}

.preset-card.active {
  background: rgba(217, 119, 6, 0.15);
  border-color: var(--accent, #d97706);
}

.preset-title {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text, #edebe8);
}

.preset-desc {
  font-size: 0.72rem;
  color: var(--muted, #a1a1aa);
  line-height: 1.25;
}

.config-columns {
  display: flex;
  gap: 16px;
}

.form-pane {
  flex: 1.6;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.preview-pane {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.mini-polar-box {
  background: var(--well, #2a2a32);
  border: 1px solid var(--line-soft, #3d3d46);
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px;
}

.preview-stats {
  display: flex;
  justify-content: space-between;
  width: 100%;
  font-size: 0.75rem;
  color: var(--muted, #a1a1aa);
  margin-top: 8px;
  border-top: 1px solid var(--line-soft, #3d3d46);
  padding-top: 6px;
}

.field-row {
  display: flex;
  gap: 10px;
}

.field-item {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-item label {
  font-size: 0.75rem;
  color: var(--muted, #a1a1aa);
}

.text-input {
  width: 100%;
  min-width: 0;
  background: var(--well, #2a2a32);
  border: 1px solid var(--line-soft, #3d3d46);
  color: var(--text, #edebe8);
  padding: 6px 8px;
  border-radius: 4px;
  font-size: 0.8rem;
  outline: none;
}

.text-input:focus {
  border-color: var(--accent, #d97706);
}

@container (max-width: 720px) {
  .preset-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .config-columns { flex-direction: column; }
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
