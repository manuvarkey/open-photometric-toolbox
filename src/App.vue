<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, nextTick, ref, watch } from "vue";
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

type RibbonTab = "file" | "visualize" | "analysis" | "compare" | "reports";

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
const activeRibbonTab = ref<RibbonTab>("visualize");
const activeView = ref<ViewportMode>("3d");
const showInspector = ref(true);
const visualizationView = ref<"3d" | "polar" | "template">("3d");
const analysisView = ref<"zonal" | "bug" | "cu">("zonal");
const illuminanceUnits = ref<"fc" | "lux">("fc");
const mountingHeight = ref(8);
const statusMessage = ref("Ready");
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
const compareInput = ref<HTMLInputElement>();
function chooseCompareFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  void file.text().then(content => { try { comparisonSecondaryData.value = parseIES(content, file.name); } catch (error) { alert(`Could not open comparison file: ${error}`); } input.value = ""; });
}
function compareSample(sample: "downlight" | "roadway" | "floodlight") {
  const samples = { downlight: [COMMERCIAL_DOWNLIGHT_IES, "Downlight.ies"], roadway: [ROADWAY_COBRA_HEAD_IES, "Roadway.ies"], floodlight: [FLOODLIGHT_NEMA_IES, "Floodlight.ies"] };
  comparisonSecondaryData.value = parseIES(samples[sample][0], samples[sample][1]);
}

