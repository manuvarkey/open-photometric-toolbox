<script setup lang="ts">
import { computed, ref } from "vue";
import AppIcon from "./AppIcon.vue";
import type { PhotometricData } from "../core/types";
import { convertPhotometric } from "../core/goniometerConversion";
import ThemedSelect from "./ThemedSelect.vue";
import { savePhotometricText } from "../services/photometricFiles";
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

const conversionError = ref("");
const convertedData = computed(() => {
  try { return { data: convertPhotometric(props.data, targetType.value, Number(angleResolution.value)), error: "" }; }
  catch (error) { return { data: null, error: error instanceof Error ? error.message : String(error) }; }
});
function applyConversion() {
  if (!convertedData.value.data) return;
  emit("apply", convertedData.value.data);
  emit("close");
}
async function downloadConverted(format: "ies" | "ldt") {
  conversionError.value = "";
  const data = convertedData.value.data;
  if (!data) return;
  try {
    const text = format === "ies" ? serializeIES(data) : serializeEULUMDAT(data);
    await savePhotometricText(text, data.fileName, format);
  } catch (error) { conversionError.value = error instanceof Error ? error.message : String(error); }
}
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <div class="modal-box" role="dialog" aria-modal="true" aria-label="Goniometer Converter">
      <!-- Header -->
      <div class="modal-header">
        <div class="modal-title">
          <AppIcon name="convert" :size="20" />
          <span>Goniophotometer Web Conversion (Type B ↔ Type C)</span>
        </div>
        <button class="icon-button" aria-label="Close" title="Close" @click="emit('close')">
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
              <label for="converter-field-1">Target Goniometer Type:</label>
              <ThemedSelect label="Target Goniometer Type" v-model="targetType" :options="[{label:'Type C (Architectural / Roadway)',value:1},{label:'Type B (Floodlight / Projector)',value:2}]" />
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

        <div class="algorithm-spec">
          <div class="spec-title"><AppIcon name="convert" :size="15" /><span>Conversion result</span></div>
          <p>Source: {{ data.calculated.totalLuminaireLumens.toLocaleString() }} lm</p>
          <p v-if="convertedData.data">Converted: {{ convertedData.data.calculated.totalLuminaireLumens.toLocaleString() }} lm · {{ convertedData.data.numHorizontalAngles }} × {{ convertedData.data.numVerticalAngles }} angles</p>
          <p v-if="targetType === 2 && data.calculated.upwardLumens > 0.1" role="note">Type B covers the forward hemisphere. This conversion excludes {{ data.calculated.upwardLumens.toFixed(1) }} lm of uplight; intensities are not rescaled.</p>
          <p>Angular resampling can slightly change integrated flux. Use finer sampling for narrow beams.</p>
          <p v-if="convertedData.error || conversionError" class="conversion-error" role="alert">{{ convertedData.error || conversionError }}</p>
        </div>
      </div>

      <!-- Footer Actions -->
      <div class="modal-footer">
        <button class="button secondary" @click="downloadConverted('ldt')" :disabled="!convertedData.data">
          <AppIcon name="convert" :size="14" />
          <span>Export LDT</span>
        </button>
        <button class="button secondary" @click="downloadConverted('ies')" :disabled="!convertedData.data">
          <AppIcon name="save" :size="14" />
          <span>Save IES</span>
        </button>
        <button class="button primary" @click="applyConversion" :disabled="!convertedData.data">
          <AppIcon name="check" :size="14" />
          <span>Apply</span>
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
.conversion-error { margin-top: 8px; color: var(--error-text); }
</style>
