<script setup lang="ts">
import { computed } from "vue";
import { polarPath } from "../utils/plotPaths";
import type { PhotometricData } from "../core/types";
const props = defineProps<{
  primaryData: PhotometricData | null;
  secondaryData: PhotometricData | null;
}>();
const compareData = computed(() => props.secondaryData);

function calcDelta(a: number, b: number): { text: string; isPositive: boolean } {
  if (!b) return { text: a === 0 ? "0.0%" : "—", isPositive: true };
  const delta = ((a - b) / b) * 100;
  const sign = delta > 0 ? "+" : "";
  return {
    text: `${sign}${delta.toFixed(1)}%`,
    isPositive: delta >= 0,
  };
}

const comparisonRows = computed(() => {
  if (!props.primaryData || !compareData.value) return [];
  const a = props.primaryData.calculated;
  const b = compareData.value.calculated;

  return [
    {
      metric: "Total Luminaire Lumens",
      valA: `${a.totalLuminaireLumens.toLocaleString()} lm`,
      valB: `${b.totalLuminaireLumens.toLocaleString()} lm`,
      delta: calcDelta(a.totalLuminaireLumens, b.totalLuminaireLumens),
    },
    {
      metric: "Input Watts",
      valA: `${props.primaryData.inputWatts.toFixed(1)} W`,
      valB: `${compareData.value.inputWatts.toFixed(1)} W`,
      delta: calcDelta(props.primaryData.inputWatts, compareData.value.inputWatts),
    },
    {
      metric: "Luminous Efficacy (LER)",
      valA: `${a.efficacyLER} lm/W`,
      valB: `${b.efficacyLER} lm/W`,
      delta: calcDelta(a.efficacyLER, b.efficacyLER),
    },
    {
      metric: "Max Intensity",
      valA: `${a.maxCandela.intensity.toLocaleString()} cd`,
      valB: `${b.maxCandela.intensity.toLocaleString()} cd`,
      delta: calcDelta(a.maxCandela.intensity, b.maxCandela.intensity),
    },
    {
      metric: "Efficiency",
      valA: `${a.efficiency}%`,
      valB: `${b.efficiency}%`,
      delta: calcDelta(a.efficiency, b.efficiency),
    },
    {
      metric: "Downward Lumens %",
      valA: `${Math.round((a.downwardLumens / (a.totalLuminaireLumens || 1)) * 100)}%`,
      valB: `${Math.round((b.downwardLumens / (b.totalLuminaireLumens || 1)) * 100)}%`,
      delta: calcDelta(
        a.downwardLumens / (a.totalLuminaireLumens || 1),
        b.downwardLumens / (b.totalLuminaireLumens || 1),
      ),
    },
    {
      metric: "CIE Luminaire Type",
      valA: a.cieClassification,
      valB: b.cieClassification,
      delta: { text: "—", isPositive: true },
    },
    {
      metric: "IES TM-15 BUG Rating",
      valA: a.bugRating.fullRating,
      valB: b.bugRating.fullRating,
      delta: { text: "—", isPositive: true },
    },
  ];
});

// Polar plot paths
const cx = 200;
const cy = 200;
const rMax = 160;

const maxCandelaBoth = computed(() => {
  const maxA = props.primaryData?.calculated.maxCandela.intensity || 100;
  const maxB = compareData.value?.calculated.maxCandela.intensity || 100;
  return Math.max(maxA, maxB);
});

function getCurvePath(data: PhotometricData | null) {
  return polarPath(data, cx, cy, rMax, maxCandelaBoth.value);
}

const pathA = computed(() => getCurvePath(props.primaryData));
const pathB = computed(() => getCurvePath(compareData.value));
</script>