function handleLuminaireLoad(loaded: PhotometricData) {
  currentData.value = loaded;
  currentFileName.value = loaded.fileName;
  statusMessage.value = `Loaded ${loaded.fileName}.`;
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
  if (tab === "visualize") activeView.value = visualizationView.value;
  else if (tab === "analysis") activeView.value = analysisView.value;
  else if (tab === "reports" || tab === "compare") activeView.value = tab;
}
function selectView(view: "3d" | "polar" | "template") { visualizationView.value = view; activeView.value = view; }
function selectAnalysis(view: "zonal" | "bug" | "cu") { analysisView.value = view; activeView.value = view; }
function navigateTabs(event: KeyboardEvent) {
  const tabs: RibbonTab[] = ["file", "visualize", "analysis", "compare", "reports"];
  if (!(event.target instanceof HTMLElement) || event.target.getAttribute("role") !== "tab") return;
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const index = tabs.indexOf(activeRibbonTab.value);
  const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
  selectRibbonTab(tabs[next]);
  (event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
}
function dismissMenus(event: MouseEvent) {
  const target = event.target as HTMLElement;
  const clickedMenu = target.closest<HTMLDetailsElement>(".ribbon details, .display-menu");
  const modalOpen = [showAboutModal, showEditorModal, showCIEModal, showConverterModal, showNewLuminaireModal, showCatalogModal].some(state => state.value);
  document.querySelectorAll<HTMLDetailsElement>(".ribbon details[open], .display-menu[open]").forEach(menu => {
    if (menu !== clickedMenu || (target.closest("button") && !modalOpen)) {
      const hadFocus = menu.contains(document.activeElement);
      menu.open = false;
      if (hadFocus) menu.querySelector<HTMLElement>("summary")?.focus();
    }
  });
}
function handleShortcuts(event: KeyboardEvent) {
  const backdrop = document.querySelector<HTMLElement>(".modal-backdrop");
  if (event.key === "Tab" && backdrop) {
    const focusable = Array.from(backdrop.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
      .filter(element => element.getClientRects().length > 0);
    if (focusable.length) {
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !backdrop.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !backdrop.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    }
  }
  if (event.key === "Escape") {
    const modal = [showAboutModal, showEditorModal, showCIEModal, showConverterModal, showNewLuminaireModal, showCatalogModal].find(state => state.value);
    if (modal) { modal.value = false; event.preventDefault(); return; }
    const menus = Array.from(document.querySelectorAll<HTMLDetailsElement>(".ribbon details[open], .display-menu[open]"));
    if (menus.length) {
      const menu = menus[menus.length - 1];
      menu.open = false;
      menu.querySelector("summary")?.focus();
      event.preventDefault();
      return;
    }
  }
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
  if (backdrop && ["o", "s"].includes(event.key.toLowerCase())) { event.preventDefault(); return; }
  if (event.key.toLowerCase() === "o") { event.preventDefault(); void openFile(); }
  if (event.key.toLowerCase() === "s") { event.preventDefault(); void saveFile(); }
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
    const parsed = parseIES(content, name);
    currentData.value = parsed;
    currentFileName.value = name;
    statusMessage.value = `Loaded ${name}.`;
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
        filters: [{ name: "IES Photometric Files", extensions: ["ies", "txt"] }],
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
  target.value = "";
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
        statusMessage.value = `Saved ${selected.split(/[\\/]/).pop() || currentFileName.value}.`;
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
  statusMessage.value = "IES download started.";
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
  statusMessage.value = "LDT export started.";
}

// UI Scale Methods
function setScale(scale: number) {
  uiScale.value = Math.max(0.75, Math.min(1.5, Math.round(scale * 100) / 100));
  document.documentElement.style.setProperty("--ui-scale", String(uiScale.value));
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
  statusMessage.value = "Luminaire changes applied.";
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

async function copyData() {
  if (!currentData.value) return;
  const c = currentData.value.calculated;
  const text = `Photometric Report: ${currentFileName.value}
Catalog: ${currentData.value.keywords["LUMCAT"] || "Generic"}
Total Luminaire Lumens: ${c.totalLuminaireLumens} lm
Input Watts: ${currentData.value.inputWatts} W
Efficacy (LER): ${c.efficacyLER} lm/W
Max Candela: ${c.maxCandela.intensity} cd (V:${c.maxCandela.verticalAngle}°, H:${c.maxCandela.horizontalAngle}°)
BUG Rating: ${c.bugRating.fullRating}
CIE Classification: ${c.cieClassification} (${c.cieDetails?.fluxCode || ""})
DIN 5040: ${c.cieDetails?.din5040Class || "A40"}
Symmetry: ${symmetryInfo.value}`;
  try {
    await navigator.clipboard.writeText(text);
    statusMessage.value = "Photometric summary copied.";
    if (!showStatusBar.value) alert(statusMessage.value);
  } catch (error) {
    statusMessage.value = "Could not copy photometric summary.";
    alert(`${statusMessage.value} ${error}`);
  }
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

let dialogTrigger: HTMLElement | null = null;
watch([showAboutModal, showEditorModal, showCIEModal, showConverterModal, showNewLuminaireModal, showCatalogModal], async (states, previous) => {
  if (states.some(Boolean) && !previous.some(Boolean)) {
    dialogTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    await nextTick();
    document.querySelector<HTMLElement>(".modal-backdrop button, .modal-backdrop input, .modal-backdrop select")?.focus();
  } else if (!states.some(Boolean) && previous.some(Boolean)) {
    await nextTick();
    const trigger = dialogTrigger?.isConnected && dialogTrigger.getClientRects().length
      ? dialogTrigger
      : dialogTrigger?.closest("details")?.querySelector<HTMLElement>("summary");
    if (trigger?.isConnected && trigger.getClientRects().length) trigger.focus();
    else document.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus();
    dialogTrigger = null;
  }
});

onMounted(async () => {
  document.documentElement.dataset.theme = theme.value;
  window.addEventListener("keydown", handleShortcuts);
  document.addEventListener("click", dismissMenus);
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
onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleShortcuts);
  document.removeEventListener("click", dismissMenus);
});
</script>

<template>
  <div class="app-container">
    <!-- Hidden File Input for Browser / Non-Tauri File Dialog -->
    <input
      ref="fileInput"
      type="file"
      accept=".ies,.txt"
      style="display: none"
      @change="handleFileInput"
    />

    <input ref="compareInput" type="file" accept=".ies,.txt" hidden @change="chooseCompareFile" />

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
            aria-label="About Open Photometric Toolbox" title="About Open Photometric Toolbox"
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

    <nav class="ribbon-tabs" role="tablist" aria-label="Workspace" @keydown="navigateTabs">
      <button v-for="tab in (['file', 'visualize', 'analysis', 'compare', 'reports'] as const)" :key="tab" role="tab" :aria-selected="activeRibbonTab === tab" :tabindex="activeRibbonTab === tab ? 0 : -1" :class="{ active: activeRibbonTab === tab }" @click="selectRibbonTab(tab)">{{ tab === 'analysis' ? 'Analyze' : tab.charAt(0).toUpperCase() + tab.slice(1) }}</button>
      <details class="display-menu"><summary>Display</summary><div class="menu-content">
        <label><input v-model="showInspector" type="checkbox"> Show Inspector</label>
        <button @click="toggleTheme">Theme: {{ theme === 'dark' ? 'Dark' : 'Light' }}</button>
        <label>UI Scale <select :value="uiScale" @change="setScale(Number(($event.target as HTMLSelectElement).value))"><option :value="1">100%</option><option :value="1.1">110%</option><option :value="1.2">120%</option><option :value="1.3">130%</option><option :value="1.5">150%</option></select></label>
        <label><input v-model="showStatusBar" type="checkbox"> Status Bar</label>
      </div></details>
    </nav>
    <RibbonToolbar ref="ribbonToolbar">
      <div v-if="activeRibbonTab === 'file'" class="compact-commands">
        <button @click="showNewLuminaireModal = true">New Luminaire</button><button @click="openFile">Open</button><button @click="saveFile">Save IES</button><button class="file-secondary" @click="showEditorModal = true">Edit Luminaire</button><button class="file-secondary" @click="exportLDT">Export LDT</button><button class="file-secondary" @click="showCatalogModal = true">Library</button>
        <details class="file-more"><summary>More</summary><div class="menu-content"><button @click="showEditorModal = true">Edit Luminaire</button><button @click="exportLDT">Export LDT</button><button @click="showCatalogModal = true">Library</button></div></details>
        <details><summary>Samples</summary><div class="menu-content"><button @click="loadSample('downlight')">Downlight</button><button @click="loadSample('roadway')">Roadway</button><button @click="loadSample('floodlight')">Floodlight</button></div></details>
      </div>
      <div v-else-if="activeRibbonTab === 'visualize'" class="compact-commands">
        <label>View <select :value="visualizationView" @change="selectView(($event.target as HTMLSelectElement).value as typeof visualizationView)"><option value="3d">3D Candela Web</option><option value="polar">2D Candela Plot</option><option value="template">Iso-illuminance</option></select></label>
        <template v-if="visualizationView === '3d'"><label>Rendering <select v-model="wireframeMode"><option :value="false">Solid</option><option :value="true">Wireframe</option></select></label><details><summary>Overlays</summary><div class="menu-content"><label><input v-model="show3DAxes" type="checkbox"> Axes</label><label><input v-model="show3DRings" type="checkbox"> Rings</label></div></details></template>
        <template v-else-if="visualizationView === 'polar'"><label>Plot <select v-model="selectedPlotMode"><option value="polar">Polar</option><option value="cartesian">Cartesian</option></select></label><label>Plane <select v-model="selectedPolarPlane"><option value="all">All planes</option><option value="max">Max plane</option><option value="0">0° Transverse</option><option value="90">90° Longitudinal</option></select></label></template>
        <label v-else>Illuminance Units <select v-model="illuminanceUnits"><option value="fc">Footcandles</option><option value="lux">Lux</option></select></label>
      </div>
      <div v-else-if="activeRibbonTab === 'analysis'" class="compact-commands">
        <label>View <select :value="analysisView" @change="selectAnalysis(($event.target as HTMLSelectElement).value as typeof analysisView)"><option value="zonal">Zonal Lumens</option><option value="bug">BUG Rating</option><option value="cu">CU Table</option></select></label><button class="analysis-secondary" @click="showCIEModal = true">CIE Classification</button><button class="analysis-secondary" @click="copyData">Copy Photometric Summary</button><details class="analysis-more"><summary>More</summary><div class="menu-content"><button @click="showCIEModal = true">CIE Classification</button><button @click="copyData">Copy Photometric Summary</button></div></details><details><summary>Utilities</summary><div class="menu-content"><button @click="showConverterModal = true">Convert Type B/C</button></div></details>
      </div>
      <div v-else-if="activeRibbonTab === 'compare'" class="compact-commands"><span class="compare-filename" :title="currentFileName">A: {{ currentFileName }}</span><span class="compare-filename" :title="comparisonSecondaryData?.fileName || 'Roadway_150W.ies'">B: {{ comparisonSecondaryData?.fileName || 'Roadway_150W.ies' }}</span><details><summary>Choose Luminaire</summary><div class="menu-content"><button @click="compareInput?.click()">Open file</button><button @click="showCatalogModal = true">Library</button><button @click="compareSample('downlight')">Downlight sample</button><button @click="compareSample('roadway')">Roadway sample</button><button @click="compareSample('floodlight')">Floodlight sample</button></div></details></div>
      <div v-else class="compact-commands"><span>Report options and export are beside the preview.</span></div>
    </RibbonToolbar>

    <main class="main-body">
      <!-- Side Inspector / Metadata Rail -->
      <aside v-if="showInspector" class="side-inspector">
        <div class="inspector-header">
          <span>Luminaire Inspector</span>
          <button class="theme-toggle-btn" aria-label="Hide Inspector" title="Hide Inspector" @click="showInspector = false">
            <AppIcon name="close" :size="13" />
          </button>
        </div>

        <div class="inspector-content">
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
            <button class="data-kv inspector-cie" title="View CIE Classification & Flux Code" @click="showCIEModal = true">
              <span class="k">CIE Classification:</span>
              <span class="v" style="color: var(--accent); text-decoration: underline">{{ currentData?.calculated.cieClassification }} ({{ currentData?.calculated.cieDetails?.fluxCode }})</span>
            </button>
            <div class="data-kv">
              <span class="k">BUG Rating (TM-15):</span>
              <span class="v">{{ currentData?.calculated.bugRating.fullRating }}</span>
            </div>
          </div>

          <!-- Luminaire Identity -->
          <details class="data-card">
            <summary class="data-card-title">Identity & Source</summary>
            <div class="data-kv">
              <span class="k">Catalog:</span>
              <span class="v">{{ currentData?.keywords["LUMCAT"] || "Generic" }}</span>
            </div>
            <div class="data-kv">
              <span class="k">Manufacturer:</span>
              <span class="v">{{ currentData?.keywords["MANUFAC"] || "Lighting Analysts" }}</span>
            </div>
            <div class="data-kv">
              <span class="k">Luminaire:</span>
              <span class="v">{{ currentData?.keywords["LUMINAIRE"] || "Architectural Luminaire" }}</span>
            </div>
            <div class="data-kv">
              <span class="k">Lamp:</span>
              <span class="v">{{ currentData?.keywords["LAMP"] || "Integrated LED" }}</span>
            </div>
            <div class="data-kv">
              <span class="k">Test Lab:</span>
              <span class="v">{{ currentData?.keywords["TESTLAB"] || "Photometric Lab" }}</span>
            </div>
          </details>

          <!-- Goniophotometer Geometry -->
          <details class="data-card">
            <summary class="data-card-title">Goniometer & Geometry</summary>
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
          </details>


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
          />

          <!-- Iso-illuminance Template View -->
          <IsoIlluminanceViewer
            v-else-if="activeView === 'template'"
            :data="currentData"
            :units="illuminanceUnits"
            v-model:mounting-height="mountingHeight"
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
        <span role="status" aria-live="polite">{{ currentFileName }} — {{ statusMessage }}</span>
      </div>

      <div class="status-item">
        <span>Scale: {{ Math.round(uiScale * 100) }}%</span>
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
      <div class="modal-dialog about-modal" role="dialog" aria-modal="true" aria-label="About Open Photometric Toolbox">
        <div class="modal-header">
          <div class="modal-title">
            <AppIcon name="lightbulb" :size="20" />
            <span>About Open Photometric Toolbox</span>
          </div>
          <button class="theme-toggle-btn" aria-label="Close" title="Close" @click="showAboutModal = false">
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
            <h3>Engine details</h3>
            <p>Simpson's rule integration at 1°; IES TM-15-11 BUG ratings. Legacy reference: LAICalcNETRev2 and VB6/OLE Stream.</p>
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
                  <span>IES LM-63 import and export, European EULUMDAT (.ldt) export, print-isolated PDF output, and standalone HTML photometric reports.</span>
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
