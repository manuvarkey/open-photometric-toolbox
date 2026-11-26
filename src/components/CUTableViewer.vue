<script setup lang="ts">
import type { CUTable } from "../core/types";

const props = defineProps<{
  cu: CUTable;
}>();

// Group headers for ceiling reflectances
const ceilingGroups = [
  { label: "80%", span: 4 },
  { label: "70%", span: 4 },
  { label: "50%", span: 3 },
  { label: "30%", span: 3 },
  { label: "10%", span: 3 },
  { label: "0%", span: 1 },
];

function getCellColor(val: number): string {
  if (val >= 0.8) return "color-mix(in srgb, var(--accent) 18%, transparent)";
  if (val >= 0.6) return "color-mix(in srgb, var(--accent) 10%, transparent)";
  if (val >= 0.4) return "color-mix(in srgb, var(--accent) 4%, transparent)";
  return "transparent";
}
</script>

<template>
  <div class="cu-viewer-container">
    <div class="cu-card">
      <div class="cu-card-header">
        <div class="header-main">
          <span>Coefficients of Utilization — Zonal Cavity Method</span>
          <span class="floor-badge">Effective Floor Cavity Reflectance: {{ Math.round(cu.floorReflectance * 100) }}%</span>
        </div>
        <div class="spacing-badges">
          <span class="sc-badge">SC (Along 0°): <strong>{{ cu.spacingCriteria.along0 }}</strong></span>
          <span class="sc-badge">SC (Across 90°): <strong>{{ cu.spacingCriteria.across90 }}</strong></span>
        </div>
      </div>

      <div class="table-scroll" tabindex="0" role="region" aria-label="Coefficient of utilization table; scroll horizontally for additional columns">
        <table class="cu-table">
          <thead>
            <tr class="header-group-row">
              <th rowspan="2" class="rcr-col">RCR</th>
              <th
                v-for="(grp, idx) in ceilingGroups"
                :key="idx"
                :colspan="grp.span"
                class="ceiling-group-th"
              >
                RC {{ grp.label }}
              </th>
            </tr>
            <tr class="header-sub-row">
              <th
                v-for="col in cu.columns"
                :key="col.key"
                class="wall-sub-th"
              >
                {{ col.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in cu.rows" :key="row.rcr">
              <td class="rcr-cell">
                <span v-if="row.rcr === 0" class="rcr-zero">0 (Floor)</span>
                <span v-else>{{ row.rcr }}</span>
              </td>
              <td
                v-for="col in cu.columns"
                :key="col.key"
                class="cu-cell"
                :style="{ backgroundColor: getCellColor(row.cuValues[col.key] ?? 0) }"
              >
                {{ (row.cuValues[col.key] ?? 0).toFixed(2) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="cu-footer-note">
        <span>* Decompiled from <code>LAICalcNETRev2.dll</code> (<code>gsbCalcCU</code> & <code>gfnCalcCUShort</code>) via IESNA flux transfer quadrature.</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cu-viewer-container {
  padding: 16px;
  height: 100%;
  overflow: auto;
}

.cu-card {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--control-radius);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
}

.cu-card-header {
  padding: 12px 16px;
  background: var(--well);
  border-bottom: 1px solid var(--line-soft);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
}

.header-main {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 600;
  font-size: var(--text-size-ui);
  color: var(--text);
}

.floor-badge {
  font-size: var(--text-size-caption);
  background: var(--raised);
  border: 1px solid var(--line-soft);
  padding: 2px 8px;
  border-radius: 12px;
  color: var(--accent);
  font-weight: 500;
}

.spacing-badges {
  display: flex;
  gap: 8px;
}

.sc-badge {
  font-size: var(--text-size-caption);
  background: var(--raised);
  border: 1px solid var(--line);
  padding: 3px 10px;
  border-radius: 4px;
  color: var(--muted);
}

.sc-badge strong {
  color: var(--text);
}

.table-scroll {
  overflow-x: auto;
}

.cu-table {
  width: 100%;
  border-collapse: collapse;
  font-family: var(--ui-font-family);
  font-variant-numeric: tabular-nums;
  font-size: var(--text-size-caption);
}

.cu-table th,
.cu-table td {
  border: 1px solid var(--line-soft);
  text-align: center;
  padding: 6px 4px;
}

.rcr-col {
  width: 70px;
  min-width: 70px;
  background: var(--well);
  color: var(--accent);
  font-weight: 600;
  vertical-align: middle;
}

.ceiling-group-th {
  background: var(--well);
  color: var(--text);
  font-weight: 600;
  font-size: var(--text-size-caption);
  padding: 6px;
  border-bottom: 1px solid var(--line);
}

.wall-sub-th {
  background: var(--panel);
  color: var(--muted);
  font-weight: 500;
  font-size: var(--text-size-caption);
  min-width: 38px;
}

.rcr-cell {
  background: var(--well);
  font-weight: 600;
  color: var(--text);
}

.rcr-zero {
  color: var(--accent);
  font-size: var(--text-size-caption);
}

.cu-cell {
  color: var(--text);
  transition: background 0.12s;
}

.cu-cell:hover {
  background: var(--raised) !important;
  color: var(--accent);
}

.cu-footer-note {
  padding: 8px 14px;
  background: var(--well);
  border-top: 1px solid var(--line-soft);
  font-size: var(--text-size-caption);
  color: var(--hint);
}

.cu-footer-note code {
  color: var(--accent);
}
</style>
