<script setup lang="ts">
import AppIcon from "./AppIcon.vue";
defineProps<{ zoom: number }>();
defineEmits<{ zoomIn: []; zoomOut: []; fit: [] }>();
</script>
<template>
  <div class="plot-zoom-controls" role="group" aria-label="Plot zoom">
    <button aria-label="Zoom Out" title="Zoom Out" :disabled="zoom <= .4" @click="$emit('zoomOut')"><AppIcon name="minus" :size="14" /></button>
    <output aria-label="Zoom level">{{ Math.round(zoom * 100) }}%</output>
    <button aria-label="Zoom In" title="Zoom In" :disabled="zoom >= 5" @click="$emit('zoomIn')"><AppIcon name="plus" :size="14" /></button>
    <button class="plot-fit" title="Reset Zoom and Pan (Fit)" @click="$emit('fit')"><AppIcon name="reset" :size="14" />Fit</button>
  </div>
</template>
<style scoped>
.plot-zoom-controls { display: inline-flex; align-items: center; gap: 3px; padding: 3px; background: var(--panel); border: 1px solid var(--line); border-radius: var(--control-radius); flex-shrink: 0; }
button { display: inline-flex; align-items: center; justify-content: center; gap: 5px; min-width: 28px; min-height: 28px; padding: 3px; background: var(--well); border: 1px solid var(--line); border-radius: 3px; color: var(--text); font: inherit; cursor: pointer; }
button:hover:not(:disabled) { background: var(--raised); color: var(--accent); border-color: var(--accent); }
button:disabled { opacity: .4; cursor: default; }
output { min-width: 48px; text-align: center; font-variant-numeric: tabular-nums; }
.plot-fit { padding-inline: 8px; }
</style>
