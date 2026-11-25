<script setup lang="ts">
import { computed, ref } from "vue";
import { isTauri } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import AppIcon from "./AppIcon.vue";
import type { PhotometricData } from "../core/types";

const props = defineProps<{
  data: PhotometricData;
}>();

const activeReport = ref<"indoor" | "roadway" | "floodlight">("indoor");

// Report Title
const reportTitle = computed(() => {
  if (activeReport.value === "indoor") return "Indoor Photometric Luminaire Report";
  if (activeReport.value === "roadway") return "Roadway Luminaire Classification Report (IES RP-8 / TM-15)";
  return "Outdoor Architectural Floodlight Report (NEMA Beam Classification)";
});

// Print report
function printReport() {
  window.print();
}

// Download HTML
async function downloadHtmlReport() {
  const element = document.getElementById("printable-report-content");
  if (!element) return;
  const title = `${reportTitle.value} — ${props.data.fileName}`
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 30px; color: #18181b; background: #fff; line-height: 1.4; font-size: 12px; }
    h1 { font-size: 18px; margin: 0 0 4px; color: #0f172a; }
    h2 { font-size: 13px; margin: 12px 0 6px; color: #334155; border-bottom: 1px solid #cbd5e1; padding-bottom: 2px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 11px; }
    th, td { border: 1px solid #cbd5e1; padding: 4px 6px; text-align: left; }
    th { background: #f1f5f9; color: #475569; }
    .text-right { text-align: right; }
    .header-box { border: 1px solid #94a3b8; padding: 12px; margin-bottom: 16px; border-radius: 4px; background: #f8fafc; }
    .header-title-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
    .report-type-badge { background: #d97706; color: white; padding: 3px 8px; border-radius: 3px; font-weight: bold; font-size: 10px; text-transform: uppercase; }
    .meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; font-size: 11px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .badge { display: inline-block; padding: 2px 6px; background: #e2e8f0; border-radius: 3px; font-weight: bold; }
    .doc-section { margin-bottom: 16px; }
    .section-title { font-weight: bold; font-size: 12px; color: #334155; margin-bottom: 6px; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 2px; }
    .polar-svg { width: 100%; max-width: 260px; height: auto; display: block; margin: 0 auto; }
    .doc-header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 14px; }
    .doc-title-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 10px; }
    .doc-subtitle, .polar-caption { color: #64748b; }
    .report-stamp { white-space: nowrap; background: #0f172a; color: #fff; padding: 3px 8px; font-weight: bold; font-size: 10px; }
    .luminaire-meta-box { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 14px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 8px 12px; }
    .meta-col { display: flex; flex-direction: column; gap: 2px; }
    .polar-summary-section { display: grid; grid-template-columns: 240px 1fr; gap: 16px; margin-bottom: 14px; }
    .polar-box { display: flex; flex-direction: column; align-items: center; }
    .report-polar-svg { width: 180px; height: 180px; }
    .cu-report-table th, .cu-report-table td { font-size: 9px; padding: 2px 3px; text-align: center; }
    .doc-footer { margin-top: 24px; border-top: 1px solid #cbd5e1; padding-top: 8px; font-size: 9px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  ${element.innerHTML}
</body>
</html>`;

  const defaultFileName = `${props.data.fileName.replace(/\.ies$/i, "")}_${activeReport.value}_report.html`;

  if (isTauri()) {
    try {
      const filePath = await save({
        defaultPath: defaultFileName,
        filters: [{ name: "HTML Report", extensions: ["html", "htm"] }],
      });
      if (filePath) {
        await writeTextFile(filePath, htmlContent);
        alert(`HTML Report successfully saved to:\n${filePath}`);
        return;
      }
      return;
    } catch (err) {
      console.warn("Tauri file dialog failed, falling back to browser download:", err);
    }
  }

  // Browser download fallback
  const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = defaultFileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Polar SVG path
const cx = 150;
const cy = 150;
const rMax = 120;
const polarSvgPath = computed(() => {
  const numV = props.data.verticalAngles.length;
  const mult = props.data.multiplier;
  const maxVal = Math.max(1, props.data.calculated.maxCandela.intensity);

  const points: Array<[number, number]> = [];
  for (let i = 0; i < numV; i++) {
    const deg = props.data.verticalAngles[i];
    const cd = (props.data.candela[0]?.[i] ?? 0) * mult;
    const r = (cd / maxVal) * rMax;
    const rad = (deg * Math.PI) / 180 + Math.PI / 2;
    points.push([cx + r * Math.cos(rad), cy + r * Math.sin(rad)]);
  }

  const oppPoints: Array<[number, number]> = [];
  for (let i = numV - 1; i >= 0; i--) {
    const deg = props.data.verticalAngles[i];
    const cd = (props.data.candela[0]?.[i] ?? 0) * mult;
    const r = (cd / maxVal) * rMax;
    const rad = (-deg * Math.PI) / 180 + Math.PI / 2;
    oppPoints.push([cx + r * Math.cos(rad), cy + r * Math.sin(rad)]);
  }

  const all = [...points, ...oppPoints];
  return (
    all.map(([x, y], idx) => `${idx === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ") + " Z"
  );
});
</script>

<template>
  <div class="reports-root">
    <!-- Toolbar -->
    <div class="report-toolbar no-print">
      <label>Report Type <select v-model="activeReport"><option value="indoor">Indoor</option><option value="roadway">Roadway</option><option value="floodlight">Floodlight</option></select></label>

      <div class="action-buttons">
        <button class="btn-action primary" @click="printReport">
          <AppIcon name="report" :size="14" />
          <span>Print / Save PDF</span>
        </button>
        <button class="btn-action" @click="downloadHtmlReport">
          <AppIcon name="save" :size="14" />
          <span>Export HTML Report</span>
        </button>
      </div>
    </div>

    <!-- Printable Report Document Page -->
    <div class="paper-container">
      <div id="printable-report-content" class="report-paper">
        <!-- Report Header -->
        <header class="doc-header">
          <div class="doc-title-row">
            <div>
              <h1 class="doc-main-title">{{ reportTitle }}</h1>
              <div class="doc-subtitle">File: {{ data.fileName }} • Standard: IES LM-63-2002</div>
            </div>
            <div class="doc-badge-col">
              <span class="report-stamp">PHOTOMETRIC TOOLBOX</span>
            </div>
          </div>

          <div class="luminaire-meta-box">
            <div class="meta-col">
              <div><strong>Catalog:</strong> {{ data.keywords["LUMCAT"] || "Generic" }}</div>
              <div><strong>Luminaire:</strong> {{ data.keywords["LUMINAIRE"] || "Architectural Luminaire" }}</div>
              <div><strong>Manufacturer:</strong> {{ data.keywords["MANUFAC"] || "Lighting Analysts" }}</div>
            </div>
            <div class="meta-col">
              <div><strong>Lamp:</strong> {{ data.keywords["LAMP"] || "Integrated LED" }}</div>
              <div><strong>Input Watts:</strong> {{ data.inputWatts.toFixed(1) }} W</div>
              <div><strong>Test Lab:</strong> {{ data.keywords["TESTLAB"] || "Optical Testing Lab" }}</div>
            </div>
            <div class="meta-col">
              <div><strong>Total Lumens:</strong> {{ data.calculated.totalLuminaireLumens.toLocaleString() }} lm</div>
              <div><strong>Luminous Efficacy:</strong> {{ data.calculated.efficacyLER }} lm/W</div>
              <div><strong>Test Date:</strong> {{ data.keywords["DATE"] || "2024-05-15" }}</div>
            </div>
          </div>
        </header>

        <!-- Polar Curve & High-Level Summary -->
        <section class="polar-summary-section">
          <div class="polar-box">
            <div class="section-title">Candela Distribution Curve</div>
            <svg viewBox="0 0 300 300" class="report-polar-svg">
              <circle :cx="cx" :cy="cy" :r="rMax" fill="none" stroke="#cbd5e1" />
              <circle :cx="cx" :cy="cy" :r="rMax * 0.75" fill="none" stroke="#cbd5e1" stroke-dasharray="3,3" />
              <circle :cx="cx" :cy="cy" :r="rMax * 0.5" fill="none" stroke="#cbd5e1" stroke-dasharray="3,3" />
              <circle :cx="cx" :cy="cy" :r="rMax * 0.25" fill="none" stroke="#cbd5e1" stroke-dasharray="3,3" />
              <line :x1="cx" y1="10" :x2="cx" y2="290" stroke="#cbd5e1" />
              <line x1="10" :y1="cy" x2="290" :y2="cy" stroke="#cbd5e1" />
              <path :d="polarSvgPath" fill="rgba(6, 182, 212, 0.25)" stroke="#0284c7" stroke-width="2" />
            </svg>
            <div class="polar-caption">Max: {{ data.calculated.maxCandela.intensity }} cd @ V:{{ data.calculated.maxCandela.verticalAngle }}°, H:{{ data.calculated.maxCandela.horizontalAngle }}°</div>
          </div>

          <div class="summary-box">
            <div class="section-title">Photometric Summary Characteristics</div>
            <table class="report-table">
              <tbody>
                <tr><td>Total Lamp Lumens:</td><td class="text-right">{{ data.calculated.totalLampLumens.toLocaleString() }} lm</td></tr>
                <tr><td>Total Luminaire Lumens:</td><td class="text-right"><strong>{{ data.calculated.totalLuminaireLumens.toLocaleString() }} lm</strong></td></tr>
                <tr><td>Luminaire Efficiency:</td><td class="text-right">{{ data.calculated.efficiency }}%</td></tr>
                <tr><td>Downward Lumens:</td><td class="text-right">{{ data.calculated.downwardLumens.toLocaleString() }} lm ({{ Math.round((data.calculated.downwardLumens / (data.calculated.totalLuminaireLumens || 1)) * 100) }}%)</td></tr>
                <tr><td>Upward Lumens:</td><td class="text-right">{{ data.calculated.upwardLumens.toLocaleString() }} lm ({{ Math.round((data.calculated.upwardLumens / (data.calculated.totalLuminaireLumens || 1)) * 100) }}%)</td></tr>
                <tr><td>CIE Luminaire Classification:</td><td class="text-right"><strong>{{ data.calculated.cieClassification }}</strong></td></tr>
                <tr><td>IES TM-15 BUG Rating:</td><td class="text-right"><span class="badge">{{ data.calculated.bugRating.fullRating }}</span></td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- REPORT-SPECIFIC BODY SECTIONS -->

        <!-- 1. INDOOR REPORT DETAILS -->
        <template v-if="activeReport === 'indoor'">
          <!-- Coefficients of Utilization Summary -->
          <section class="doc-section">
            <div class="section-title">Coefficients of Utilization (Zonal Cavity Method) — Effective Floor Cavity 20%</div>
            <table class="report-table cu-report-table">
              <thead>
                <tr>
                  <th rowspan="2">RCR</th>
                  <th colspan="4">RC 80%</th>
                  <th colspan="4">RC 70%</th>
                  <th colspan="3">RC 50%</th>
                  <th colspan="3">RC 30%</th>
                  <th colspan="3">RC 10%</th>
                  <th rowspan="2">0%</th>
                </tr>
                <tr>
                  <th>70</th><th>50</th><th>30</th><th>10</th>
                  <th>70</th><th>50</th><th>30</th><th>10</th>
                  <th>50</th><th>30</th><th>10</th>
                  <th>50</th><th>30</th><th>10</th>
                  <th>50</th><th>30</th><th>10</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in data.calculated.cuTable.rows.slice(0, 11)" :key="r.rcr">
                  <td><strong>{{ r.rcr }}</strong></td>
                  <td>{{ r.cuValues['80_70']?.toFixed(2) }}</td>
                  <td>{{ r.cuValues['80_50']?.toFixed(2) }}</td>
                  <td>{{ r.cuValues['80_30']?.toFixed(2) }}</td>
                  <td>{{ r.cuValues['80_10']?.toFixed(2) }}</td>
                  <td>{{ r.cuValues['70_70']?.toFixed(2) }}</td>
                  <td>{{ r.cuValues['70_50']?.toFixed(2) }}</td>
                  <td>{{ r.cuValues['70_30']?.toFixed(2) }}</td>
                  <td>{{ r.cuValues['70_10']?.toFixed(2) }}</td>
                  <td>{{ r.cuValues['50_50']?.toFixed(2) }}</td>
                  <td>{{ r.cuValues['50_30']?.toFixed(2) }}</td>
                  <td>{{ r.cuValues['50_10']?.toFixed(2) }}</td>
                  <td>{{ r.cuValues['30_50']?.toFixed(2) }}</td>
                  <td>{{ r.cuValues['30_30']?.toFixed(2) }}</td>
                  <td>{{ r.cuValues['30_10']?.toFixed(2) }}</td>
                  <td>{{ r.cuValues['10_50']?.toFixed(2) }}</td>
                  <td>{{ r.cuValues['10_30']?.toFixed(2) }}</td>
                  <td>{{ r.cuValues['10_10']?.toFixed(2) }}</td>
                  <td>{{ r.cuValues['0_0']?.toFixed(2) }}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <!-- Luminance Table & Spacing Criteria -->
          <div class="grid-2">
            <section class="doc-section">
              <div class="section-title">Average Luminance Data (cd/m²)</div>
              <table class="report-table">
                <thead>
                  <tr>
                    <th>Vertical Angle</th>
                    <th class="text-right">0° (Along)</th>
                    <th class="text-right">45°</th>
                    <th class="text-right">90° (Across)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="lum in data.calculated.luminanceTable" :key="lum.angle">
                    <td>{{ lum.angle }}°</td>
                    <td class="text-right">{{ lum.cd0.toLocaleString() }}</td>
                    <td class="text-right">{{ lum.cd45.toLocaleString() }}</td>
                    <td class="text-right">{{ lum.cd90.toLocaleString() }}</td>
                  </tr>
                </tbody>
              </table>
            </section>

            <section class="doc-section">
              <div class="section-title">Spacing Criteria & Glare</div>
              <table class="report-table">
                <tbody>
                  <tr><td>Spacing Criterion (Along 0°):</td><td class="text-right"><strong>{{ data.calculated.cuTable.spacingCriteria.along0 }}</strong></td></tr>
                  <tr><td>Spacing Criterion (Across 90°):</td><td class="text-right"><strong>{{ data.calculated.cuTable.spacingCriteria.across90 }}</strong></td></tr>
                  <tr><td>Unified Glare Rating (Crosswise 4H×8H):</td><td class="text-right">{{ data.calculated.ugrTable.rows[4]?.crosswise.ugr70_50_20 || 16 }}</td></tr>
                  <tr><td>Unified Glare Rating (Endwise 4H×8H):</td><td class="text-right">{{ data.calculated.ugrTable.rows[4]?.endwise.ugr70_50_20 || 15 }}</td></tr>
                </tbody>
              </table>
            </section>
          </div>
        </template>

        <!-- 2. ROADWAY REPORT DETAILS -->
        <template v-else-if="activeReport === 'roadway'">
          <section class="doc-section">
            <div class="section-title">IES RP-8 Roadway Classification Summary</div>
            <table class="report-table">
              <tbody>
                <tr>
                  <td><strong>IES Roadway Lateral Type:</strong></td>
                  <td><span class="badge">{{ data.calculated.roadwayClassification.iesType }}</span></td>
                  <td><strong>Longitudinal Classification:</strong></td>
                  <td><span class="badge">{{ data.calculated.roadwayClassification.longitudinalClassification }}</span></td>
                </tr>
                <tr>
                  <td><strong>Cutoff Classification (RP-8):</strong></td>
                  <td><span class="badge">{{ data.calculated.roadwayClassification.cutoffClassification }}</span></td>
                  <td><strong>IES TM-15 BUG Rating:</strong></td>
                  <td><span class="badge">{{ data.calculated.bugRating.fullRating }}</span></td>
                </tr>
                <tr>
                  <td>Max Candela (cd/1000 lm):</td>
                  <td>{{ data.calculated.roadwayClassification.maxIntensityRatio }} cd/klm</td>
                  <td>Max Candela Transverse Distance:</td>
                  <td>{{ data.calculated.roadwayClassification.halfMaxTransverseRatio }} MH</td>
                </tr>
              </tbody>
            </table>
          </section>

          <!-- LCS Table -->
          <section class="doc-section">
            <div class="section-title">Luminaire Classification System (LCS) Secondary Zones</div>
            <table class="report-table">
              <thead>
                <tr>
                  <th>Zone Group</th>
                  <th>Zone Range</th>
                  <th class="text-right">Lumens</th>
                  <th class="text-right">% Luminaire</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Backlight Low (BL)</td><td>0° - 30°</td><td class="text-right">{{ data.calculated.bugRating.zones.bl }} lm</td><td class="text-right">{{ (data.calculated.bugRating.zones.bl / (data.calculated.totalLuminaireLumens || 1) * 100).toFixed(1) }}%</td></tr>
                <tr><td>Backlight Medium (BM)</td><td>30° - 60°</td><td class="text-right">{{ data.calculated.bugRating.zones.bm }} lm</td><td class="text-right">{{ (data.calculated.bugRating.zones.bm / (data.calculated.totalLuminaireLumens || 1) * 100).toFixed(1) }}%</td></tr>
                <tr><td>Backlight High (BH)</td><td>60° - 80°</td><td class="text-right">{{ data.calculated.bugRating.zones.bh }} lm</td><td class="text-right">{{ (data.calculated.bugRating.zones.bh / (data.calculated.totalLuminaireLumens || 1) * 100).toFixed(1) }}%</td></tr>
                <tr><td>Backlight Very High (BVH)</td><td>80° - 90°</td><td class="text-right">{{ data.calculated.bugRating.zones.bvh }} lm</td><td class="text-right">{{ (data.calculated.bugRating.zones.bvh / (data.calculated.totalLuminaireLumens || 1) * 100).toFixed(1) }}%</td></tr>
                <tr><td>Forward Low (FL)</td><td>0° - 30°</td><td class="text-right">{{ data.calculated.bugRating.zones.fl }} lm</td><td class="text-right">{{ (data.calculated.bugRating.zones.fl / (data.calculated.totalLuminaireLumens || 1) * 100).toFixed(1) }}%</td></tr>
                <tr><td>Forward Medium (FM)</td><td>30° - 60°</td><td class="text-right">{{ data.calculated.bugRating.zones.fm }} lm</td><td class="text-right">{{ (data.calculated.bugRating.zones.fm / (data.calculated.totalLuminaireLumens || 1) * 100).toFixed(1) }}%</td></tr>
                <tr><td>Forward High (FH)</td><td>60° - 80°</td><td class="text-right">{{ data.calculated.bugRating.zones.fh }} lm</td><td class="text-right">{{ (data.calculated.bugRating.zones.fh / (data.calculated.totalLuminaireLumens || 1) * 100).toFixed(1) }}%</td></tr>
                <tr><td>Uplight Low (UL)</td><td>90° - 100°</td><td class="text-right">{{ data.calculated.bugRating.zones.ul }} lm</td><td class="text-right">{{ (data.calculated.bugRating.zones.ul / (data.calculated.totalLuminaireLumens || 1) * 100).toFixed(1) }}%</td></tr>
                <tr><td>Uplight High (UH)</td><td>100° - 180°</td><td class="text-right">{{ data.calculated.bugRating.zones.uh }} lm</td><td class="text-right">{{ (data.calculated.bugRating.zones.uh / (data.calculated.totalLuminaireLumens || 1) * 100).toFixed(1) }}%</td></tr>
              </tbody>
            </table>
          </section>
        </template>

        <!-- 3. FLOODLIGHT REPORT DETAILS -->
        <template v-else-if="activeReport === 'floodlight'">
          <section class="doc-section">
            <div class="section-title">NEMA Beam & Field Spread Classification</div>
            <table class="report-table">
              <tbody>
                <tr>
                  <td><strong>NEMA Classification:</strong></td>
                  <td><span class="badge">{{ data.calculated.floodlightClassification.nemaFullClassification }}</span></td>
                  <td><strong>Total Luminaire Lumens:</strong></td>
                  <td>{{ data.calculated.totalLuminaireLumens.toLocaleString() }} lm</td>
                </tr>
                <tr>
                  <td><strong>Horizontal NEMA Type:</strong></td>
                  <td>Type {{ data.calculated.floodlightClassification.nemaTypeH }}</td>
                  <td><strong>Vertical NEMA Type:</strong></td>
                  <td>Type {{ data.calculated.floodlightClassification.nemaTypeV }}</td>
                </tr>
                <tr>
                  <td>Beam Angle (50% max cd):</td>
                  <td>{{ data.calculated.floodlightClassification.beamAngleH }}° H × {{ data.calculated.floodlightClassification.beamAngleV }}° V</td>
                  <td>Field Angle (10% max cd):</td>
                  <td>{{ data.calculated.floodlightClassification.fieldAngleH }}° H × {{ data.calculated.floodlightClassification.fieldAngleV }}° V</td>
                </tr>
                <tr>
                  <td>Beam Lumens:</td>
                  <td>{{ data.calculated.floodlightClassification.beamLumens.toLocaleString() }} lm</td>
                  <td>Beam Efficiency:</td>
                  <td>{{ data.calculated.floodlightClassification.beamEfficiency }}%</td>
                </tr>
                <tr>
                  <td>Field Lumens:</td>
                  <td>{{ data.calculated.floodlightClassification.fieldLumens.toLocaleString() }} lm</td>
                  <td>Field Efficiency:</td>
                  <td>{{ data.calculated.floodlightClassification.fieldEfficiency }}%</td>
                </tr>
              </tbody>
            </table>
          </section>
        </template>

        <!-- Footer / Certification -->
        <footer class="doc-footer">
          <div>Report generated via Open Photometric Toolbox • Computational engine parity with IES LM-63 & EULUMDAT standards</div>
        </footer>
      </div>
    </div>
  </div>
</template>

<style scoped>
.reports-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--workspace);
  overflow: hidden;
}

.report-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: var(--well);
  border-bottom: 1px solid var(--line-soft);
  gap: 12px;
  flex-wrap: wrap;
}

.report-toolbar select {
  color: var(--text);
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--control-radius);
  padding: 6px 9px;
  font: inherit;
}

.type-selector {
  display: flex;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--control-radius);
  overflow: hidden;
}

.report-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 0;
  background: none;
  font-size: 0.8rem;
  color: var(--muted);
  cursor: pointer;
}

.report-tab.active {
  background: var(--accent);
  color: #fff;
  font-weight: 500;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.btn-action {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: var(--raised);
  border: 1px solid var(--line);
  border-radius: var(--control-radius);
  color: var(--text);
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-action.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--on-accent);
  font-weight: 500;
}

.paper-container {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 20px;
  display: flex;
  justify-content: safe center;
}

.report-paper {
  background: #ffffff;
  color: #18181b;
  width: 820px;
  flex: 0 0 820px;
  min-height: 1050px;
  padding: 32px 36px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  font-size: 11px;
  line-height: 1.4;
  display: flex;
  flex-direction: column;
}

.doc-header {
  border-bottom: 2px solid #0f172a;
  padding-bottom: 12px;
  margin-bottom: 14px;
}

.doc-title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 10px;
}

.doc-main-title {
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}

.doc-subtitle {
  font-size: 11px;
  color: #64748b;
  margin-top: 2px;
}

.report-stamp {
  white-space: nowrap;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.05em;
  background: #0f172a;
  color: #fff;
  padding: 3px 8px;
  border-radius: 3px;
}

.luminaire-meta-box {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 10.5px;
}

.meta-col {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.meta-col strong {
  color: #475569;
}

.polar-summary-section {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 16px;
  margin-bottom: 14px;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 14px;
}

.polar-box {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.report-polar-svg {
  width: 180px;
  height: 180px;
}

.polar-caption {
  font-size: 9.5px;
  color: #64748b;
  margin-top: 4px;
  text-align: center;
}

.section-title {
  font-size: 11.5px;
  font-weight: 700;
  color: #0f172a;
  border-bottom: 1px solid #cbd5e1;
  padding-bottom: 3px;
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.report-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 10.5px;
}

.report-table th,
.report-table td {
  border: 1px solid #cbd5e1;
  padding: 3px 6px;
}

.report-table th {
  background: #f1f5f9;
  color: #475569;
  font-weight: 600;
}

.cu-report-table th,
.cu-report-table td {
  font-size: 9px;
  padding: 2px 3px;
  text-align: center;
}

.badge {
  display: inline-block;
  padding: 1px 6px;
  background: #e2e8f0;
  border-radius: 3px;
  font-weight: 600;
  font-size: 10px;
}

.text-right {
  text-align: right;
}

.doc-section {
  margin-bottom: 12px;
}

.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.doc-footer {
  margin-top: auto;
  border-top: 1px solid #cbd5e1;
  padding-top: 8px;
  font-size: 9px;
  color: #94a3b8;
  text-align: center;
}

/* Print styling rules */
@media print {
  .no-print {
    display: none !important;
  }
  .reports-root {
    background: #fff !important;
  }
  .paper-container {
    padding: 0 !important;
    overflow: visible !important;
  }
  .report-paper {
    width: 100% !important;
    box-shadow: none !important;
    padding: 0 !important;
  }
}
</style>
