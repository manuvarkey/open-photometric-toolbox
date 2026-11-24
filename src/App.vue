<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open, save } from "@tauri-apps/plugin-dialog";
import AppIcon from "./components/AppIcon.vue";
import BUGRatingViewer from "./components/BUGRatingViewer.vue";
import CIEClassificationModal from "./components/CIEClassificationModal.vue";
import CUTableViewer from "./components/CUTableViewer.vue";
import GoniometerConverterModal from "./components/GoniometerConverterModal.vue";
import IsoIlluminanceViewer from "./components/IsoIlluminanceViewer.vue";
import LuminaireCompare from "./components/LuminaireCompare.vue";
import NewLuminaireModal from "./components/NewLuminaireModal.vue";
import Photometric3DViewer from "./components/Photometric3DViewer.vue";
import PhotometricEditorModal from "./components/PhotometricEditorModal.vue";
import PhotometricLibraryCatalog from "./components/PhotometricLibraryCatalog.vue";
import Polar2DViewer from "./components/Polar2DViewer.vue";
import ReportViewer from "./components/ReportViewer.vue";
import RibbonToolbar from "./components/RibbonToolbar.vue";
import ZonalLumensTable from "./components/ZonalLumensTable.vue";
import { serializeEULUMDAT } from "./core/eulumdatConverter";
import { parseIES, serializeIES } from "./core/iesParser";
import {
  COMMERCIAL_DOWNLIGHT_IES,
  FLOODLIGHT_NEMA_IES,
  ROADWAY_COBRA_HEAD_IES,
} from "./core/samples";
import type { PhotometricData } from "./core/types";

type RibbonTab =
  | "home"
  | "3d"
  | "polar"
  | "template"
  | "cu"
  | "analysis"
  | "reports"
  | "compare"
  | "view";

type ViewportMode =
  | "3d"
  | "polar"
  | "template"
  | "zonal"
  | "bug"
  | "cu"
  | "reports"
  | "compare";

// State
const currentData = ref<PhotometricData | null>(null);
const currentFileName = ref("Commercial_Downlight_40W.ies");
const activeRibbonTab = ref<RibbonTab>("home");
const activeView = ref<ViewportMode>("3d");
const showInspector = ref(true);
const showStatusBar = ref(true);
const showAboutModal = ref(false);
const showEditorModal = ref(false);
const showCIEModal = ref(false);
const showConverterModal = ref(false);
const showNewLuminaireModal = ref(false);
const showCatalogModal = ref(false);
const selectedPolarPlane = ref<"all" | "max" | "0" | "90">("all");
const selectedPlotMode = ref<"polar" | "cartesian">("polar");
const comparisonSecondaryData = ref<PhotometricData | null>(null);
const uiScale = ref(1.0);
const theme = ref<"dark" | "light">("dark");
const fileInput = ref<HTMLInputElement>();

function handleLuminaireLoad(loaded: PhotometricData) {
  currentData.value = loaded;
  currentFileName.value = loaded.fileName;
}

function handleCompareWith(other: PhotometricData) {
  comparisonSecondaryData.value = other;
  selectRibbonTab("compare");
}

// 3D Visualizer controls
const wireframeMode = ref(false);
const show3DAxes = ref(true);
const show3DRings = ref(true);

// Ribbon reference
const ribbonToolbar = ref<InstanceType<typeof RibbonToolbar>>();

// Switch tab and sync primary viewport
function selectRibbonTab(tab: RibbonTab) {
  activeRibbonTab.value = tab;
  if (tab === "3d") activeView.value = "3d";
  else if (tab === "polar") activeView.value = "polar";
  else if (tab === "template") activeView.value = "template";
  else if (tab === "cu") activeView.value = "cu";
  else if (tab === "reports") activeView.value = "reports";
  else if (tab === "compare") activeView.value = "compare";
}

// Window actions
async function minimizeWindow() {
  if (isTauri()) {
    try {
      await getCurrentWindow().minimize();
    } catch (e) {
      console.warn("Minimize error", e);
    }
  }
}

async function toggleMaximizeWindow() {
  if (isTauri()) {
    try {
      await getCurrentWindow().toggleMaximize();
    } catch (e) {
      console.warn("Maximize error", e);
    }
  }
}

async function closeWindow() {
  if (isTauri()) {
    try {
      await getCurrentWindow().close();
    } catch (e) {
      console.warn("Close error", e);
    }
  }
}

// Theme handling
function toggleTheme() {
  theme.value = theme.value === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = theme.value;
}

// Load IES content
function loadFileContent(content: string, name: string) {
  try {
    const parsed = parseIES(content);
    currentData.value = parsed;
    currentFileName.value = name;
  } catch (err: any) {
    alert("Error parsing IES file: " + (err?.message || err));
  }
}

// Open file
async function openFile() {
  if (isTauri()) {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "Photometric Files", extensions: ["ies", "ldt", "txt"] }],
      });
      if (selected && typeof selected === "string") {
        const content = await invoke<string>("read_photometric_file", { path: selected });
        const name = selected.split(/[\/\\]/).pop() || "unknown.ies";
        loadFileContent(content, name);
      }
    } catch (err) {
      console.warn("Tauri dialog fallback:", err);
      fileInput.value?.click();
    }
  } else {
    fileInput.value?.click();
  }
}

function handleFileInput(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (evt) => {
    const content = evt.target?.result as string;
    if (content) {
      loadFileContent(content, file.name);
    }
  };
  reader.readAsText(file);
}

