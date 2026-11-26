<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, nextTick, ref, shallowRef, defineAsyncComponent, watch, h, type AsyncComponentLoader } from "vue";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open } from "@tauri-apps/plugin-dialog";
import AppIcon from "./components/AppIcon.vue";
import RibbonAction from "./components/RibbonAction.vue";
import ThemedSelect from "./components/ThemedSelect.vue";
import { useLuminaireCatalog } from "./composables/useLuminaireCatalog";
import { parsePhotometric } from "./core/photometricParser";
import { readPhotometricText, savePhotometricText } from "./services/photometricFiles";
import { initializeInterfaceTypography } from "./services/interfaceTypography";
import { listSystemFonts, nativeFonts } from "./services/systemFonts";
import { toTypeCData } from "./core/goniometerConversion";
// Keep shell settings available while optional tool chunks load or fail.
function lazyTool(loader: AsyncComponentLoader) {
  return defineAsyncComponent({
    loader,
    delay: 150,
    loadingComponent: { render: () => h('div', { class: 'tool-load-state', role: 'status' }, 'Loading tool…') },
    errorComponent: { render: () => h('div', { class: 'tool-load-state', role: 'alert' }, [
      h('p', 'The tool could not be loaded. Reload the application to try again.'),
      h('button', { onClick: () => window.location.reload() }, 'Reload application'),
    ]) },
  });
}
const BUGRatingViewer = lazyTool(() => import("./components/BUGRatingViewer.vue"));
const CIEClassificationViewer = lazyTool(() => import("./components/CIEClassificationViewer.vue"));
const CUTableViewer = lazyTool(() => import("./components/CUTableViewer.vue"));
const GoniometerConverterModal = lazyTool(() => import("./components/GoniometerConverterModal.vue"));
const IsoIlluminanceViewer = lazyTool(() => import("./components/IsoIlluminanceViewer.vue"));
const LuminaireCompare = lazyTool(() => import("./components/LuminaireCompare.vue"));
const NewLuminaireModal = lazyTool(() => import("./components/NewLuminaireModal.vue"));
const Photometric3DViewer = lazyTool(() => import("./components/Photometric3DViewer.vue"));
const PhotometricEditorModal = lazyTool(() => import("./components/PhotometricEditorModal.vue"));
const PhotometricLibraryCatalog = lazyTool(() => import("./components/PhotometricLibraryCatalog.vue"));
const Polar2DViewer = lazyTool(() => import("./components/Polar2DViewer.vue"));
const ReportViewer = lazyTool(() => import("./components/ReportViewer.vue"));
import RibbonToolbar from "./components/RibbonToolbar.vue";
const ZonalLumensTable = lazyTool(() => import("./components/ZonalLumensTable.vue"));
import { serializeEULUMDAT } from "./core/eulumdatConverter";
import { serializeIES } from "./core/iesParser";
import type { PhotometricData } from "./core/types";

type RibbonTab = "file" | "visualize" | "analysis" | "compare" | "reports";
type AnalysisView = "zonal" | "bug" | "cu" | "cie";

type ViewportMode =
  | "3d"
  | "polar"
  | "template"
  | AnalysisView
  | "reports"
  | "compare";

