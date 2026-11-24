<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import type { PhotometricData } from "../core/types";

const props = defineProps<{
  data: PhotometricData | null;
}>();

const mountingHeight = ref(8); // in meters or feet
const units = ref<"fc" | "lux">("fc");
const canvasRef = ref<HTMLCanvasElement>();
const hoveredPoint = ref<{ x: number; y: number; val: number } | null>(null);

// Iso-illuminance threshold levels
const levels = computed(() => {
  return units.value === "fc"
    ? [5.0, 2.0, 1.0, 0.5, 0.2, 0.1, 0.05]
    : [50.0, 20.0, 10.0, 5.0, 2.0, 1.0, 0.5];
});

// Max ground illuminance
const maxGroundIlluminance = computed(() => {
  if (!props.data) return 0;
  const mh = Math.max(1, mountingHeight.value);
  const nadirCandela = (props.data.candela[0]?.[0] ?? 0) * props.data.multiplier;
  return Math.round((nadirCandela / (mh * mh)) * 100) / 100;
});

function drawTemplate() {
  const canvas = canvasRef.value;
  if (!canvas || !props.data) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const mh = Math.max(1, mountingHeight.value);
  const mhPx = w / 9; // 1 MH is w/9 pixels (grid spans -4 to +4 MH)

  const numV = props.data.verticalAngles.length;
  const numH = props.data.horizontalAngles.length;
  const mult = props.data.multiplier;

  function getCandela(vDeg: number, hDeg: number): number {
    if (!props.data) return 0;
    // Normalize hDeg to 0..360
    let normH = ((hDeg % 360) + 360) % 360;
    // Map symmetry if necessary
    const maxH = props.data.horizontalAngles[numH - 1] || 0;
    if (maxH === 90) {
      if (normH > 180) normH = 360 - normH;
      if (normH > 90) normH = 180 - normH;
    } else if (maxH === 180) {
      if (normH > 180) normH = 360 - normH;
    }

    // Nearest or linear interpolation in V
    let vIdx = 0;
    for (let i = 0; i < numV - 1; i++) {
      if (props.data.verticalAngles[i] <= vDeg && props.data.verticalAngles[i + 1] >= vDeg) {
        vIdx = i;
        break;
      }
    }

    // Nearest in H
    let hIdx = 0;
    let minHDist = 999;
    for (let i = 0; i < numH; i++) {
      const dist = Math.abs(props.data.horizontalAngles[i] - normH);
      if (dist < minHDist) {
        minHDist = dist;
        hIdx = i;
      }
    }

    return (props.data.candela[hIdx]?.[vIdx] ?? 0) * mult;
  }

  // Draw heatmap pixels
  const imgData = ctx.createImageData(w, h);
  const data = imgData.data;
  const maxE = Math.max(0.1, maxGroundIlluminance.value);

  const step = 2; // draw at 2px resolution for smoothness
  for (let py = 0; py < h; py += step) {
    for (let px = 0; px < w; px += step) {
      const dxMH = (px - cx) / mhPx;
      const dyMH = (cy - py) / mhPx; // inverted Y
      const distMH = Math.sqrt(dxMH * dxMH + dyMH * dyMH);
      const thetaRad = Math.atan(distMH);
      const thetaDeg = (thetaRad * 180) / Math.PI;

      if (thetaDeg >= 89) continue;

      let psiDeg = (Math.atan2(dxMH, dyMH) * 180) / Math.PI;
      if (psiDeg < 0) psiDeg += 360;

      const I = getCandela(thetaDeg, psiDeg);
      const cosTheta = Math.cos(thetaRad);
      const E = (I * Math.pow(cosTheta, 3)) / (mh * mh);

      const ratio = Math.min(1.0, E / maxE);
      // Heatmap gradient: dark purple -> blue -> cyan -> green -> yellow -> red
      let r = 0, g = 0, b = 0, a = 0;
      if (ratio > 0.005) {
        a = Math.min(230, Math.floor(ratio * 300) + 20);
        if (ratio < 0.25) {
          const t = ratio / 0.25;
          r = Math.floor(20 * (1 - t) + 0 * t);
          g = Math.floor(30 * (1 - t) + 160 * t);
          b = Math.floor(100 * (1 - t) + 220 * t);
        } else if (ratio < 0.5) {
          const t = (ratio - 0.25) / 0.25;
          r = 0;
          g = Math.floor(160 * (1 - t) + 220 * t);
          b = Math.floor(220 * (1 - t) + 80 * t);
        } else if (ratio < 0.75) {
          const t = (ratio - 0.5) / 0.25;
          r = Math.floor(220 * t);
          g = Math.floor(220 * (1 - t) + 200 * t);
          b = 40;
        } else {
          const t = (ratio - 0.75) / 0.25;
          r = 255;
          g = Math.floor(200 * (1 - t));
          b = 40;
        }
      }

      for (let sy = 0; sy < step; sy++) {
        for (let sx = 0; sx < step; sx++) {
          const idx = ((py + sy) * w + (px + sx)) * 4;
          if (idx < data.length) {
            data[idx] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
            data[idx + 3] = a;
          }
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Draw MH Grid Lines
  ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);

  for (let m = -4; m <= 4; m++) {
    const x = cx + m * mhPx;
    const y = cy + m * mhPx;

    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Draw concentric circles for 1MH, 2MH, 3MH, 4MH
  ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
  for (let m = 1; m <= 4; m++) {
    ctx.beginPath();
    ctx.arc(cx, cy, m * mhPx, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.setLineDash([]);

  // Draw Axes
  ctx.strokeStyle = "rgba(217, 119, 6, 0.75)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, cy);
  ctx.lineTo(w, cy);
  ctx.moveTo(cx, 0);
  ctx.lineTo(cx, h);
  ctx.stroke();

  // Draw Grid Labels
  ctx.fillStyle = "#a1a1aa";
  ctx.font = "11px monospace";
  ctx.textAlign = "center";
  for (let m = -4; m <= 4; m++) {
    if (m === 0) continue;
    const x = cx + m * mhPx;
    ctx.fillText(`${m}MH`, x, cy + 14);
    const y = cy - m * mhPx;
    ctx.fillText(`${m}MH`, cx + 18, y + 4);
  }

  // Nadir marker
  ctx.fillStyle = "#ef4444";
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fill();
}

function handleMouseMove(e: MouseEvent) {
  const canvas = canvasRef.value;
  if (!canvas || !props.data) return;
  const rect = canvas.getBoundingClientRect();
  const px = e.clientX - rect.left;
  const py = e.clientY - rect.top;

  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const mh = Math.max(1, mountingHeight.value);
  const mhPx = w / 9;

  const dxMH = (px - cx) / mhPx;
  const dyMH = (cy - py) / mhPx;
  const distMH = Math.sqrt(dxMH * dxMH + dyMH * dyMH);
  const thetaRad = Math.atan(distMH);
  const thetaDeg = (thetaRad * 180) / Math.PI;

  let psiDeg = (Math.atan2(dxMH, dyMH) * 180) / Math.PI;
  if (psiDeg < 0) psiDeg += 360;

  const cosTheta = Math.cos(thetaRad);
  const I = props.data.calculated.maxCandela.intensity * 0.75;
  const E = (I * Math.pow(cosTheta, 3)) / (mh * mh);

  hoveredPoint.value = {
    x: Math.round(dxMH * 10) / 10,
    y: Math.round(dyMH * 10) / 10,
    val: Math.round(E * 100) / 100,
  };
}

onMounted(() => {
  drawTemplate();
});

watch([() => props.data, mountingHeight, units], () => {
  drawTemplate();
});
</script>

<template>
  <div class="template-viewer-container">
    <div class="template-toolbar">
      <div class="control-group">
        <label>Mounting Height (MH):</label>
        <input
          v-model.number="mountingHeight"
          type="number"
          min="1"
          max="50"
          step="0.5"
          class="mh-input"
        />
        <span class="unit-tag">{{ units === 'fc' ? 'ft' : 'm' }}</span>
      </div>

      <div class="control-group">
        <label>Units:</label>
        <div class="segmented-control">
          <button :class="{ active: units === 'fc' }" @click="units = 'fc'">Footcandles (fc)</button>
          <button :class="{ active: units === 'lux' }" @click="units = 'lux'">Lux (lx)</button>
        </div>
      </div>

      <div class="stat-badge">
        <span>Nadir Max: <strong>{{ maxGroundIlluminance }} {{ units }}</strong></span>
      </div>

      <div v-if="hoveredPoint" class="stat-badge cursor-badge">
        <span>Cursor: <strong>X: {{ hoveredPoint.x }}MH, Y: {{ hoveredPoint.y }}MH ({{ hoveredPoint.val }} {{ units }})</strong></span>
      </div>
    </div>

    <div class="canvas-wrap">
      <canvas
        ref="canvasRef"
        width="600"
        height="600"
        class="template-canvas"
        @mousemove="handleMouseMove"
        @mouseleave="hoveredPoint = null"
      />

      <div class="legend-card">
        <div class="legend-title">Illuminance ({{ units }})</div>
        <div class="legend-gradient" />
        <div class="legend-labels">
          <span>0</span>
          <span>{{ (maxGroundIlluminance * 0.25).toFixed(1) }}</span>
          <span>{{ (maxGroundIlluminance * 0.5).toFixed(1) }}</span>
          <span>{{ (maxGroundIlluminance * 0.75).toFixed(1) }}</span>
          <span>{{ maxGroundIlluminance.toFixed(1) }}</span>
        </div>
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
  font-size: 0.82rem;
  color: var(--text);
}

.mh-input {
  width: 64px;
  padding: 4px 8px;
  background: var(--raised);
  border: 1px solid var(--line);
  border-radius: var(--control-radius);
  color: var(--text);
  font-family: monospace;
}

.unit-tag {
  color: var(--muted);
  font-size: 0.8rem;
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
  font-size: 0.78rem;
  color: var(--muted);
  cursor: pointer;
}

.segmented-control button.active {
  background: var(--accent);
  color: #fff;
  font-weight: 500;
}

.stat-badge {
  font-size: 0.8rem;
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
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  background: #141419;
  border: 1px solid var(--line);
  border-radius: var(--control-radius);
  overflow: hidden;
}

.template-canvas {
  width: min(75vh, 600px);
  height: min(75vh, 600px);
  border-radius: 4px;
  cursor: crosshair;
}

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
  font-size: 0.75rem;
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
  font-size: 0.68rem;
  color: var(--hint);
  font-family: monospace;
}
</style>
