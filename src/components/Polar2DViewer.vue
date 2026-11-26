<script setup lang="ts">
import { computed, ref, watch } from "vue";
import PlotZoomControls from "./PlotZoomControls.vue";
import { useSvgViewport } from "../composables/useSvgViewport";
import { createCandelaSampler } from "../core/photometricSampling";
import type { PhotometricData } from "../core/types";

const props = withDefaults(
  defineProps<{
    data: PhotometricData | null;
    activePlane?: "all" | "max" | "0" | "90";
    initialPlotMode?: "polar" | "cartesian";
  }>(),
  {
    activePlane: "all",
    initialPlotMode: "polar",
  }
);

const currentPlane = ref<"all" | "max" | "0" | "90">(props.activePlane);
const plotMode = computed(() => props.initialPlotMode);
const hoveredPoint = ref<{ angle: number; cd: number; plane: string; x: number; y: number } | null>(null);

const cameraSize = computed(() => plotMode.value === "polar" ? { width: 500, height: 500 } : { width: 640, height: 400 });
const { svg, zoom: zoomLevel, viewBox, isPanning, point: eventPoint, wheel, pointerDown, pointerMove, pointerUp, fit, zoomIn, zoomOut } = useSvgViewport(cameraSize);
function beginPan(event: PointerEvent) { hoveredPoint.value = null; pointerDown(event); }

watch(
  () => props.activePlane,
  (val) => {
    if (val) currentPlane.value = val;
  }
);

const maxVal = computed(() => {
  return Math.max(1, props.data?.calculated.maxCandela.intensity ?? 100);
});

// Polar plot dimensions
const cx = 250;
const cy = 250;
const rMax = 200;

// Grid rings (25%, 50%, 75%, 100%)
const rings = computed(() => [
  { val: Math.round(maxVal.value * 0.25), r: rMax * 0.25 },
  { val: Math.round(maxVal.value * 0.5), r: rMax * 0.5 },
  { val: Math.round(maxVal.value * 0.75), r: rMax * 0.75 },
  { val: Math.round(maxVal.value), r: rMax },
]);

// Angle radial lines (0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180 deg)
const angleLines = computed(() => {
  const angles = [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180];
  return angles.map((deg) => {
    // Nadir (0 deg) is straight down (angle = PI/2 in standard trig)
    const rad = (deg * Math.PI) / 180 + Math.PI / 2;
    return {
      deg,
      x: cx + rMax * Math.cos(rad),
      y: cy + rMax * Math.sin(rad),
      labelX: cx + (rMax + 16) * Math.cos(rad),
      labelY: cy + (rMax + 16) * Math.sin(rad),
    };
  });
});

// Convert (vertical_angle, candela) to (x, y) coordinates for Polar
function polarToCartesian(vDeg: number, cd: number, sign: 1 | -1 = 1) {
  const radius = (cd / maxVal.value) * rMax;
  // sign: 1 for right hemisphere (0 to 180), -1 for left hemisphere
  const rad = ((vDeg * sign) * Math.PI) / 180 + Math.PI / 2;
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  };
}

// Cartesian X-Y Plot Geometry
const cartWidth = 640;
const cartHeight = 400;
const padL = 70;
const padR = 30;
const padT = 30;
const padB = 50;
const plotW = cartWidth - padL - padR;
const plotH = cartHeight - padT - padB;

const maxVAngle = computed(() => {
  if (!props.data) return 180;
  const v = props.data.verticalAngles;
  return v[v.length - 1] > 90 ? 180 : 90;
});

const cartYTicks = computed(() => {
  return [
    { val: 0, y: padT + plotH },
    { val: Math.round(maxVal.value * 0.25), y: padT + plotH * 0.75 },
    { val: Math.round(maxVal.value * 0.5), y: padT + plotH * 0.5 },
    { val: Math.round(maxVal.value * 0.75), y: padT + plotH * 0.25 },
    { val: Math.round(maxVal.value), y: padT },
  ];
});

const cartXTicks = computed(() => {
  const step = maxVAngle.value === 180 ? 30 : 15;
  const ticks = [];
  for (let a = 0; a <= maxVAngle.value; a += step) {
    const x = padL + (a / maxVAngle.value) * plotW;
    ticks.push({ angle: a, x });
  }
  return ticks;
});

