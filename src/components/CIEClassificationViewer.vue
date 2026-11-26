<script setup lang="ts">
import { computed, ref } from "vue";
import AppIcon from "./AppIcon.vue";
import type { PhotometricData } from "../core/types";

const props = defineProps<{
  data: PhotometricData;
}>();

const calc = computed(() => props.data.calculated);
const cie = computed(() => props.data.calculated.cieDetails);

const copyStatus = ref("");
async function copyCIE() {
  const text = `CIE Classification: ${cie.value.luminaireType}
CIE Flux Code: ${cie.value.fluxCode}
DIN 5040 Class: ${cie.value.din5040Class}
Downward Flux: ${calc.value.downwardLumens.toLocaleString()} lm (${cie.value.downwardFluxRatio}%)
Upward Flux: ${calc.value.upwardLumens.toLocaleString()} lm (${cie.value.upwardFluxRatio}%)
Efficiency (LOR): ${calc.value.efficiency}%`;
  try {
    await navigator.clipboard.writeText(text);
    copyStatus.value = "CIE summary copied.";
  } catch {
    copyStatus.value = "Could not copy the CIE summary.";
  }
}
</script>

<template>
  <div class="cie-viewer">
    <section class="cie-report" aria-labelledby="cie-title">
      <h2 id="cie-title">CIE Luminaire Classification &amp; Flux Code</h2>
      <div class="cie-body">
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

      <div class="cie-footer">
        <button class="button secondary" @click="copyCIE">
          <AppIcon name="report" :size="14" />
          <span>Copy CIE Summary</span>
        </button>
        <span role="status">{{ copyStatus }}</span>
      </div>
    </section>
  </div>
</template>

<style scoped>
.cie-viewer {
  height: 100%;
  overflow: auto;
  padding: 16px;
}

.cie-report {
  background: var(--panel, #1e1e24);
  border: 1px solid var(--line, #383842);
  border-radius: var(--control-radius, 6px);
  max-width: 800px;
  margin-inline: auto;
  color: var(--text, #edebe8);
}

.cie-report h2 {
  margin: 0;
  padding: 12px 16px;
  border-bottom: 1px solid var(--line, #383842);
  background: var(--well, #2a2a32);
  font-size: var(--text-size-heading);
}

.cie-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cie-summary-card {
  background: var(--well, #2a2a32);
  border: 1px solid var(--line-soft, #3d3d46);
  border-radius: 4px;
  padding: 14px;
}

.cie-badge-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.cie-type-badge {
  background: var(--accent, #d97706);
  color: var(--on-accent);
  font-size: var(--text-size-ui);
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.din-badge {
  background: var(--hover, #33333d);
  color: var(--text-soft, #d4d4d8);
  font-size: var(--text-size-caption);
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 4px;
  border: 1px solid var(--line-soft, #3d3d46);
}

.cie-description {
  font-size: var(--text-size-ui);
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
  flex-wrap: wrap;
  gap: 4px 12px;
  justify-content: space-between;
  font-size: var(--text-size-caption);
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
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  font-size: var(--text-size-ui);
  font-weight: 600;
  border-bottom: 1px solid var(--line-soft, #3d3d46);
  background: var(--panel, #1e1e24);
}

.flux-code-pill {
  font-family: var(--ui-font-family);
  font-variant-numeric: tabular-nums;
  font-size: var(--text-size-ui);
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
  overflow-wrap: anywhere;
  font-size: var(--text-size-caption);
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
  font-size: var(--text-size-caption);
  color: var(--hint, #71717a);
  padding: 0 4px;
}

.cie-footer {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
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
  font-size: var(--text-size-caption);
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s ease;
}

.button.secondary {
  background: var(--hover, #33333d);
  color: var(--text, #edebe8);
  border-color: var(--line-soft, #3d3d46);
}

.button.secondary:hover {
  background: var(--line, #383842);
}

</style>
