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

const angleLines = Array.from({ length: 24 }, (_, index) => {
  const deg = index * 15;
  // Nadir is straight down in SVG coordinates.
  const rad = (deg * Math.PI) / 180 + Math.PI / 2;
  return {
    deg,
    x: cx + rMax * Math.cos(rad),
    y: cy + rMax * Math.sin(rad),
    labelX: cx + (rMax + 16) * Math.cos(rad),
    labelY: cy + (rMax + 16) * Math.sin(rad),
  };
});

function polarToCartesian(angle: number, cd: number) {
  const radius = (cd / maxVal.value) * rMax;
  const rad = (angle * Math.PI) / 180 + Math.PI / 2;
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

const fullCircle = 360;
const cartX = (angle: number) => padL + (angle / fullCircle) * plotW;

const cartYTicks = computed(() => {
  return [
    { val: 0, y: padT + plotH },
    { val: Math.round(maxVal.value * 0.25), y: padT + plotH * 0.75 },
    { val: Math.round(maxVal.value * 0.5), y: padT + plotH * 0.5 },
    { val: Math.round(maxVal.value * 0.75), y: padT + plotH * 0.25 },
    { val: Math.round(maxVal.value), y: padT },
  ];
});

const cartXTicks = Array.from({ length: 13 }, (_, index) => {
  const angle = index * 30;
  return { angle, x: cartX(angle) };
});

const sampler = computed(() => props.data ? createCandelaSampler(props.data) : null);
// A full cut uses the selected C-plane to zenith and the opposite C-plane back to nadir.
function samplePlane(angle: number, cPlane: number) {
  return angle <= 180
    ? sampler.value?.(angle, cPlane) ?? 0
    : sampler.value?.(fullCircle - angle, cPlane + 180) ?? 0;
}

const allCurves = computed(() => {
  if (!props.data || !sampler.value) return [];
  const maximumPlane = props.data.calculated.maxCandela.horizontalAngle;
  const angles = new Set(Array.from({ length: fullCircle / 2.5 + 1 }, (_, index) => index * 2.5));
  const measured = props.data.verticalAngles;
  for (const gamma of [...measured, measured[0] - 0.001, measured[measured.length - 1] + 0.001]) {
    if (gamma < 0 || gamma > 180) continue;
    angles.add(gamma);
    angles.add(fullCircle - gamma);
  }
  const orderedAngles = [...angles].sort((a, b) => a - b);
  return [
    {id:'max', name:`Max Plane (${maximumPlane}°)`, cPlane:maximumPlane, color:'var(--graph-curve-max)', dash:''},
    {id:'0', name:'0° Transverse', cPlane:0, color:'var(--graph-curve-0)', dash:'5,3'},
    {id:'90', name:'90° Longitudinal', cPlane:90, color:'var(--graph-curve-90)', dash:'2,2'}
  ].map(plane => {
    const values = orderedAngles.map(angle => ({ angle, cd: samplePlane(angle, plane.cPlane) }));
    const polarPath = values.map(({ angle, cd }, index) => {
      const { x, y } = polarToCartesian(angle, cd);
      return `${index ? "L" : "M"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    }).join(" ") + " Z";
    const cartPath = values.map(({ angle, cd }, index) =>
      `${index ? "L" : "M"} ${cartX(angle).toFixed(2)} ${(padT + (1 - cd / maxVal.value) * plotH).toFixed(2)}`
    ).join(" ");
    const peakCd = Math.round(values.reduce((peak, { cd }) => Math.max(peak, cd), 0));
    return { ...plane, polarPath, cartPath, peakCd };
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
  const angle = Math.round(fracX * fullCircle);

  const activeCurve = visibleCurves.value[0] || allCurves.value[0];
  const cd = samplePlane(angle, activeCurve.cPlane);
  const plane = angle > 180 && angle < 360
    ? `C${(activeCurve.cPlane + 180) % 360}° (Opposite plane)`
    : activeCurve.name;
  hoveredPoint.value = { angle, cd: Math.round(cd), plane, x: cartX(angle), y: padT + (1 - cd / maxVal.value) * plotH };
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
              Angle Around Plane (0° / 360° = Nadir, 180° = Zenith)
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
  font-size: var(--text-size-caption);
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
  font-size: var(--text-size-caption);
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
  font-size: var(--text-size-caption);
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
  font-size: var(--text-size-caption);
  fill: var(--muted);
  font-family: var(--ui-font-family);
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}

.spoke-text {
  font-size: var(--text-size-caption);
  fill: var(--text);
  font-weight: 600;
}

.axis-title {
  font-size: var(--text-size-caption);
  fill: var(--text);
  font-weight: 600;
  letter-spacing: 0.02em;
}

.tooltip-text-primary {
  font-size: var(--text-size-caption);
  font-weight: 700;
  fill: var(--text);
  font-family: var(--ui-font-family);
  font-variant-numeric: tabular-nums;
}

.tooltip-text-secondary {
  font-size: var(--text-size-caption);
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
  font-size: var(--text-size-caption);
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
  font-size: var(--text-size-caption);
  color: var(--muted);
}
</style>
