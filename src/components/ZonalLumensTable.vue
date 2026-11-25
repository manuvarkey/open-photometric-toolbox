<script setup lang="ts">
import type { ZonalLumenZone } from "../core/types";

defineProps<{
  zones: ZonalLumenZone[];
  totalLumens: number;
}>();
</script>

<template>
  <div class="zonal-table-container">
    <div class="table-card">
      <div class="table-card-header">
        <span>Zonal Lumen Summary</span>
        <span class="total-tag">Total: {{ totalLumens }} lm</span>
      </div>
      <div class="table-scroll">
        <table class="zonal-table">
          <thead>
            <tr>
              <th>Zone Range</th>
              <th class="num">Lumens</th>
              <th class="num">% Luminaire</th>
              <th>Distribution</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="z in zones" :key="z.range">
              <td class="zone-range">{{ z.range }}</td>
              <td class="num">{{ z.lumens }}</td>
              <td class="num">{{ z.percentLuminaire }}%</td>
              <td class="bar-cell">
                <div class="bar-track">
                  <div class="bar-fill" :style="{ width: `${Math.min(100, z.percentLuminaire * 3)}%` }"></div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.zonal-table-container {
  width: 100%;
  height: 100%;
  padding: 16px;
  overflow: auto;
  background: var(--workspace, #26262d);
  display: flex;
  justify-content: center;
}

.table-card {
  width: 100%;
  max-width: 680px;
  background: var(--panel, #33333c);
  border: 1px solid var(--line, #474750);
  border-radius: var(--control-radius, 4px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: max-content;
}

.table-card-header {
  padding: 10px 16px;
  background: var(--well, #2a2a32);
  border-bottom: 1px solid var(--line, #474750);
  font-weight: 600;
  color: var(--text, #edebe8);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.total-tag {
  font-size: 0.8rem;
  color: var(--accent, #fbbf24);
  font-weight: 500;
}

.table-scroll {
  overflow-y: auto;
}

.zonal-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}

.zonal-table th {
  background: var(--raised, #3b3b45);
  padding: 8px 12px;
  text-align: left;
  font-weight: 600;
  color: var(--muted, #bebdbd);
  border-bottom: 1px solid var(--line, #474750);
}

.zonal-table td {
  padding: 6px 12px;
  border-bottom: 1px solid var(--line-soft, #3d3d46);
  color: var(--text, #edebe8);
}

.zonal-table tr:hover td {
  background: color-mix(in srgb, var(--raised, #3b3b45) 50%, transparent);
}

.num {
  text-align: right;
  font-family: var(--ui-font-family);
  font-variant-numeric: tabular-nums;
}

.zone-range {
  font-weight: 500;
}

.bar-cell {
  width: 180px;
}

.bar-track {
  width: 100%;
  height: 6px;
  background: var(--well, #2a2a32);
  border-radius: 3px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  background: var(--accent, #fbbf24);
  border-radius: 3px;
}
</style>