// State
const currentData = shallowRef<PhotometricData | null>(null);
const library = useLuminaireCatalog(currentData);
const { selectionA, selectionB, primary: comparisonPrimaryData, secondary: comparisonSecondaryData, options: comparisonOptions } = library;
const comparisonTarget = ref<"A" | "B">("B");
const catalogTarget = ref<"workspace" | "A" | "B">("workspace");
const reportFont = ref("system-ui");
const reportFonts = ref<string[]>([]);
const reportFontMessage = ref("");
const reportFontsLoading = ref(false);
const reportFontOptions = computed(() => [
  { label: "System default", value: "system-ui" },
  ...reportFonts.value.map(family => ({ label: family, value: family })),
]);
const reportViewer = ref<{ printReport: () => Promise<void>; downloadHtmlReport: () => Promise<void> }>();
const reportZoom = ref<number | "fit">("fit");
const reportZoomOptions = [
  { label: "Fit width", value: "fit" },
  ...[50, 75, 100, 125, 150, 200].map(value => ({ label: `${value}%`, value })),
];
const reportFontScale = ref(100);
const reportFontScaleOptions = [80, 90, 100, 110, 120, 130].map(value => ({ label: `${value}%`, value }));
async function loadReportFonts() {
  reportFontsLoading.value = true;
  try {
    reportFonts.value = await listSystemFonts();
    reportFontMessage.value = `${reportFonts.value.length} installed font families`;
  } catch (error) {
    reportFontMessage.value = error instanceof Error ? error.message : String(error);
  } finally {
    reportFontsLoading.value = false;
  }
}

const plotData = computed(() => currentData.value ? toTypeCData(currentData.value) : null);
const reportType = ref<"indoor" | "roadway" | "floodlight">("indoor");
const reportTypes = [
  { label: "Indoor", value: "indoor" },
  { label: "Roadway", value: "roadway" },
  { label: "Floodlight", value: "floodlight" },
] as const;
const currentFileName = ref("Commercial_Downlight_40W.ies");
const activeRibbonTab = ref<RibbonTab>("visualize");
const activeView = ref<ViewportMode>("3d");
const showInspector = ref(true);
const workspace = ref<HTMLElement>();
const workspaceWidth = ref(window.innerWidth);
const inspectorWidth = ref<number>();
const minInspectorWidth = 180;
const maxInspectorWidth = computed(() => Math.max(minInspectorWidth, Math.min(520, Math.floor(workspaceWidth.value * 0.55))));
const actualInspectorWidth = computed(() => Math.min(maxInspectorWidth.value, Math.max(
  minInspectorWidth,
  inspectorWidth.value ?? Math.min(320, Math.round(workspaceWidth.value * 0.24)),
)));
let inspectorDrag: { pointerId: number; x: number; width: number } | undefined;
let workspaceObserver: ResizeObserver | undefined;
const visualizationView = ref<"3d" | "polar" | "template">("3d");
const analysisView = ref<AnalysisView>("zonal");
const illuminanceUnits = ref<"fc" | "lux">("fc");
const mountingHeight = ref(8);
const statusMessage = ref("Ready");
const showStatusBar = ref(true);
const showAboutModal = ref(false);
const showEditorModal = ref(false);
const showConverterModal = ref(false);
const showNewLuminaireModal = ref(false);
const showCatalogModal = ref(false);
const selectedPolarPlane = ref<"all" | "max" | "0" | "90">("all");
const selectedPlotMode = ref<"polar" | "cartesian">("polar");
const uiScale = ref(1.0);
const theme = ref<"dark" | "light">("light");
const fileInput = ref<HTMLInputElement>();
const compareInput = ref<HTMLInputElement>();

