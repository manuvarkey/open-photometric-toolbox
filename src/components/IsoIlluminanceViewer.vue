<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import PlotZoomControls from "./PlotZoomControls.vue";
import { useSvgViewport } from "../composables/useSvgViewport";
import type { PhotometricData } from "../core/types";
import { illuminanceField } from "../composables/illuminanceCache";
const props = defineProps<{ data: PhotometricData | null; units: "fc" | "lux" }>();
const mountingHeight = defineModel<number>("mountingHeight", { required: true });
const field = computed(() => props.data ? illuminanceField(props.data) : null);
const height = computed(() => Math.max(.01, Number(mountingHeight.value) || .01));
const maximum = computed(() => (field.value?.maximum ?? 0) / height.value ** 2);
const hoveredPoint = ref<{x:number;y:number;val:number} | null>(null);
const { svg, zoom, viewBox, isPanning, point: eventPoint, wheel, pointerDown, pointerMove, pointerUp, fit, zoomIn, zoomOut } = useSvgViewport(computed(() => ({width:600,height:600})));
function beginPan(event: PointerEvent) { leave(); pointerDown(event); }
const colors = ['#283e83','#285ca0','#167fbd','#149eac','#259b79','#83b736','#e8cb36','#ef9430','#dc4c3a'];
let frame = 0;
let pending: {x:number;y:number} | null = null;
function handlePointer(event: PointerEvent) {
  pointerMove(event);
  if (isPanning.value) return;
  const point = eventPoint(event);
  if (!point || point.x < 0 || point.x > 600 || point.y < 0 || point.y > 600) { leave(); return; }
  pending = { x: (point.x - 300) / (600 / 9), y: (300 - point.y) / (600 / 9) };
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    if (pending && field.value) hoveredPoint.value = { ...pending, val: field.value.at(pending.x, pending.y) / height.value ** 2 };
  });
}
function leave() { pending = null; hoveredPoint.value = null; cancelAnimationFrame(frame); frame = 0; }
watch(() => props.units, (next, previous) => {
  if (next !== previous) mountingHeight.value = mountingHeight.value * (next === 'lux' ? .3048 : 1 / .3048);
  leave();
});
watch(() => props.data, leave);
onBeforeUnmount(leave);
</script>

<template>
  <div class="template-viewer-container">
    <div class="template-toolbar">
      <PlotZoomControls :zoom="zoom" @zoom-in="zoomIn" @zoom-out="zoomOut" @fit="fit" />
      <div class="control-group"><label for="iso-field-1">Mounting Height (MH):</label>
        <input id="iso-field-1" v-model.number="mountingHeight" type="number" min="0.01" max="1000" step="0.1" class="mh-input" />
        <span class="unit-tag">{{ units === 'fc' ? 'ft' : 'm' }}</span>
      </div>
      <div class="stat-badge">Peak: <strong>{{ maximum.toFixed(2) }} {{ units }}</strong></div>
      <div v-if="hoveredPoint" class="stat-badge cursor-badge">Cursor: <strong>{{ hoveredPoint.x.toFixed(1) }}MH, {{ hoveredPoint.y.toFixed(1) }}MH · {{ hoveredPoint.val.toFixed(2) }} {{ units }}</strong></div>
    </div>
    <div class="canvas-wrap">
      <svg ref="svg" :viewBox="viewBox" class="template-svg" :class="{grabbing:isPanning}" role="img" aria-label="Vector iso-illuminance contours in mounting-height coordinates" @wheel.prevent="wheel" @pointerdown="beginPan" @pointermove="handlePointer" @pointerleave="leave" @pointerup="pointerUp" @pointercancel="pointerUp" @lostpointercapture="pointerUp">
        <defs><clipPath id="illuminance-clip"><rect width="600" height="600" /></clipPath></defs>
        <rect width="600" height="600" fill="var(--graph-bg)" />
        <g clip-path="url(#illuminance-clip)">
          <path v-for="(band,index) in field?.bands ?? []" :key="band.value" :d="band.path" :fill="colors[index]" fill-rule="evenodd" stroke="var(--graph-grid)" stroke-width="0.5" vector-effect="non-scaling-stroke"><title>{{ (band.value / height ** 2).toFixed(3) }} {{ units }}</title></path>
          <g v-for="m in 9" :key="m" stroke="var(--graph-grid)" stroke-width=".6" stroke-dasharray="3 5" fill="none">
            <line :x1="300+(m-5)*600/9" y1="0" :x2="300+(m-5)*600/9" y2="600" />
            <line x1="0" :y1="300+(m-5)*600/9" x2="600" :y2="300+(m-5)*600/9" />
          </g>
          <circle v-for="m in 4" :key="m" cx="300" cy="300" :r="m*600/9" fill="none" stroke="var(--graph-grid)" stroke-width=".6" />
        </g>
        <path d="M0 300H600M300 0V600" stroke="var(--accent)" stroke-width="1" />
        <g v-for="m in [-4,-3,-2,-1,1,2,3,4]" :key="m" fill="var(--text)" style="font-size: var(--text-size-display)">
          <text :x="300+m*600/9" y="316" text-anchor="middle">{{ m }}MH</text>
          <text x="306" :y="300-m*600/9-5">{{ m }}MH</text>
        </g>
        <circle cx="300" cy="300" r="3" fill="var(--accent)" />
      </svg>
      <div class="legend-card">
        <div class="legend-title">Illuminance ({{ units }})</div><div class="legend-gradient" />
        <div class="legend-labels"><span v-for="fraction in [0,.25,.5,.75,1]" :key="fraction">{{ (maximum*fraction).toFixed(1) }}</span></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.template-viewer-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 12px;
  gap: 12px;
  background: var(--workspace);
  overflow: hidden;
}