// Save file
async function saveFile() {
  if (!currentData.value) return;
  const content = serializeIES(currentData.value);

  if (isTauri()) {
    try {
      const selected = await save({
        defaultPath: currentFileName.value,
        filters: [{ name: "IES Luminaire Files", extensions: ["ies"] }],
      });
      if (selected) {
        await invoke("save_photometric_file", { path: selected, content });
        alert("File successfully saved!");
      }
      return;
    } catch (err) {
      console.warn("Tauri save dialog fallback:", err);
    }
  }

  // Browser download fallback
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = currentFileName.value.endsWith(".ies") ? currentFileName.value : `${currentFileName.value}.ies`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Export EULUMDAT
function exportLDT() {
  if (!currentData.value) return;
  const content = serializeEULUMDAT(currentData.value);
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const base = currentFileName.value.replace(/\.ies$/i, "");
  a.download = `${base}.ldt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// UI Scale Methods
function setScale(scale: number) {
  uiScale.value = Math.max(0.75, Math.min(1.5, Math.round(scale * 100) / 100));
  document.documentElement.style.setProperty("--ui-scale", String(uiScale.value));
  document.documentElement.style.setProperty("--ui-font-size", `${13 * uiScale.value}px`);
  const appEl = document.getElementById("app");
  if (appEl && "zoom" in appEl.style) {
    (appEl.style as any).zoom = String(uiScale.value);
  }
  ribbonToolbar.value?.prepare();
}

function zoomIn() {
  setScale(uiScale.value + 0.1);
}

function zoomOut() {
  setScale(uiScale.value - 0.1);
}

function resetScale() {
  setScale(1.0);
}

function handleEditorSave(updated: PhotometricData) {
  currentData.value = updated;
}

// Load Samples
function loadSample(type: "downlight" | "roadway" | "floodlight") {
  if (type === "downlight") {
    loadFileContent(COMMERCIAL_DOWNLIGHT_IES, "Commercial_Downlight_40W.ies");
  } else if (type === "roadway") {
    loadFileContent(ROADWAY_COBRA_HEAD_IES, "Cobra_Head_Roadway_150W.ies");
  } else if (type === "floodlight") {
    loadFileContent(FLOODLIGHT_NEMA_IES, "Architectural_Floodlight_250W.ies");
  }
}

// Computed stats
const maxCandelaInfo = computed(() => {
  if (!currentData.value) return "0 cd";
  const { intensity, verticalAngle, horizontalAngle } = currentData.value.calculated.maxCandela;
  return `${intensity.toLocaleString()} cd (V:${verticalAngle}°, H:${horizontalAngle}°)`;
});

const efficacyInfo = computed(() => {
  if (!currentData.value) return "0 lm/W";
  return `${currentData.value.calculated.efficacyLER} lm/W`;
});

const symmetryInfo = computed(() => {
  if (!currentData.value) return "Symmetric";
  const h = currentData.value.horizontalAngles;
  if (!h || h.length <= 1) return "Full 360° Symmetric";
  const maxH = Math.max(...h);
  if (maxH === 90) return "Quadrant Symmetric";
  if (maxH === 180) return "Bilateral Symmetric";
  return "Asymmetric (Full 360° Web)";
});

function copyData() {
  if (!currentData.value) return;
  const c = currentData.value.calculated;
  const text = `Photometric Report: ${currentFileName.value}
Catalog: ${currentData.value.keywords["[LUMCAT]"] || "Generic"}
Total Luminaire Lumens: ${c.totalLuminaireLumens} lm
Input Watts: ${currentData.value.inputWatts} W
Efficacy (LER): ${c.efficacyLER} lm/W
Max Candela: ${c.maxCandela.intensity} cd (V:${c.maxCandela.verticalAngle}°, H:${c.maxCandela.horizontalAngle}°)
BUG Rating: ${c.bugRating.fullRating}
CIE Classification: ${c.cieClassification} (${c.cieDetails?.fluxCode || ""})
DIN 5040: ${c.cieDetails?.din5040Class || "A40"}
Symmetry: ${symmetryInfo.value}`;
  navigator.clipboard.writeText(text);
  window.alert("Photometric summary copied to clipboard!");
}

const dimensionsInfo = computed(() => {
  if (!currentData.value) return "-";
  const { width, length, height } = currentData.value.lumensPerLamp > 0 ? {
    width: currentData.value.luminousWidth,
    length: currentData.value.luminousLength,
    height: currentData.value.luminousHeight,
  } : { width: 0, length: 0, height: 0 };
  const unit = currentData.value.unitsType === 1 ? "ft" : "m";
  return `${length.toFixed(2)} × ${width.toFixed(2)} × ${height.toFixed(2)} ${unit}`;
});

onMounted(async () => {
  document.documentElement.dataset.theme = theme.value;
  // Initialize with commercial downlight sample
  loadSample("downlight");

  // Show window in Tauri after first mount to avoid flash and apply CSD
  if (isTauri()) {
    try {
      await getCurrentWindow().show();
    } catch (e) {
      console.warn("Could not show window:", e);
    }
  }
});
</script>

<template>
  <div class="app-container">
    <!-- Hidden File Input for Browser / Non-Tauri File Dialog -->
    <input
      ref="fileInput"
      type="file"
      accept=".ies,.ldt,.txt"
      style="display: none"
      @change="handleFileInput"
    />

    <!-- Header / Window Titlebar with Client-Side Decorations (CSD) -->
    <header class="window-titlebar" data-tauri-drag-region>
      <div class="app-branding" data-tauri-drag-region>
        <AppIcon name="lightbulb" :size="18" />
        <span>Open Photometric Toolbox</span>
        <span class="file-name">— {{ currentFileName }}</span>
      </div>

      <div class="titlebar-right" data-tauri-drag-region>
        <div class="window-actions">
          <button
            class="theme-toggle-btn"
            :title="theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'"
            @click="toggleTheme"
          >
            <AppIcon :name="theme === 'dark' ? 'sun' : 'moon'" :size="15" />
          </button>

          <button
            class="theme-toggle-btn"
            title="About Open Photometric Toolbox"
            @click="showAboutModal = true"
          >
            <AppIcon name="info" :size="15" />
          </button>
        </div>

        <!-- Native Window Controls for Desktop (Minimize, Maximize, Close) -->
        <div v-if="isTauri()" class="window-controls" role="toolbar" aria-label="Window controls">
          <button
            class="icon-button"
            aria-label="Minimize window"
            title="Minimize"
            @click="minimizeWindow"
          >
            <AppIcon name="minimize" :size="14" />
          </button>
          <button
            class="icon-button"
            aria-label="Maximize or restore window"
            title="Maximize or restore"
            @click="toggleMaximizeWindow"
          >
            <AppIcon name="maximize" :size="14" />
          </button>
          <button
            class="icon-button window-close"
            aria-label="Close window"
            title="Close"
            @click="closeWindow"
          >
            <AppIcon name="close" :size="14" />
          </button>
        </div>
      </div>
    </header>

    <!-- Primary Ribbon Tabs Navigation -->
    <nav class="ribbon-tabs" role="tablist">
      <button
        role="tab"
        :class="{ active: activeRibbonTab === 'home' }"
        @click="selectRibbonTab('home')"
      >
        Home
      </button>
      <button
        role="tab"
        :class="{ active: activeRibbonTab === '3d' }"
        @click="selectRibbonTab('3d')"
      >
        3D Web
      </button>
      <button
        role="tab"
        :class="{ active: activeRibbonTab === 'polar' }"
        @click="selectRibbonTab('polar')"
      >
        Polar 2D
      </button>
      <button
        role="tab"
        :class="{ active: activeRibbonTab === 'template' }"
        @click="selectRibbonTab('template')"
      >
        Iso Template
      </button>
      <button
        role="tab"
        :class="{ active: activeRibbonTab === 'cu' }"
        @click="selectRibbonTab('cu')"
      >
        CU Table
      </button>
      <button
        role="tab"
        :class="{ active: activeRibbonTab === 'analysis' }"
        @click="selectRibbonTab('analysis')"
      >
        Analysis
      </button>
      <button
        role="tab"
        :class="{ active: activeRibbonTab === 'reports' }"
        @click="selectRibbonTab('reports')"
      >
        Reports
      </button>
      <button
        role="tab"
        :class="{ active: activeRibbonTab === 'compare' }"
        @click="selectRibbonTab('compare')"
      >
        Compare
      </button>
      <button
        role="tab"
        :class="{ active: activeRibbonTab === 'view' }"
        @click="selectRibbonTab('view')"
      >
        View
      </button>
    </nav>

    <!-- Ribbon Action Toolbar -->
    <RibbonToolbar ref="ribbonToolbar">
      <!-- TAB: HOME -->
      <template v-if="activeRibbonTab === 'home'">
        <!-- File Operations -->
        <div class="ribbon-group">
          <div class="ribbon-actions">
            <button class="ribbon-action" title="Create New Luminaire Profile from Scratch (tool_newpe.exe)" @click="showNewLuminaireModal = true">
              <AppIcon name="plus" />
              <span class="ribbon-label">New IES</span>
            </button>
            <button class="ribbon-action" title="Open IES / LDT File" @click="openFile">
              <AppIcon name="open" />
              <span class="ribbon-label">Open File</span>
            </button>
            <button class="ribbon-action" title="Save IES File" @click="saveFile">
              <AppIcon name="save" />
              <span class="ribbon-label">Save IES</span>
            </button>
            <button class="ribbon-action" title="Export EULUMDAT (.ldt) File" @click="exportLDT">
              <AppIcon name="convert" />
              <span class="ribbon-label">Export LDT</span>
            </button>
            <button class="ribbon-action" title="Interactive Photometric Editor" @click="showEditorModal = true">
              <AppIcon name="edit" />
              <span class="ribbon-label">Edit IES</span>
            </button>
          </div>
          <span class="ribbon-group-title">File</span>
        </div>

        <!-- Catalog & Conversion Tools -->
        <div class="ribbon-group">
          <div class="ribbon-actions">
            <button
              class="ribbon-action"
              title="Search & Browse Luminaire Library Catalog (tool_openexpe.exe)"
              @click="showCatalogModal = true"
            >
              <AppIcon name="database" />
              <span class="ribbon-label">Catalog</span>
            </button>
            <button
              class="ribbon-action"
              title="Convert Goniometer Coordinate Web (Type B ↔ Type C)"
              @click="showConverterModal = true"
            >
              <AppIcon name="convert" />
              <span class="ribbon-label">Convert B/C</span>
            </button>
          </div>
          <span class="ribbon-group-title">Catalog & Tools</span>
        </div>

        <!-- Sample Luminaires -->
        <div class="ribbon-group">
          <div class="ribbon-actions">
            <button
              class="ribbon-action"
              title="Recessed Commercial LED Downlight"
              @click="loadSample('downlight')"
            >
              <AppIcon name="lightbulb" />
              <span class="ribbon-label">Downlight</span>
            </button>
            <button
              class="ribbon-action"
              title="LED Cobra Head Roadway Type III"
              @click="loadSample('roadway')"
            >
              <AppIcon name="layers" />
              <span class="ribbon-label">Roadway</span>
            </button>
            <button
              class="ribbon-action"
              title="Architectural Outdoor Floodlight"
              @click="loadSample('floodlight')"
            >
              <AppIcon name="shield" />
              <span class="ribbon-label">Floodlight</span>
            </button>
          </div>
          <span class="ribbon-group-title">Samples</span>
        </div>

        <!-- Viewport Modes Quick Jump -->
        <div class="ribbon-group">
          <div class="ribbon-actions">
            <button
              class="ribbon-action"
              :class="{ active: activeView === '3d' }"
              title="3D Candela Solid Distribution"
              @click="selectRibbonTab('3d')"
            >
              <AppIcon name="cube" />
              <span class="ribbon-label">3D Web</span>
            </button>
            <button
              class="ribbon-action"
              :class="{ active: activeView === 'polar' }"
              title="2D Polar Candela Distribution Curves"
              @click="selectRibbonTab('polar')"
            >
              <AppIcon name="polar" />
              <span class="ribbon-label">Polar 2D</span>
            </button>
            <button
              class="ribbon-action"
              :class="{ active: activeView === 'template' }"
              title="Iso-illuminance Footcandle/Lux Template"
              @click="selectRibbonTab('template')"
            >
              <AppIcon name="template" />
              <span class="ribbon-label">Iso Template</span>
            </button>
            <button
              class="ribbon-action"
              :class="{ active: activeView === 'cu' }"
              title="Coefficients of Utilization (CU) Zonal Cavity Table"
              @click="selectRibbonTab('cu')"
            >
              <AppIcon name="table" />
              <span class="ribbon-label">CU Table</span>
            </button>
            <button
              class="ribbon-action"
              :class="{ active: activeView === 'reports' }"
              title="Formal Luminaire Reports (Indoor, Roadway, Floodlight)"
              @click="selectRibbonTab('reports')"
            >
              <AppIcon name="report" />
              <span class="ribbon-label">Reports</span>
            </button>
            <button
              class="ribbon-action"
              :class="{ active: activeView === 'compare' }"
              title="Compare Luminaires Side-by-Side"
              @click="selectRibbonTab('compare')"
            >
              <AppIcon name="compare" />
              <span class="ribbon-label">Compare</span>
            </button>
          </div>
          <span class="ribbon-group-title">Workspace Views</span>
        </div>

        <!-- Panels -->
        <div class="ribbon-group">
          <div class="ribbon-actions">
            <button
              class="ribbon-action"
              :class="{ active: showInspector }"
              title="Toggle Luminaire Metadata Inspector"
              @click="showInspector = !showInspector"
            >
              <AppIcon name="edit" />
              <span class="ribbon-label">Inspector</span>
            </button>
          </div>
          <span class="ribbon-group-title">Panels</span>
        </div>
      </template>

      <!-- TAB: 3D WEB -->
      <template v-else-if="activeRibbonTab === '3d'">
        <div class="ribbon-group">
          <div class="ribbon-actions">
            <button
              class="ribbon-action"
              :class="{ active: !wireframeMode }"
              title="Smooth Candela False-Color Surface"
              @click="wireframeMode = false; activeView = '3d'"
            >
              <AppIcon name="cube" />
              <span class="ribbon-label">Solid Mesh</span>
            </button>
            <button
              class="ribbon-action"
              :class="{ active: wireframeMode }"
              title="Wireframe Mesh Representation"
              @click="wireframeMode = true; activeView = '3d'"
            >
              <AppIcon name="wireframe" />
              <span class="ribbon-label">Wireframe</span>
            </button>
          </div>
          <span class="ribbon-group-title">Render Mode</span>
        </div>

        <div class="ribbon-group">
          <div class="ribbon-actions">
            <button
              class="ribbon-action"
              :class="{ active: show3DRings }"
              title="Toggle Polar Reference Rings"
              @click="show3DRings = !show3DRings"
            >
              <AppIcon name="polar" />
              <span class="ribbon-label">Polar Rings</span>
            </button>
            <button
              class="ribbon-action"
              :class="{ active: show3DAxes }"
              title="Toggle 3D Coordinate Axes"
              @click="show3DAxes = !show3DAxes"
            >
              <AppIcon name="layers" />
              <span class="ribbon-label">3D Axes</span>
            </button>
          </div>
          <span class="ribbon-group-title">Overlays</span>
        </div>

        <div class="ribbon-group">
          <div class="ribbon-actions">
            <button
              class="ribbon-action"
              :class="{ active: showInspector }"
              title="Toggle Luminaire Metadata Inspector"
              @click="showInspector = !showInspector"
            >
              <AppIcon name="edit" />
              <span class="ribbon-label">Inspector Rail</span>
            </button>
          </div>
          <span class="ribbon-group-title">Display</span>
        </div>
      </template>

      <!-- TAB: POLAR 2D / CURVES -->
      <template v-else-if="activeRibbonTab === 'polar'">
        <!-- Plot Style -->
        <div class="ribbon-group">
          <div class="ribbon-actions">
            <button
              class="ribbon-action"
              :class="{ active: selectedPlotMode === 'polar' }"
              title="2D Polar Candela Distribution Curves"
              @click="selectedPlotMode = 'polar'; activeView = 'polar'"
            >
              <AppIcon name="polar" />
              <span class="ribbon-label">Polar 2D</span>
            </button>
            <button
              class="ribbon-action"
              :class="{ active: selectedPlotMode === 'cartesian' }"
              title="Linear Cartesian X-Y Candela Plot (Intensity vs. Vertical Angle)"
              @click="selectedPlotMode = 'cartesian'; activeView = 'polar'"
            >
              <AppIcon name="chart" />
              <span class="ribbon-label">Cartesian X-Y</span>
            </button>
          </div>
          <span class="ribbon-group-title">Plot Style</span>
        </div>

        <div class="ribbon-group">
          <div class="ribbon-actions">
            <button
              class="ribbon-action"
              :class="{ active: selectedPolarPlane === 'all' }"
              title="Overlay All Measured Candela Planes"
              @click="selectedPolarPlane = 'all'; activeView = 'polar'"
            >
              <AppIcon name="polar" />
              <span class="ribbon-label">All Planes</span>
            </button>
            <button
              class="ribbon-action"
              :class="{ active: selectedPolarPlane === 'max' }"
              title="View Maximum Candela Plane"
              @click="selectedPolarPlane = 'max'; activeView = 'polar'"
            >
              <AppIcon name="chart" />
              <span class="ribbon-label">Max Plane</span>
            </button>
            <button
              class="ribbon-action"
              :class="{ active: selectedPolarPlane === '0' }"
              title="View Transverse 0° Plane"
              @click="selectedPolarPlane = '0'; activeView = 'polar'"
            >
              <AppIcon name="chart" />
              <span class="ribbon-label">0° Transverse</span>
            </button>
            <button
              class="ribbon-action"
              :class="{ active: selectedPolarPlane === '90' }"
              title="View Longitudinal 90° Plane"
              @click="selectedPolarPlane = '90'; activeView = 'polar'"
            >
              <AppIcon name="chart" />
              <span class="ribbon-label">90° Long.</span>
            </button>
          </div>
          <span class="ribbon-group-title">Candela Planes</span>
        </div>

        <div class="ribbon-group">
          <div class="ribbon-actions">
            <button
              class="ribbon-action"
              title="Copy Summary Metrics"
              @click="copyData"
            >
              <AppIcon name="report" />
              <span class="ribbon-label">Copy Data</span>
            </button>
            <button
              class="ribbon-action"
              title="Export EULUMDAT (.ldt) Format"
              @click="exportLDT"
            >
              <AppIcon name="convert" />
              <span class="ribbon-label">Export LDT</span>
            </button>
          </div>
          <span class="ribbon-group-title">Export</span>
        </div>
      </template>

      <!-- TAB: ISO TEMPLATE -->
      <template v-else-if="activeRibbonTab === 'template'">
        <div class="ribbon-group">
          <div class="ribbon-actions">
            <button
              class="ribbon-action"
              title="Interactive Photometric Editor"
              @click="showEditorModal = true"
            >
              <AppIcon name="edit" />
              <span class="ribbon-label">Edit IES</span>
            </button>
            <button
              class="ribbon-action"
              title="Copy Photometric Summary"
              @click="copyData"
            >
              <AppIcon name="report" />
              <span class="ribbon-label">Copy Data</span>
            </button>
          </div>
          <span class="ribbon-group-title">Template Tools</span>
        </div>
      </template>

      <!-- TAB: CU TABLE -->
      <template v-else-if="activeRibbonTab === 'cu'">
        <div class="ribbon-group">
          <div class="ribbon-actions">
            <button
              class="ribbon-action active"
              title="Coefficients of Utilization (Zonal Cavity Method)"
            >
              <AppIcon name="table" />
              <span class="ribbon-label">CU Matrix</span>
            </button>
            <button
              class="ribbon-action"
              title="CIE Luminaire Classification & Flux Codes"
              @click="showCIEModal = true"
            >
              <AppIcon name="chart" />
              <span class="ribbon-label">CIE Class</span>
            </button>
          </div>
          <span class="ribbon-group-title">Indoor Zonal Cavity</span>
        </div>
      </template>

      <!-- TAB: ANALYSIS -->
      <template v-else-if="activeRibbonTab === 'analysis'">
        <div class="ribbon-group">
          <div class="ribbon-actions">
            <button
              class="ribbon-action"
              :class="{ active: activeView === 'zonal' }"
              title="Simpson's Rule 1° Zonal Integration Table"
              @click="activeView = 'zonal'"
            >
              <AppIcon name="calculator" />
              <span class="ribbon-label">Simpson Zonal</span>
            </button>
            <button
              class="ribbon-action"
              :class="{ active: activeView === 'bug' }"
              title="IES TM-15 Backlight, Uplight, Glare Rating"
              @click="activeView = 'bug'"
            >
              <AppIcon name="shield" />
              <span class="ribbon-label">TM-15 BUG</span>
            </button>
            <button
              class="ribbon-action"
              :class="{ active: activeView === 'cu' }"
              title="Coefficients of Utilization (Zonal Cavity Method)"
              @click="selectRibbonTab('cu')"
            >
              <AppIcon name="table" />
              <span class="ribbon-label">CU Table</span>
            </button>
            <button
              class="ribbon-action"
              title="CIE Luminaire Classification & 5-Factor Flux Code"
              @click="showCIEModal = true"
            >
              <AppIcon name="chart" />
              <span class="ribbon-label">CIE Class</span>
            </button>
            <button
              class="ribbon-action"
              title="Convert Goniometer Coordinate Web (Type B ↔ Type C)"
              @click="showConverterModal = true"
            >
              <AppIcon name="convert" />
              <span class="ribbon-label">Convert B/C</span>
            </button>
            <button
              class="ribbon-action"
              title="Search & Browse Luminaire Library Catalog"
              @click="showCatalogModal = true"
            >
              <AppIcon name="database" />
              <span class="ribbon-label">Catalog</span>
            </button>
          </div>
          <span class="ribbon-group-title">Calculations & Conversion</span>
        </div>

        <div class="ribbon-group">
          <div class="ribbon-actions">
            <button
              class="ribbon-action"
              title="Copy Calculated Metrics to Clipboard"
              @click="copyData"
            >
              <AppIcon name="report" />
              <span class="ribbon-label">Copy Data</span>
            </button>
            <button
              class="ribbon-action"
              title="Export EULUMDAT (.ldt) Format"
              @click="exportLDT"
            >
              <AppIcon name="convert" />
              <span class="ribbon-label">Export LDT</span>
            </button>
          </div>
          <span class="ribbon-group-title">Export</span>
        </div>
      </template>

      <!-- TAB: REPORTS -->
      <template v-else-if="activeRibbonTab === 'reports'">
        <div class="ribbon-group">
          <div class="ribbon-actions">
            <button
              class="ribbon-action active"
              title="Indoor, Roadway, and Floodlight Formal Reports"
              @click="activeView = 'reports'"
            >
              <AppIcon name="report" />
              <span class="ribbon-label">Report View</span>
            </button>
            <button
              class="ribbon-action"
              title="CIE Luminaire Classification & Flux Codes"
              @click="showCIEModal = true"
            >
              <AppIcon name="chart" />
              <span class="ribbon-label">CIE Class</span>
            </button>
          </div>
          <span class="ribbon-group-title">Document</span>
        </div>
      </template>

      <!-- TAB: COMPARE -->
      <template v-else-if="activeRibbonTab === 'compare'">
        <div class="ribbon-group">
          <div class="ribbon-actions">
            <button
              class="ribbon-action active"
              title="Compare Luminaires Side-by-Side"
              @click="activeView = 'compare'"
            >
              <AppIcon name="compare" />
              <span class="ribbon-label">Side-by-Side</span>
            </button>
          </div>
          <span class="ribbon-group-title">Luminaire Comparison</span>
        </div>
      </template>

      <!-- TAB: VIEW -->
      <template v-else-if="activeRibbonTab === 'view'">
        <!-- UI Scaling Group -->
        <div class="ribbon-group">
          <div class="ribbon-actions">
            <button class="ribbon-action" title="Zoom In UI (+10%)" @click="zoomIn">
              <AppIcon name="zoom-in" />
              <span class="ribbon-label">Zoom In</span>
            </button>
            <button class="ribbon-action" title="Zoom Out UI (-10%)" @click="zoomOut">
              <AppIcon name="zoom-out" />
              <span class="ribbon-label">Zoom Out</span>
            </button>
            <button class="ribbon-action" title="Reset UI Scale to 100%" @click="resetScale">
              <AppIcon name="reset" />
              <span class="ribbon-label">Reset (100%)</span>
            </button>
          </div>
          <span class="ribbon-group-title">UI Scale ({{ Math.round(uiScale * 100) }}%)</span>
        </div>

        <!-- Scale Presets with Dedicated Visual Icons -->
        <div class="ribbon-group">
          <div class="ribbon-actions">
            <button
              class="ribbon-action"
              :class="{ active: Math.abs(uiScale - 0.85) < 0.03 }"
              title="Set Compact UI Scale (85%)"
              @click="setScale(0.85)"
            >
              <AppIcon name="scale-compact" />
              <span class="ribbon-label">Compact 85%</span>
            </button>
            <button
              class="ribbon-action"
              :class="{ active: Math.abs(uiScale - 1.0) < 0.03 }"
              title="Set Default UI Scale (100%)"
              @click="setScale(1.0)"
            >
              <AppIcon name="scale-default" />
              <span class="ribbon-label">Default 100%</span>
            </button>
            <button
              class="ribbon-action"
              :class="{ active: Math.abs(uiScale - 1.15) < 0.03 }"
              title="Set Comfortable UI Scale (115%)"
              @click="setScale(1.15)"
            >
              <AppIcon name="scale-medium" />
              <span class="ribbon-label">Medium 115%</span>
            </button>
            <button
              class="ribbon-action"
              :class="{ active: Math.abs(uiScale - 1.3) < 0.03 }"
              title="Set Large UI Scale (130%)"
              @click="setScale(1.3)"
            >
              <AppIcon name="scale-large" />
              <span class="ribbon-label">Large 130%</span>
            </button>
          </div>
          <span class="ribbon-group-title">Scale Presets</span>
        </div>

        <!-- Panels Visibility -->
        <div class="ribbon-group">
          <div class="ribbon-actions">
            <button
              class="ribbon-action"
              :class="{ active: showInspector }"
              title="Toggle Luminaire Metadata Inspector"
              @click="showInspector = !showInspector"
            >
              <AppIcon name="edit" />
              <span class="ribbon-label">Inspector Rail</span>
            </button>
            <button
              class="ribbon-action"
              :class="{ active: showStatusBar }"
              title="Toggle Application Status Bar"
              @click="showStatusBar = !showStatusBar"
            >
              <AppIcon name="table" />
              <span class="ribbon-label">Status Bar</span>
            </button>
            <button
              class="ribbon-action"
              :title="theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'"
              @click="toggleTheme"
            >
              <AppIcon :name="theme === 'dark' ? 'sun' : 'moon'" />
              <span class="ribbon-label">{{ theme === 'dark' ? 'Light Theme' : 'Dark Theme' }}</span>
            </button>
          </div>
          <span class="ribbon-group-title">Layout & Theming</span>
        </div>
      </template>
    </RibbonToolbar>

    <!-- Main Workspace Body -->
    <main class="main-body">
      <!-- Side Inspector / Metadata Rail -->
      <aside v-if="showInspector" class="side-inspector">
        <div class="inspector-header">
          <span>Luminaire Inspector</span>
          <button class="theme-toggle-btn" title="Hide Inspector" @click="showInspector = false">
            <AppIcon name="close" :size="13" />
          </button>
        </div>

        <div class="inspector-content">
          <!-- Luminaire Identity -->
          <div class="data-card">
            <div class="data-card-title">Identity & Source</div>
            <div class="data-kv">
              <span class="k">Catalog:</span>
              <span class="v">{{ currentData?.keywords["[LUMCAT]"] || "Generic" }}</span>
            </div>
            <div class="data-kv">
              <span class="k">Manufacturer:</span>
              <span class="v">{{ currentData?.keywords["[MANUFAC]"] || "Lighting Analysts" }}</span>
            </div>
            <div class="data-kv">
              <span class="k">Luminaire:</span>
              <span class="v">{{ currentData?.keywords["[LUMINAIRE]"] || "Architectural Luminaire" }}</span>
            </div>
            <div class="data-kv">
              <span class="k">Lamp:</span>
              <span class="v">{{ currentData?.keywords["[LAMP]"] || "Integrated LED" }}</span>
            </div>
            <div class="data-kv">
              <span class="k">Test Lab:</span>
              <span class="v">{{ currentData?.keywords["[TESTLAB]"] || "Photometric Lab" }}</span>
            </div>
          </div>

          <!-- Photometric Characteristics -->
          <div class="data-card">
            <div class="data-card-title">Photometric Summary</div>
            <div class="data-kv">
              <span class="k">Total Luminaire Lumens:</span>
              <span class="v">{{ currentData?.calculated.totalLuminaireLumens.toLocaleString() }} lm</span>
            </div>
            <div class="data-kv">
              <span class="k">Input Watts:</span>
              <span class="v">{{ currentData?.inputWatts.toFixed(1) }} W</span>
            </div>
            <div class="data-kv">
              <span class="k">Luminous Efficacy:</span>
              <span class="v">{{ efficacyInfo }}</span>
            </div>
            <div class="data-kv">
              <span class="k">Max Intensity:</span>
              <span class="v">{{ maxCandelaInfo }}</span>
            </div>
            <div class="data-kv" style="cursor: pointer" title="Click to view full CIE Classification & Flux Code" @click="showCIEModal = true">
              <span class="k">CIE Classification:</span>
              <span class="v" style="color: var(--accent); text-decoration: underline">{{ currentData?.calculated.cieClassification }} ({{ currentData?.calculated.cieDetails?.fluxCode }})</span>
            </div>
            <div class="data-kv">
              <span class="k">BUG Rating (TM-15):</span>
              <span class="v">{{ currentData?.calculated.bugRating.fullRating }}</span>
            </div>
          </div>

          <!-- Goniophotometer Geometry -->
          <div class="data-card">
            <div class="data-card-title">Goniometer & Geometry</div>
            <div class="data-kv">
              <span class="k">Goniometer Type:</span>
              <span class="v">{{ currentData?.photometricType === 1 ? 'Type C' : currentData?.photometricType === 2 ? 'Type B' : 'Type A' }}</span>
            </div>
            <div class="data-kv">
              <span class="k">Symmetry:</span>
              <span class="v" style="text-transform: capitalize">{{ symmetryInfo }}</span>
            </div>
            <div class="data-kv">
              <span class="k">Luminous Size (L×W×H):</span>
              <span class="v">{{ dimensionsInfo }}</span>
            </div>
            <div class="data-kv">
              <span class="k">Vertical Angles:</span>
              <span class="v">{{ currentData?.numVerticalAngles }} pts</span>
            </div>
            <div class="data-kv">
              <span class="k">Horizontal Planes:</span>
              <span class="v">{{ currentData?.numHorizontalAngles }} planes</span>
            </div>
          </div>

          <!-- Reverse-Engineered Engine Status -->
          <div class="data-card">
            <div class="data-card-title">Engine Specs (Reversed)</div>
            <div class="data-kv">
              <span class="k">Integration:</span>
              <span class="v">Simpson's Rule 1°</span>
            </div>
            <div class="data-kv">
              <span class="k">Standard:</span>
              <span class="v">IES TM-15-11 BUG</span>
            </div>
            <div class="data-kv">
              <span class="k">Decompiled DLL:</span>
              <span class="v">LAICalcNETRev2.dll</span>
            </div>
            <div class="data-kv">
              <span class="k">Legacy Host:</span>
              <span class="v">VB6 + OLE Stream</span>
            </div>
          </div>
        </div>
      </aside>

      <!-- Center Viewport Area (Directly displays active tool view without duplicate tab bars) -->
      <section class="viewport-area">
        <div class="canvas-container">
          <!-- 3D View -->
          <Photometric3DViewer
            v-if="activeView === '3d'"
            :data="currentData"
            :wireframe="wireframeMode"
            :show-axes="show3DAxes"
            :show-rings="show3DRings"
          />

          <!-- 2D Polar & Cartesian Curves View -->
          <Polar2DViewer
            v-else-if="activeView === 'polar'"
            :data="currentData"
            :active-plane="selectedPolarPlane"
            :initial-plot-mode="selectedPlotMode"
            @update:active-plane="selectedPolarPlane = $event"
          />

          <!-- Iso-illuminance Template View -->
          <IsoIlluminanceViewer
            v-else-if="activeView === 'template'"
            :data="currentData"
          />

          <!-- Zonal Lumens View -->
          <ZonalLumensTable
            v-else-if="activeView === 'zonal'"
            :zones="currentData?.calculated.zonalLumens || []"
            :total-lumens="currentData?.calculated.totalLuminaireLumens || 0"
          />

          <!-- BUG Rating View -->
          <BUGRatingViewer
            v-else-if="activeView === 'bug' && currentData"
            :bug="currentData.calculated.bugRating"
          />

          <!-- CU Table View -->
          <CUTableViewer
            v-else-if="activeView === 'cu' && currentData"
            :cu="currentData.calculated.cuTable"
          />

          <!-- Formal Reports View -->
          <ReportViewer
            v-else-if="activeView === 'reports' && currentData"
            :data="currentData"
          />

          <!-- Compare Luminaires View -->
          <LuminaireCompare
            v-else-if="activeView === 'compare'"
            :primary-data="currentData"
            :secondary-data="comparisonSecondaryData"
          />
        </div>
      </section>
    </main>

    <!-- Bottom Status Bar -->
    <footer v-if="showStatusBar" class="status-bar">
      <div class="status-item">
        <span class="status-badge" />
        <span>LAICalcNETRev2 Photometric Engine Active</span>
      </div>

      <div class="status-item">
        <span>Goniometer: {{ currentData?.photometricType === 1 ? 'Type C' : 'Type B' }}</span>
        <span>•</span>
        <span>Symmetry: {{ symmetryInfo }}</span>
        <span>•</span>
        <span>Max: {{ currentData?.calculated.maxCandela.intensity }} cd</span>
      </div>

      <div class="status-item">
        <span>Scale: {{ Math.round(uiScale * 100) }}%</span>
        <span>•</span>
        <span>Three.js WebGL2</span>
        <span>•</span>
        <span>Tauri v2 + Vue 3</span>
      </div>
    </footer>

    <!-- Interactive Photometric File Editor Modal -->
    <PhotometricEditorModal
      v-if="showEditorModal && currentData"
      :data="currentData"
      @save="handleEditorSave"
      @close="showEditorModal = false"
    />

    <!-- CIE Luminaire Classification & Flux Code Modal -->
    <CIEClassificationModal
      v-if="showCIEModal && currentData"
      :data="currentData"
      @close="showCIEModal = false"
    />

    <!-- Goniometer B/C Web Converter Modal -->
    <GoniometerConverterModal
      v-if="showConverterModal && currentData"
      :data="currentData"
      @apply="handleLuminaireLoad"
      @close="showConverterModal = false"
    />

    <!-- New Luminaire Profile Generator Modal -->
    <NewLuminaireModal
      v-if="showNewLuminaireModal"
      @created="handleLuminaireLoad"
      @close="showNewLuminaireModal = false"
    />

    <!-- Photometric Library Search Catalog Modal -->
    <PhotometricLibraryCatalog
      v-if="showCatalogModal"
      @load="handleLuminaireLoad"
      @compare="handleCompareWith"
      @close="showCatalogModal = false"
    />

    <!-- About / Information Modal -->
    <div v-if="showAboutModal" class="modal-backdrop" @click.self="showAboutModal = false">
      <div class="modal-dialog about-modal">
        <div class="modal-header">
          <div class="modal-title">
            <AppIcon name="lightbulb" :size="20" />
            <span>About Open Photometric Toolbox</span>
          </div>
          <button class="theme-toggle-btn" title="Close" @click="showAboutModal = false">
            <AppIcon name="close" :size="14" />
          </button>
        </div>

        <div class="modal-body about-body">
          <div class="about-hero">
            <div class="about-hero-icon">
              <AppIcon name="lightbulb" :size="32" />
            </div>
            <div class="about-hero-text">
              <h2>Open Photometric Toolbox</h2>
              <div class="about-badge">Version 1.0.0</div>
              <p class="about-tagline">
                Professional Photometric Engineering, Calculation & Luminaire Distribution Analysis Suite
              </p>
            </div>
          </div>

          <div class="about-section">
            <h3>Overview</h3>
            <p>
              Open Photometric Toolbox is a comprehensive engineering workstation for lighting designers, luminaire manufacturers, and test laboratories. It provides precision calculation, visualization, conversion, and reporting for standardized architectural, roadway, and floodlight distributions.
            </p>
          </div>

          <div class="about-section">
            <h3>Key Capabilities</h3>
            <div class="about-features-grid">
              <div class="about-feature-item">
                <AppIcon name="polar" :size="18" />
                <div>
                  <strong>3D & 2D Candela Analysis</strong>
                  <span>Interactive 3D WebGL solid webs with false-color heatmap rendering, high-resolution SVG Polar distributions, and zoomable Cartesian X-Y linear plots.</span>
                </div>
              </div>

              <div class="about-feature-item">
                <AppIcon name="table" :size="18" />
                <div>
                  <strong>Zonal Lumens & TM-15 BUG Ratings</strong>
                  <span>Simpson's 1° numerical integration for zonal flux distributions and complete Backlight-Uplight-Glare (BUG) ratings.</span>
                </div>
              </div>

              <div class="about-feature-item">
                <AppIcon name="lightbulb" :size="18" />
                <div>
                  <strong>Indoor & Roadway Calculations</strong>
                  <span>CIE luminaire classification, Spacing Criteria (SC 0°/90°), and Coefficients of Utilization (CU) tables via the Zonal Cavity Method.</span>
                </div>
              </div>

              <div class="about-feature-item">
                <AppIcon name="convert" :size="18" />
                <div>
                  <strong>Goniometer Web Coordinate Converter</strong>
                  <span>Bidirectional spherical coordinate conversions between Type B (Floodlights) and Type C (Architectural / Roadway luminaires).</span>
                </div>
              </div>

              <div class="about-feature-item">
                <AppIcon name="compare" :size="18" />
                <div>
                  <strong>Profile Synthesis & Luminaire Compare</strong>
                  <span>Synthetic LM-63 luminaire profile generator wizard and multi-luminaire side-by-side curve comparison with delta metrics.</span>
                </div>
              </div>

              <div class="about-feature-item">
                <AppIcon name="report" :size="18" />
                <div>
                  <strong>Standard Formats & Reporting</strong>
                  <span>Bidirectional IES LM-63 and European EULUMDAT (.ldt) support with exportable print-isolated PDF and standalone HTML photometric reports.</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="modal-btn" @click="showAboutModal = false">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.modal-dialog {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--control-radius);
  width: 700px;
  max-width: 90vw;
  max-height: 85vh;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--line);
  background: var(--well);
}

.modal-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--text);
}

.modal-body {
  padding: 16px;
  overflow-y: auto;
  font-size: 0.85rem;
  color: var(--muted);
}

.modal-body h3 {
  font-size: 0.95rem;
  color: var(--text);
  margin-bottom: 6px;
}

.about-hero {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: var(--raised);
  border: 1px solid var(--line);
  border-radius: var(--control-radius);
  margin-bottom: 16px;
}

.about-hero-icon {
  width: 52px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-soft);
  color: var(--accent);
  border-radius: 8px;
  flex-shrink: 0;
}

.about-hero-text h2 {
  margin: 0;
  font-size: 1.25rem;
  color: var(--text);
  display: inline-block;
  margin-right: 8px;
}

.about-badge {
  display: inline-block;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 12px;
  background: var(--well);
  border: 1px solid var(--line);
  color: var(--muted);
  vertical-align: middle;
}

.about-tagline {
  margin: 4px 0 0;
  font-size: 0.85rem;
  color: var(--muted);
}

.about-section {
  margin-bottom: 16px;
}

.about-section h3 {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 8px;
}

.about-section p {
  line-height: 1.6;
  margin: 0;
  color: var(--text);
}

.about-features-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.about-feature-item {
  display: flex;
  gap: 10px;
  padding: 10px;
  background: var(--raised);
  border: 1px solid var(--line-soft);
  border-radius: var(--control-radius);
}

.about-feature-item svg {
  color: var(--accent);
  flex-shrink: 0;
  margin-top: 2px;
}

.about-feature-item strong {
  display: block;
  font-size: 0.82rem;
  color: var(--text);
  margin-bottom: 2px;
}

.about-feature-item span {
  display: block;
  font-size: 0.75rem;
  color: var(--muted);
  line-height: 1.4;
}

.modal-footer {
  padding: 10px 16px;
  border-top: 1px solid var(--line);
  background: var(--well);
  display: flex;
  justify-content: flex-end;
}

.modal-btn {
  background: var(--accent);
  color: white;
  border: 0;
  padding: 6px 16px;
  border-radius: var(--control-radius);
  font-weight: 500;
  cursor: pointer;
}

.modal-btn:hover {
  filter: brightness(1.1);
}
</style>