function resizeInspector(width: number) {
  inspectorWidth.value = Math.min(maxInspectorWidth.value, Math.max(minInspectorWidth, Math.round(width)));
}
function startInspectorResize(event: PointerEvent) {
  if (!event.isPrimary || event.button !== 0) return;
  const handle = event.currentTarget as HTMLElement;
  handle.focus();
  handle.setPointerCapture(event.pointerId);
  inspectorDrag = { pointerId: event.pointerId, x: event.clientX, width: actualInspectorWidth.value };
}
function moveInspectorResize(event: PointerEvent) {
  if (inspectorDrag?.pointerId !== event.pointerId) return;
  resizeInspector(inspectorDrag.width + (event.clientX - inspectorDrag.x) / uiScale.value);
}
function endInspectorResize(event: PointerEvent) {
  if (inspectorDrag?.pointerId === event.pointerId) inspectorDrag = undefined;
}
function resizeInspectorWithKeys(event: KeyboardEvent) {
  const widths: Record<string, number> = {
    ArrowLeft: actualInspectorWidth.value - 16,
    ArrowRight: actualInspectorWidth.value + 16,
    Home: minInspectorWidth,
    End: maxInspectorWidth.value,
  };
  if (!Object.hasOwn(widths, event.key)) return;
  event.preventDefault();
  resizeInspector(widths[event.key]);
}
async function chooseCompareFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  const slot = comparisonTarget.value;
  if (!file) return;
  try { library.select(slot, parsePhotometric(await readPhotometricText(file), file.name)); }
  catch (error) { statusMessage.value = `Could not open comparison ${slot}: ${error instanceof Error ? error.message : error}`; }
  finally { input.value = ""; }
}
function openComparison(slot: "A" | "B") {
  comparisonTarget.value = slot;
  compareInput.value?.click();
}
function openCatalog(target: "workspace" | "A" | "B" = "workspace") {
  catalogTarget.value = target;
  showCatalogModal.value = true;
}
function handleLuminaireLoad(loaded: PhotometricData) {
  library.register(loaded);
  currentData.value = loaded;
  currentFileName.value = loaded.fileName;
  statusMessage.value = `Loaded ${loaded.fileName}.`;
}
function handleCatalogLoad(loaded: PhotometricData) {
  if (catalogTarget.value === "workspace") handleLuminaireLoad(loaded);
  else library.select(catalogTarget.value, loaded);
}
function handleCompareWith(other: PhotometricData) {
  library.select(catalogTarget.value === "A" ? "A" : "B", other);
  selectRibbonTab("compare");
}

// 3D Visualizer controls
const wireframeMode = ref(false);
const show3DAxes = ref(true);
const rings3D = ref({ horizontal: true, transverse: false, longitudinal: false, maximum: false });
const show3DAngleMarkers = ref(true);

// Ribbon reference
const ribbonToolbar = ref<InstanceType<typeof RibbonToolbar>>();

// Switch tab and sync primary viewport
function selectRibbonTab(tab: RibbonTab) {
  activeRibbonTab.value = tab;
  if (tab === "visualize") activeView.value = visualizationView.value;
  else if (tab === "analysis") activeView.value = analysisView.value;
  else if (tab === "reports" || tab === "compare") activeView.value = tab;
  if (tab === "reports" && nativeFonts() && !reportFontsLoading.value && !reportFonts.value.length) {
    void loadReportFonts();
  }
}
function selectView(view: "3d" | "polar" | "template") { visualizationView.value = view; activeView.value = view; }
function selectAnalysis(view: AnalysisView) { activeRibbonTab.value = "analysis"; analysisView.value = view; activeView.value = view; }
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
  const modalOpen = [showAboutModal, showEditorModal, showConverterModal, showNewLuminaireModal, showCatalogModal].some(state => state.value);
  document.querySelectorAll<HTMLDetailsElement>(".ribbon details[open], .display-menu[open]").forEach(menu => {
    if (menu !== clickedMenu || (target.closest("button") && !modalOpen)) {
      const hadFocus = menu.contains(document.activeElement);
      menu.open = false;
      if (hadFocus) menu.querySelector<HTMLElement>("summary")?.focus();
    }
  });
}
function handleShortcuts(event: KeyboardEvent) {
  if (event.defaultPrevented) return;
  const backdrop = document.querySelector<HTMLElement>(".modal-backdrop");
  if (event.key === "Tab" && backdrop) {
    const overlay = document.querySelector<HTMLElement>('[data-dialog-overlay="true"]');
    const scope = overlay ?? backdrop;
    const focusable = Array.from(scope.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
      .filter(element => element.getClientRects().length > 0);
    if (focusable.length) {
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !scope.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !scope.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    }
  }
  if (event.key === "Escape") {
    const modal = [showAboutModal, showEditorModal, showConverterModal, showNewLuminaireModal, showCatalogModal].find(state => state.value);
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
    const parsed = parsePhotometric(content, name);
    library.register(parsed);
    currentData.value = parsed;
    currentFileName.value = name;
    statusMessage.value = `Loaded ${name}.`;
  } catch (err: any) {
    alert("Could not open photometric file: " + (err?.message || err));
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
      statusMessage.value = `Could not open file: ${err instanceof Error ? err.message : String(err)}`;
    }
  } else {
    fileInput.value?.click();
  }
}

