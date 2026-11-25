<script setup lang="ts">
import { computed } from "vue";
import AppIcon from "./AppIcon.vue";
import type { PhotometricData } from "../core/types";

const props = defineProps<{
  data: PhotometricData;
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

const calc = computed(() => props.data.calculated);
const cie = computed(() => props.data.calculated.cieDetails);

function copyCIE() {
  const text = `CIE Classification: ${cie.value.luminaireType}
CIE Flux Code: ${cie.value.fluxCode}
DIN 5040 Class: ${cie.value.din5040Class}
Downward Flux: ${calc.value.downwardLumens.toLocaleString()} lm (${cie.value.downwardFluxRatio}%)
Upward Flux: ${calc.value.upwardLumens.toLocaleString()} lm (${cie.value.upwardFluxRatio}%)
Efficiency (LOR): ${calc.value.efficiency}%`;
  navigator.clipboard.writeText(text);
  window.alert("CIE Classification & Flux Code copied to clipboard!");
}
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <div class="modal-box" role="dialog" aria-modal="true" aria-label="CIE Classification">
      <!-- Modal Header -->
      <div class="modal-header">
        <div class="modal-title">
          <AppIcon name="chart" :size="20" />
          <span>CIE Luminaire Classification & Flux Code</span>
        </div>
        <button class="icon-button" aria-label="Close" title="Close" @click="emit('close')">
          <AppIcon name="close" :size="16" />
        </button>
      </div>

      <!-- Modal Body -->
      <div class="modal-body">
        <!-- Luminaire Class Summary Card -->
        <div class="cie-summary-card">
          <div class="cie-badge-row">
            <span class="cie-type-badge">{{ cie.luminaireType }}</span>
            <span class="din-badge">DIN 5040: {{ cie.din5040Class }}</span>
          </div>
          <p class="cie-description">{{ cie.cieDescription }}</p>

          <!-- Flux Distribution Bar -->
          <div class="flux-bar-container">
            <div class="flux-bar-labels">
              <span>Downward: <strong>{{ cie.downwardFluxRatio }}%</strong> ({{ calc.downwardLumens.toLocaleString() }} lm)</span>
              <span>Upward: <strong>{{ cie.upwardFluxRatio }}%</strong> ({{ calc.upwardLumens.toLocaleString() }} lm)</span>
            </div>
            <div class="flux-bar">
              <div
                class="flux-fill downward"
                :style="{ width: `${cie.downwardFluxRatio}%` }"
                title="Downward Flux"
              ></div>
              <div
                class="flux-fill upward"
                :style="{ width: `${cie.upwardFluxRatio}%` }"
                title="Upward Flux"
              ></div>
            </div>
          </div>
        </div>

        <!-- CIE 97 / CEN 5-Factor Flux Code -->
        <div class="flux-code-card">
          <div class="card-heading">
            <span>CIE 97 / CEN Flux Code</span>
            <span class="flux-code-pill">{{ cie.fluxCode }}</span>
          </div>

          <table class="flux-code-table">
            <thead>
              <tr>
                <th>Factor</th>
                <th>Zone / Ratio</th>
                <th>CIE Definition</th>
                <th class="text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>F₁ (N₁)</strong></td>
                <td>0° – 41.4°</td>
                <td>Luminous flux fraction within 41.4° cone relative to downward flux</td>
                <td class="text-right"><strong>{{ cie.fluxCodeArray[0] }}%</strong></td>
              </tr>
              <tr>
                <td><strong>F₂ (N₂)</strong></td>
                <td>0° – 60.0°</td>
                <td>Luminous flux fraction within 60.0° cone relative to downward flux</td>
                <td class="text-right"><strong>{{ cie.fluxCodeArray[1] }}%</strong></td>
              </tr>
              <tr>
                <td><strong>F₃ (N₃)</strong></td>
                <td>0° – 75.5°</td>
                <td>Luminous flux fraction within 75.5° cone relative to downward flux</td>
                <td class="text-right"><strong>{{ cie.fluxCodeArray[2] }}%</strong></td>
              </tr>
              <tr>
                <td><strong>F₄ (N₄)</strong></td>
                <td>0° – 90° / Total</td>
                <td>Downward Flux Fraction (DFF) of total luminaire output</td>
                <td class="text-right"><strong>{{ cie.fluxCodeArray[3] }}%</strong></td>
              </tr>
              <tr>
                <td><strong>F₅ (N₅)</strong></td>
                <td>LOR / Efficiency</td>
                <td>Light Output Ratio (Total Luminaire Lumens / Lamp Lumens)</td>
                <td class="text-right"><strong>{{ cie.fluxCodeArray[4] }}%</strong></td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Photometric Standards Compliance Note -->
        <div class="standards-note">
          <AppIcon name="info" :size="15" />
          <span>Computed according to CIE Publication 52, CIE 97, and EN 13032-1 using Simpson's 1° zonal integration.</span>
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="modal-footer">
        <button class="button secondary" @click="copyCIE">
          <AppIcon name="report" :size="14" />
          <span>Copy CIE Summary</span>
        </button>
        <button class="button primary" @click="emit('close')">
          <span>Done</span>
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
  width: 600px;
  max-width: 95vw;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--text, #edebe8);
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

.cie-summary-card {
  background: var(--well, #2a2a32);
  border: 1px solid var(--line-soft, #3d3d46);
  border-radius: 4px;
  padding: 14px;
}

.cie-badge-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.cie-type-badge {
  background: var(--accent, #d97706);
  color: var(--on-accent);
  font-size: 0.85rem;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.din-badge {
  background: var(--hover, #33333d);
  color: var(--text-soft, #d4d4d8);
  font-size: 0.8rem;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 4px;
  border: 1px solid var(--line-soft, #3d3d46);
}

.cie-description {
  font-size: 0.85rem;
  color: var(--muted, #a1a1aa);
  margin: 0 0 12px;
  line-height: 1.4;
}

.flux-bar-container {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.flux-bar-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.78rem;
  color: var(--text-soft, #d4d4d8);
}

.flux-bar {
  display: flex;
  height: 12px;
  width: 100%;
  border-radius: 6px;
  overflow: hidden;
  background: var(--line, #383842);
}

.flux-fill.downward {
  background: #38bdf8;
  transition: width 0.3s ease;
}

.flux-fill.upward {
  background: #fbbf24;
  transition: width 0.3s ease;
}

.flux-code-card {
  background: var(--well, #2a2a32);
  border: 1px solid var(--line-soft, #3d3d46);
  border-radius: 4px;
  overflow: hidden;
}

.card-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  font-size: 0.85rem;
  font-weight: 600;
  border-bottom: 1px solid var(--line-soft, #3d3d46);
  background: var(--panel, #1e1e24);
}

.flux-code-pill {
  font-family: monospace;
  font-size: 0.9rem;
  font-weight: 700;
  background: var(--accent, #d97706);
  color: var(--on-accent);
  padding: 2px 8px;
  border-radius: 3px;
  letter-spacing: 1px;
}

.flux-code-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
}

.flux-code-table th,
.flux-code-table td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--line-soft, #3d3d46);
}

.flux-code-table th {
  background: rgba(0, 0, 0, 0.15);
  color: var(--muted, #a1a1aa);
  font-weight: 500;
  text-align: left;
}

.text-right {
  text-align: right;
}

.standards-note {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.75rem;
  color: var(--hint, #71717a);
  padding: 0 4px;
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