.template-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  background: var(--well);
  border: 1px solid var(--line-soft);
  padding: 8px 14px;
  border-radius: var(--control-radius);
  flex-wrap: wrap;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--text-size-caption);
  color: var(--text);
}

.mh-input {
  width: 64px;
  padding: 4px 8px;
  background: var(--raised);
  border: 1px solid var(--line);
  border-radius: var(--control-radius);
  color: var(--text);
  font-family: var(--ui-font-family);
  font-variant-numeric: tabular-nums;
}

.unit-tag {
  color: var(--muted);
  font-size: var(--text-size-caption);
}

.segmented-control {
  display: flex;
  background: var(--panel);
  border: 1px solid var(--line-soft);
  border-radius: var(--control-radius);
  overflow: hidden;
}

.segmented-control button {
  padding: 4px 10px;
  border: 0;
  background: none;
  font-size: var(--text-size-caption);
  color: var(--muted);
  cursor: pointer;
}

.segmented-control button.active {
  background: var(--accent);
  color: #fff;
  font-weight: 500;
}

.stat-badge {
  font-size: var(--text-size-caption);
  padding: 4px 10px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--control-radius);
  color: var(--muted);
}

.stat-badge strong {
  color: var(--text);
}

.cursor-badge {
  border-color: var(--accent);
  color: var(--accent);
}

.canvas-wrap {
  flex: 1;
  min-height: 0;
  container-type: size;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  background: var(--graph-bg);
  border: 1px solid var(--line);
  border-radius: var(--control-radius);
  overflow: hidden;
}

.template-svg {
  width: 100%;
  height: 100%;
  touch-action: none;
  border-radius: 4px;
  cursor: grab;
}
.template-svg.grabbing { cursor: grabbing; }

.legend-card {
  position: absolute;
  bottom: 16px;
  right: 16px;
  background: rgba(24, 24, 31, 0.88);
  backdrop-filter: blur(4px);
  border: 1px solid var(--line);
  border-radius: var(--control-radius);
  padding: 10px 14px;
  width: 220px;
}

.legend-title {
  font-size: var(--text-size-caption);
  color: var(--muted);
  margin-bottom: 6px;
  font-weight: 500;
}

.legend-gradient {
  height: 12px;
  border-radius: 3px;
  background: linear-gradient(to right, #141e64, #00a0dc, #00dc50, #dcdc28, #ff2828);
  margin-bottom: 4px;
}

.legend-labels {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-size-caption);
  color: var(--hint);
  font-family: var(--ui-font-family);
  font-variant-numeric: tabular-nums;
}
</style>