async function handleFileInput(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  try { loadFileContent(await readPhotometricText(file), file.name); }
  catch (error) { statusMessage.value = `Could not read ${file.name}: ${error instanceof Error ? error.message : error}`; }
}

// All photometric exports share native save/cancel/error behavior.
async function saveDocument(format: "ies" | "ldt") {
  if (!currentData.value) return;
  try {
    const content = format === "ies" ? serializeIES(currentData.value) : serializeEULUMDAT(currentData.value);
    const name = await savePhotometricText(content, currentFileName.value, format);
    if (name) statusMessage.value = isTauri() ? `Saved ${name}.` : `${format.toUpperCase()} download started.`;
  } catch (error) {
    statusMessage.value = `Could not save ${format.toUpperCase()}: ${error instanceof Error ? error.message : String(error)}`;
  }
}
function saveFile() { return saveDocument("ies"); }
function exportLDT() { return saveDocument("ldt"); }

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
let dialogObserver: MutationObserver | undefined;
watch([showAboutModal, showEditorModal, showConverterModal, showNewLuminaireModal, showCatalogModal], async (states, previous) => {
  if (states.some(Boolean) && !previous.some(Boolean)) {
    dialogTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    await nextTick();
    const focusDialog = () => document.querySelector<HTMLElement>('.modal-backdrop button, .modal-backdrop [role="combobox"], .modal-backdrop input')?.focus();
    if (document.querySelector('.modal-backdrop')) focusDialog();
    else {
      dialogObserver?.disconnect();
      dialogObserver = new MutationObserver(() => {
        if (document.querySelector('.modal-backdrop')) { focusDialog(); dialogObserver?.disconnect(); }
      });
      dialogObserver.observe(document.body, { childList: true, subtree: true });
    }
  } else if (!states.some(Boolean) && previous.some(Boolean)) {
    dialogObserver?.disconnect();
    await nextTick();
    const trigger = dialogTrigger?.isConnected && dialogTrigger.getClientRects().length
      ? dialogTrigger
      : dialogTrigger?.closest("details")?.querySelector<HTMLElement>("summary");
    if (trigger?.isConnected && trigger.getClientRects().length) trigger.focus();
    else document.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus();
    dialogTrigger = null;
  }
});