<template>
  <div class="compare-container">
    <div class="compare-header">
      <div class="title-block">
        <span>Photometric Luminaire Comparison</span>
        <span class="sub-label">Side-by-side delta analysis and superimposed polar curves</span>
      </div>

    </div>

    <div class="compare-body">
      <!-- Polar Curves Overlay -->
      <div class="polar-compare-card">
        <div class="card-title">Superimposed Polar Distribution Curves</div>
        <div class="legend-row">
          <span class="legend-badge badge-a">● A: {{ primaryData?.fileName }}</span>
          <span class="legend-badge badge-b">● B: {{ compareData?.fileName }}</span>
        </div>

        <div class="svg-wrap">
          <svg viewBox="0 0 400 400" class="compare-svg">
            <!-- Polar concentric rings -->
            <circle :cx="cx" :cy="cy" :r="rMax" fill="none" stroke="var(--line-soft)" />
            <circle :cx="cx" :cy="cy" :r="rMax * 0.75" fill="none" stroke="var(--line-soft)" stroke-dasharray="3,3" />
            <circle :cx="cx" :cy="cy" :r="rMax * 0.5" fill="none" stroke="var(--line-soft)" stroke-dasharray="3,3" />
            <circle :cx="cx" :cy="cy" :r="rMax * 0.25" fill="none" stroke="var(--line-soft)" stroke-dasharray="3,3" />

            <!-- Axes -->
            <line :x1="cx" y1="20" :x2="cx" :y2="380" stroke="var(--line)" />
            <line x1="20" :y1="cy" x2="380" :y2="cy" stroke="var(--line)" />

            <!-- Curve A -->
            <path :d="pathA" fill="rgba(6, 182, 212, 0.22)" stroke="var(--graph-curve-0)" stroke-width="2" />

            <!-- Curve B -->
            <path :d="pathB" fill="rgba(245, 158, 11, 0.22)" stroke="var(--graph-curve-max)" stroke-width="2" />
          </svg>
        </div>
      </div>

      <!-- Metrics Delta Table -->
      <div class="metrics-compare-card">
        <div class="card-title">Photometric Metrics Comparison</div>
        <table class="delta-table">
          <thead>
            <tr>
              <th>Characteristic</th>
              <th>Luminaire A</th>
              <th>Luminaire B</th>
              <th>Delta (A vs B)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in comparisonRows" :key="r.metric">
              <td class="metric-name">{{ r.metric }}</td>
              <td class="val-a">{{ r.valA }}</td>
              <td class="val-b">{{ r.valB }}</td>
              <td class="delta-cell">
                <span
                  v-if="r.delta.text !== '—'"
                  class="delta-tag"
                  :class="{ positive: r.delta.isPositive, negative: !r.delta.isPositive }"
                >
                  {{ r.delta.text }}
                </span>
                <span v-else class="dash">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.compare-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 14px;
  gap: 14px;
  background: var(--workspace);
  overflow-y: auto;
}

.compare-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--well);
  border: 1px solid var(--line-soft);
  border-radius: var(--control-radius);
  padding: 10px 16px;
  flex-wrap: wrap;
  gap: 10px;
}

.title-block {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-weight: 600;
  font-size: 0.92rem;
  color: var(--text);
}

.sub-label {
  font-size: 0.75rem;
  color: var(--muted);
  font-weight: normal;
}

.selector-group {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  color: var(--muted);
}

.sample-select {
  padding: 5px 10px;
  background: var(--raised);
  border: 1px solid var(--line);
  border-radius: var(--control-radius);
  color: var(--text);
  font-size: 0.82rem;
  outline: none;
}

.compare-body {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 360px), 1fr));
  gap: 14px;
  flex: 1;
}

.polar-compare-card,
.metrics-compare-card {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--control-radius);
  padding: 14px;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow-x: auto;
}

.card-title {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 10px;
}

.legend-row {
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
}

.legend-badge {
  font-size: 0.75rem;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 4px;
}

.badge-a {
  background: rgba(6, 182, 212, 0.15);
  color: #06b6d4;
  border: 1px solid rgba(6, 182, 212, 0.4);
}

.badge-b {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
  border: 1px solid rgba(245, 158, 11, 0.4);
}

.svg-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 320px;
}

.compare-svg {
  width: 100%;
  max-width: 340px;
  height: auto;
}

.delta-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}

.delta-table th,
.delta-table td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--line-soft);
  text-align: left;
}

.delta-table th {
  background: var(--well);
  color: var(--muted);
  font-weight: 500;
  font-size: 0.78rem;
}

.metric-name {
  color: var(--text);
  font-weight: 500;
}

.val-a {
  color: #06b6d4;
  font-family: var(--ui-font-family);
  font-variant-numeric: tabular-nums;
}

.val-b {
  color: #f59e0b;
  font-family: var(--ui-font-family);
  font-variant-numeric: tabular-nums;
}

.delta-tag {
  font-family: var(--ui-font-family);
  font-variant-numeric: tabular-nums;
  font-size: 0.75rem;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.delta-tag.positive {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

.delta-tag.negative {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.dash {
  color: var(--hint);
}
</style>