// Generate paths for both Polar and Cartesian
const sampler = computed(() => props.data ? createCandelaSampler(props.data) : null);
const allCurves = computed(() => {
  if (!props.data || !sampler.value) return [];
  const sample = sampler.value;
  const maximumPlane = props.data.calculated.maxCandela.horizontalAngle;
  const angles = Array.from({length: maxVAngle.value / 2.5 + 1}, (_,i) => i*2.5);
  return [
    {id:'max', name:`Max Plane (${maximumPlane}°)`, cPlane:maximumPlane, color:'var(--graph-curve-max)', dash:''},
    {id:'0', name:'0° Transverse', cPlane:0, color:'var(--graph-curve-0)', dash:'5,3'},
    {id:'90', name:'90° Longitudinal', cPlane:90, color:'var(--graph-curve-90)', dash:'2,2'}
  ].map(plane => {
    const points = angles.map(angle => polarToCartesian(angle, sample(angle,plane.cPlane),1));
    const opposite = [...angles].reverse().map(angle => polarToCartesian(angle,sample(angle,(plane.cPlane+180)%360),-1));
    const polarPath = [...points,...opposite].map((p,i) => `${i?'L':'M'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')+' Z';
    const cartPath = angles.map((angle,i) => `${i?'L':'M'} ${(padL+angle/maxVAngle.value*plotW).toFixed(2)} ${(padT+(1-sample(angle,plane.cPlane)/maxVal.value)*plotH).toFixed(2)}`).join(' ');
    return {...plane,polarPath,cartPath,peakCd:Math.round(Math.max(...angles.map(angle=>sample(angle,plane.cPlane))))};
  });
});

const visibleCurves = computed(() => {
  if (currentPlane.value === "all") return allCurves.value;
  return allCurves.value.filter((c) => c.id === currentPlane.value);
});

function handleCartesianMouseMove(e: PointerEvent) {
  pointerMove(e);
  if (!props.data || plotMode.value !== "cartesian" || isPanning.value) return;
  const point = eventPoint(e);
  if (!point) return;
  const mouseX = point.x, mouseY = point.y;

  if (mouseX < padL || mouseX > padL + plotW || mouseY < padT || mouseY > padT + plotH) {
    hoveredPoint.value = null;
    return;
  }

  // Fraction of X axis
  const fracX = (mouseX - padL) / plotW;
  const angle = Math.round(fracX * maxVAngle.value);

  const activeCurve = visibleCurves.value[0] || allCurves.value[0];
  const cd = Math.round(sampler.value?.(angle, activeCurve.cPlane) ?? 0);
  hoveredPoint.value = {angle, cd, plane:activeCurve.name, x:padL+angle/maxVAngle.value*plotW, y:padT+(1-cd/maxVal.value)*plotH};
}

function handleCartesianMouseLeave() {
  hoveredPoint.value = null;
}
</script>

<template>
  <div class="polar-viewer-container">
    <!-- Top Control Bar: Graph Mode, Plane Switcher & Zoom Controls -->
    <div class="top-controls-bar">
      <PlotZoomControls :zoom="zoomLevel" @zoom-in="zoomIn" @zoom-out="zoomOut" @fit="fit" />
    </div>

    <!-- Zoomable & Pannable Graph Canvas Viewport -->
    <div
      class="graph-viewport"
      :class="{ grabbing: isPanning }"
    >
      <div class="graph-stage">
        <!-- 1. POLAR VIEW -->
        <div v-if="plotMode === 'polar'" class="polar-svg-wrap">
          <svg ref="svg" width="100%" height="100%" :viewBox="viewBox" class="polar-svg" role="img" aria-label="Vector polar candela distribution"
            @wheel.prevent="wheel" @pointerdown="beginPan" @pointermove="pointerMove" @pointerup="pointerUp" @pointercancel="pointerUp" @lostpointercapture="pointerUp">
            <!-- Concentric candela rings -->
            <g class="grid-rings">
              <circle
                v-for="ring in rings"
                :key="ring.r"
                :cx="cx"
                :cy="cy"
                :r="ring.r"
                fill="none"
                stroke="var(--graph-grid, #94a3b8)"
                stroke-width="1"
              />
              <text
                v-for="ring in rings"
                :key="'label-' + ring.r"
                :x="cx + 4"
                :y="cy - ring.r + 12"
                class="ring-text"
              >
                {{ ring.val }} cd
              </text>
            </g>

            <!-- Radial angle spokes -->
            <g class="grid-spokes">
              <line
                v-for="line in angleLines"
                :key="line.deg"
                :x1="cx"
                :y1="cy"
                :x2="line.x"
                :y2="line.y"
                stroke="var(--graph-grid-soft, #cbd5e1)"
                stroke-width="1"
                stroke-dasharray="2,4"
              />
              <text
                v-for="line in angleLines"
                :key="'deg-' + line.deg"
                :x="line.labelX"
                :y="line.labelY"
                text-anchor="middle"
                dominant-baseline="central"
                class="spoke-text"
              >
                {{ line.deg }}°
              </text>
            </g>

            <!-- Polar candela curves -->
            <g class="curves">
              <path
                v-for="c in visibleCurves"
                :key="c.name"
                :d="c.polarPath"
                fill="none"
                :stroke="c.color"
                stroke-width="2.4"
                :stroke-dasharray="c.dash"
              />
            </g>

            <!-- Center origin dot -->
            <circle :cx="cx" :cy="cy" r="3.5" fill="var(--accent, #d97706)" />
          </svg>
        </div>

        <!-- 2. CARTESIAN X-Y VIEW -->
        <div v-else class="cartesian-svg-wrap">
          <svg
            ref="svg" width="100%" height="100%" :viewBox="viewBox"
            role="img" aria-label="Vector Cartesian candela distribution"
            @wheel.prevent="wheel" @pointerdown="beginPan" @pointerup="pointerUp" @pointercancel="pointerUp" @lostpointercapture="pointerUp"
            class="cartesian-svg"
            @pointermove="handleCartesianMouseMove"
            @pointerleave="handleCartesianMouseLeave"
          >
            <!-- Background grid rectangle -->
            <rect
              :x="padL"
              :y="padT"
              :width="plotW"
              :height="plotH"
              fill="var(--graph-bg, #ffffff)"
              stroke="var(--line, #94a3b8)"
              stroke-width="1.2"
            />

            <!-- Y-Axis Grid Lines & Candela Labels -->
            <g class="grid-y">
              <g v-for="yt in cartYTicks" :key="yt.val">
                <line
                  :x1="padL"
                  :y1="yt.y"
                  :x2="padL + plotW"
                  :y2="yt.y"
                  stroke="var(--graph-grid-soft, #cbd5e1)"
                  stroke-width="1"
                  stroke-dasharray="2,4"
                />
                <text
                  :x="padL - 8"
                  :y="yt.y + 3"
                  text-anchor="end"
                  class="axis-tick-label"
                >
                  {{ yt.val }} cd
                </text>
              </g>
            </g>

            <!-- X-Axis Grid Lines & Angle Labels -->
            <g class="grid-x">
              <g v-for="xt in cartXTicks" :key="xt.angle">
                <line
                  :x1="xt.x"
                  :y1="padT"
                  :x2="xt.x"
                  :y2="padT + plotH"
                  stroke="var(--graph-grid-soft, #cbd5e1)"
                  stroke-width="1"
                  stroke-dasharray="2,4"
                />
                <text
                  :x="xt.x"
                  :y="padT + plotH + 18"
                  text-anchor="middle"
                  class="axis-tick-label"
                >
                  {{ xt.angle }}°
                </text>
              </g>
            </g>

            <!-- Axis Titles -->
            <text
              :x="padL + plotW / 2"
              :y="cartHeight - 10"
              text-anchor="middle"
              class="axis-title"
            >
              Vertical Angle (0° = Nadir, 90° = Horizontal, 180° = Zenith)
            </text>

            <text
              :x="16"
              :y="padT + plotH / 2"
              text-anchor="middle"
              :transform="`rotate(-90 16 ${padT + plotH / 2})`"
              class="axis-title"
            >
              Luminous Intensity (Candela)
            </text>

            <!-- Candela Curves -->
            <g class="curves">
              <path
                v-for="c in visibleCurves"
                :key="c.name"
                :d="c.cartPath"
                fill="none"
                :stroke="c.color"
                stroke-width="2.4"
                :stroke-dasharray="c.dash"
              />
            </g>

            <!-- Interactive Crosshair & Tooltip -->
            <g v-if="hoveredPoint" class="hover-overlay">
              <line
                :x1="hoveredPoint.x"
                :y1="padT"
                :x2="hoveredPoint.x"
                :y2="padT + plotH"
                stroke="var(--accent, #d97706)"
                stroke-width="1"
                stroke-dasharray="2,2"
              />
              <circle
                :cx="hoveredPoint.x"
                :cy="hoveredPoint.y"
                r="4.5"
                fill="var(--accent, #d97706)"
                stroke="var(--panel, #ffffff)"
                stroke-width="1.5"
              />
              <!-- Tooltip Box -->
              <rect
                :x="Math.min(padL + plotW - 130, Math.max(padL + 10, hoveredPoint.x - 65))"
                :y="Math.max(padT + 10, hoveredPoint.y - 45)"
                width="130"
                height="36"
                rx="4"
                fill="var(--panel, #ffffff)"
                stroke="var(--line, #cbd5e1)"
                filter="drop-shadow(0 2px 5px rgba(0,0,0,0.2))"
              />
              <text
                :x="Math.min(padL + plotW - 65, Math.max(padL + 75, hoveredPoint.x))"
                :y="Math.max(padT + 10, hoveredPoint.y - 45) + 14"
                text-anchor="middle"
                class="tooltip-text-primary"
              >
                {{ hoveredPoint.angle }}°: {{ hoveredPoint.cd }} cd
              </text>
              <text
                :x="Math.min(padL + plotW - 65, Math.max(padL + 75, hoveredPoint.x))"
                :y="Math.max(padT + 10, hoveredPoint.y - 45) + 28"
                text-anchor="middle"
                class="tooltip-text-secondary"
              >
                {{ hoveredPoint.plane }}
              </text>
            </g>
          </svg>
        </div>
      </div>
    </div>

    <!-- Polar / Cartesian Legend & Summary Stats -->
    <div class="polar-legend">
      <div
        v-for="c in allCurves"
        :key="c.name"
        class="legend-item"
        :title="`${c.peakCd} cd peak`"
        :class="{ inactive: currentPlane !== 'all' && currentPlane !== c.id }"
      >
        <span class="legend-color-swatch" :style="{ background: c.color }"></span>
        <span class="legend-name">{{ c.name }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.polar-viewer-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
  height: 100%;
  padding: 16px;
  background: var(--workspace, #26262d);
  overflow: hidden;
}

.top-controls-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
  justify-content: center;
  z-index: 10;
  flex-shrink: 0;
}

.plot-mode-group {
  display: flex;
  background: var(--well);
  border: 1px solid var(--line);
  border-radius: var(--control-radius);
  padding: 2px;
  gap: 2px;
}

.mode-btn {
  background: transparent;
  border: none;
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 500;
  padding: 4px 12px;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.mode-btn:hover {
  color: var(--text);
  background: var(--raised);
}

.mode-btn.active {
  background: var(--accent);
  color: #ffffff;
  font-weight: 600;
}

.plane-switcher-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--panel);
  padding: 3px 8px;
  border-radius: var(--control-radius);
  border: 1px solid var(--line);
}

.switcher-label {
  font-size: 0.8rem;
  color: var(--muted);
  font-weight: 600;
  margin-right: 2px;
}

.plane-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--well);
  border: 1px solid var(--line);
  color: var(--text);
  font-size: 0.75rem;
  padding: 3px 8px;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.15s ease;
  font-weight: 500;
}

.plane-pill:hover {
  background: var(--raised);
  color: var(--accent);
  border-color: var(--accent);
}

.plane-pill.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #ffffff;
  font-weight: 600;
}

.color-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  box-shadow: 0 0 2px rgba(0,0,0,0.3);
}

/* Zoomable & Pannable Viewport */
.graph-viewport {
  flex: 1;
  width: 100%;
  min-height: 0;
  container-type: size;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  cursor: grab;
  user-select: none;
}

.graph-viewport.grabbing, .graph-viewport.grabbing svg {
  cursor: grabbing;
}

.graph-stage {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.polar-svg-wrap {
  width: 100%;
  height: 100%;
  flex-shrink: 0;
}

.polar-svg, .cartesian-svg { touch-action: none; }
.polar-svg :is(path, line, circle, rect), .cartesian-svg :is(path, line, circle, rect) { vector-effect: non-scaling-stroke; }

.polar-svg {
  width: 100%;
  height: 100%;
}

.cartesian-svg-wrap {
  width: 100%;
  height: 100%;
  flex-shrink: 0;
}

.cartesian-svg {
  width: 100%;
  height: 100%;
  cursor: crosshair;
}

.ring-text,
.axis-tick-label {
  font-size: 10px;
  fill: var(--muted);
  font-family: var(--ui-font-family);
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}

.spoke-text {
  font-size: 10px;
  fill: var(--text);
  font-weight: 600;
}

.axis-title {
  font-size: 11px;
  fill: var(--text);
  font-weight: 600;
  letter-spacing: 0.02em;
}

.tooltip-text-primary {
  font-size: 11px;
  font-weight: 700;
  fill: var(--text);
  font-family: var(--ui-font-family);
  font-variant-numeric: tabular-nums;
}

.tooltip-text-secondary {
  font-size: 9.5px;
  fill: var(--muted);
  font-weight: 500;
}

.polar-legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  flex-shrink: 0;
  gap: 4px 12px;
  margin-top: 6px;
  padding: 4px 8px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--control-radius);
  z-index: 10;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  color: var(--text);
  padding: 2px 6px;
  border-radius: 3px;
  transition: opacity 0.15s ease;
  font-weight: 500;
}

.legend-item.inactive {
  opacity: 0.35;
}

.legend-color-swatch {
  width: 14px;
  height: 4px;
  border-radius: 2px;
}

.legend-val {
  font-family: var(--ui-font-family);
  font-variant-numeric: tabular-nums;
  font-size: 0.75rem;
  color: var(--muted);
}
</style>