let disposeTypography: (() => void) | undefined;
let shellUnmounted = false;
onMounted(async () => {
  void initializeInterfaceTypography().then(dispose => { if (shellUnmounted) dispose(); else disposeTypography = dispose; }).catch(error => console.warn('Desktop typography initialization failed.', error));
  document.documentElement.dataset.theme = theme.value;
  window.addEventListener("keydown", handleShortcuts);
  document.addEventListener("click", dismissMenus);
  // Initialize with commercial downlight sample
  handleLuminaireLoad(library.catalog.value[0].data);
  if (workspace.value) {
    workspaceObserver = new ResizeObserver(([entry]) => { workspaceWidth.value = entry.contentRect.width; });
    workspaceObserver.observe(workspace.value);
  }

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
  shellUnmounted = true;
  disposeTypography?.();
  workspaceObserver?.disconnect();
  dialogObserver?.disconnect();
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
      accept=".ies,.ldt,.txt"
      style="display: none"
      @change="handleFileInput"
    />

    <input ref="compareInput" type="file" accept=".ies,.ldt,.txt" hidden @change="chooseCompareFile" />

    <!-- Header / Window Titlebar with Client-Side Decorations (CSD) -->
    <header class="window-titlebar" data-tauri-drag-region>
      <div class="app-branding" data-tauri-drag-region>
        <img src="/app-icon.svg" width="18" height="18" alt="" data-tauri-drag-region />
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
      <button v-for="tab in (['file', 'visualize', 'analysis', 'compare', 'reports'] as const)" :key="tab" role="tab" :aria-selected="activeRibbonTab === tab" :tabindex="activeRibbonTab === tab ? 0 : -1" :class="{ active: activeRibbonTab === tab }" @click="selectRibbonTab(tab)"><AppIcon :name="({ file: 'folder', visualize: 'cube', analysis: 'calculator', compare: 'compare', reports: 'report' })[tab]" :size="15" /><span>{{ tab === 'analysis' ? 'Analyze' : tab.charAt(0).toUpperCase() + tab.slice(1) }}</span></button>
      <details class="display-menu"><summary><AppIcon name="settings" :size="14" /> Display</summary><div class="menu-content">
        <label><input v-model="showInspector" type="checkbox"> Show Inspector</label>
        <button @click="toggleTheme">Theme: {{ theme === 'dark' ? 'Dark' : 'Light' }}</button>
        <label>UI Scale <ThemedSelect label="UI Scale" :model-value="uiScale" :options="[0.9,1,1.1,1.2,1.3,1.5].map(value => ({value, label: `${Math.round(value*100)}%`}))" @update:model-value="setScale" /></label>
        <label><input v-model="showStatusBar" type="checkbox"> Status Bar</label>
      </div></details>
    </nav>
    <RibbonToolbar ref="ribbonToolbar" :class="{ 'report-ribbon': activeRibbonTab === 'reports' }">
      <template v-if="activeRibbonTab === 'file'">
        <div class="ribbon-group"><div class="ribbon-actions">
          <RibbonAction icon="plus" label="New Luminaire" @click="showNewLuminaireModal = true" />
          <RibbonAction icon="open" label="Open" @click="openFile" />
          <RibbonAction icon="save" label="Save IES" @click="saveFile" />
        </div><small>Document</small></div>
        <div class="ribbon-group"><div class="ribbon-actions">
          <RibbonAction icon="edit" label="Edit Luminaire" @click="showEditorModal = true" />
          <RibbonAction icon="convert" label="Export LDT" @click="exportLDT" />
        </div><small>Photometry</small></div>
        <div class="ribbon-group"><div class="ribbon-actions">
          <RibbonAction icon="database" label="Library" @click="openCatalog()" />
        </div><small>Sources</small></div>
      </template>
      <template v-else-if="activeRibbonTab === 'visualize'">
        <div class="ribbon-group"><div class="ribbon-fields"><label>View <ThemedSelect label="View" :model-value="visualizationView" :options="[{label:'3D Candela Web',value:'3d'},{label:'2D Candela Plot',value:'polar'},{label:'Iso-illuminance',value:'template'}]" @update:model-value="selectView" /></label></div><small>Visualization</small></div>
        <div v-if="visualizationView === '3d'" class="ribbon-group"><div class="ribbon-fields">
          <label>Rendering <ThemedSelect label="Rendering" v-model="wireframeMode" :options="[{label:'Solid',value:false},{label:'Wireframe',value:true}]" /></label>
          <details>
            <summary>Overlays</summary>
            <div class="menu-content">
              <label><input v-model="show3DAxes" type="checkbox"> Axes</label>
              <label><input v-model="rings3D.horizontal" type="checkbox"> Horizontal ring</label>
              <label><input v-model="rings3D.transverse" type="checkbox"> Transverse ring (C0–C180)</label>
              <label><input v-model="rings3D.longitudinal" type="checkbox"> Longitudinal ring (C90–C270)</label>
              <label><input v-model="rings3D.maximum" type="checkbox" :disabled="!currentData"> Max plane ring</label>
              <label><input v-model="show3DAngleMarkers" type="checkbox"> Angle markers</label>
            </div>
          </details>
        </div><small>Appearance</small></div>
        <div v-else-if="visualizationView === 'polar'" class="ribbon-group"><div class="ribbon-fields">
          <label>Plot <ThemedSelect label="Plot" v-model="selectedPlotMode" :options="[{label:'Polar',value:'polar'},{label:'Cartesian',value:'cartesian'}]" /></label>
          <label>Plane <ThemedSelect label="Plane" v-model="selectedPolarPlane" :options="[{label:'All planes',value:'all'},{label:'Max plane',value:'max'},{label:'0° Transverse',value:'0'},{label:'90° Longitudinal',value:'90'}]" /></label>
        </div><small>Distribution</small></div>
        <div v-else class="ribbon-group"><div class="ribbon-fields"><label>Illuminance Units <ThemedSelect label="Illuminance Units" v-model="illuminanceUnits" :options="[{label:'Footcandles',value:'fc'},{label:'Lux',value:'lux'}]" /></label></div><small>Illuminance</small></div>
      </template>
      <template v-else-if="activeRibbonTab === 'analysis'">
        <div class="ribbon-group"><div class="ribbon-fields"><label>View <ThemedSelect label="View" :model-value="analysisView" :options="[{label:'Zonal Lumens',value:'zonal'},{label:'BUG Rating',value:'bug'},{label:'CU Table',value:'cu'},{label:'CIE Classification',value:'cie'}]" @update:model-value="selectAnalysis" /></label></div><small>Analysis</small></div>
        <div class="ribbon-group"><div class="ribbon-actions">
          <RibbonAction icon="chart" label="CIE Class" accessible-label="CIE Classification" :aria-pressed="activeView === 'cie'" @click="selectAnalysis('cie')" />
          <RibbonAction icon="report" label="Copy Summary" accessible-label="Copy Photometric Summary" @click="copyData" />
          <RibbonAction icon="convert" label="Convert B/C" accessible-label="Convert Type B/C" @click="showConverterModal = true" />
        </div><small>Tools</small></div>
      </template>
      <template v-else-if="activeRibbonTab === 'compare'">
        <div v-for="side in (['A','B'] as const)" :key="side" class="ribbon-group comparison-group"><div class="ribbon-fields compare-slot">
          <ThemedSelect :label="`Luminaire ${side}`" :model-value="side === 'A' ? selectionA : selectionB" :options="comparisonOptions" filter @update:model-value="side === 'A' ? selectionA = $event : selectionB = $event" />
          <button :aria-label="`Open luminaire ${side}`" :title="`Open luminaire ${side}`" @click="openComparison(side)"><AppIcon name="open" :size="18" /></button>
          <button :aria-label="`Library for ${side}`" :title="`Library for ${side}`" @click="openCatalog(side)"><AppIcon name="database" :size="18" /></button>
        </div><small>Luminaire {{ side }}</small></div>
      </template>
      <template v-else>
        <div class="ribbon-group">
          <div class="ribbon-fields report-types" role="group" aria-label="Report Type">
            <button
              v-for="type in reportTypes"
              :key="type.value"
              type="button"
              :aria-pressed="reportType === type.value"
              @click="reportType = type.value"
            >{{ type.label }}</button>
          </div>
          <small>Report Type</small>
        </div>
        <div class="ribbon-group">
          <div class="ribbon-fields report-fields">
            <label class="report-font-field">Report Font <ThemedSelect label="Report Font" v-model="reportFont" :options="reportFontOptions" :title="reportFont === 'system-ui' ? 'System default' : reportFont" filter /></label>
            <label>Font Scale <ThemedSelect label="Report Font Scale" v-model="reportFontScale" :options="reportFontScaleOptions" /></label>
            <label>Report Zoom <ThemedSelect label="Report Zoom" v-model="reportZoom" :options="reportZoomOptions" /></label>
          </div>
          <small>Preview</small>
        </div>
        <div class="ribbon-group">
          <div class="ribbon-actions">
            <RibbonAction icon="refresh" :label="reportFontsLoading ? 'Loading fonts…' : 'Load system fonts'" :disabled="reportFontsLoading" @click="loadReportFonts" />
            <RibbonAction icon="report" label="Print / Save PDF" :disabled="!reportViewer" @click="reportViewer?.printReport()" />
            <RibbonAction icon="save" label="Export HTML" accessible-label="Export HTML Report" :disabled="!reportViewer" @click="reportViewer?.downloadHtmlReport()" />
          </div>
          <small>Fonts &amp; Export</small>
        </div>
      </template>
    </RibbonToolbar>

    <main ref="workspace" class="main-body">
      <!-- Side Inspector / Metadata Rail -->
      <aside v-if="showInspector" id="luminaire-inspector" class="side-inspector" :style="{ width: `${actualInspectorWidth}px` }">
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
            <button class="data-kv inspector-cie" :disabled="!currentData" title="View CIE Classification & Flux Code" @click="selectAnalysis('cie')">
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
      <div
        v-if="showInspector"
        class="inspector-divider"
        role="separator"
        tabindex="0"
        aria-label="Resize Luminaire Inspector"
        aria-controls="luminaire-inspector"
        aria-orientation="vertical"
        :aria-valuemin="minInspectorWidth"
        :aria-valuemax="maxInspectorWidth"
        :aria-valuenow="actualInspectorWidth"
        @pointerdown="startInspectorResize"
        @pointermove="moveInspectorResize"
        @pointerup="endInspectorResize"
        @lostpointercapture="endInspectorResize"
        @keydown="resizeInspectorWithKeys"
      />

      <!-- Center Viewport Area (Directly displays active tool view without duplicate tab bars) -->
      <section class="viewport-area">
        <div class="canvas-container">
          <!-- 3D View -->
          <Photometric3DViewer
            v-if="activeView === '3d'"
            :data="currentData"
            :wireframe="wireframeMode"
            :show-axes="show3DAxes"
            :rings="rings3D"
            :show-angle-markers="show3DAngleMarkers"
            :max-plane-angle="rings3D.maximum ? plotData?.calculated.maxCandela.horizontalAngle : undefined"
          />

          <!-- 2D Polar & Cartesian Curves View -->
          <Polar2DViewer
            v-else-if="activeView === 'polar'"
            :data="plotData"
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

          <CIEClassificationViewer
            v-else-if="activeView === 'cie' && currentData"
            :data="currentData"
          />

          <!-- Formal Reports View -->
          <ReportViewer
            v-else-if="activeView === 'reports' && currentData"
            ref="reportViewer"
            :data="currentData"
            :font-family="reportFont"
            :font-scale="reportFontScale / 100"
            :report-type="reportType"
            :zoom="reportZoom"
            :font-message="reportFontMessage"
          />

          <!-- Compare Luminaires View -->
          <LuminaireCompare
            v-else-if="activeView === 'compare'"
            :primary-data="comparisonPrimaryData"
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
      :catalog="library.catalog.value"
      @import="library.register($event)"
      @load="handleCatalogLoad"
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
                  <span>IES LM-63 and European EULUMDAT (.ldt) import and export, print-isolated PDF output, and standalone HTML photometric reports.</span>
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
  font-size: var(--text-size-ui);
  color: var(--text);
}

.modal-body {
  padding: 16px;
  overflow-y: auto;
  font-size: var(--text-size-ui);
  color: var(--muted);
}

.modal-body h3 {
  font-size: var(--text-size-ui);
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
  font-size: var(--text-size-display);
  color: var(--text);
  display: inline-block;
  margin-right: 8px;
}

.about-badge {
  display: inline-block;
  font-size: var(--text-size-caption);
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
  font-size: var(--text-size-ui);
  color: var(--muted);
}

.about-section {
  margin-bottom: 16px;
}

.about-section h3 {
  font-size: var(--text-size-ui);
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
  font-size: var(--text-size-caption);
  color: var(--text);
  margin-bottom: 2px;
}

.about-feature-item span {
  display: block;
  font-size: var(--text-size-caption);
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
