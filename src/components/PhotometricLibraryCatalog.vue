<script setup lang="ts">
import { computed, ref } from "vue";
import AppIcon from "./AppIcon.vue";
import type { PhotometricData } from "../core/types";
import { parsePhotometric } from "../core/photometricParser";
import { readPhotometricText } from "../services/photometricFiles";
import ThemedSelect from "./ThemedSelect.vue";
import { polarPath } from "../utils/plotPaths";
import type { CatalogItem } from "../composables/useLuminaireCatalog";
const props = defineProps<{ catalog: readonly CatalogItem[] }>();
const emit = defineEmits<{
  (e: "close"): void;
  (e: "load", data: PhotometricData): void;
  (e: "compare", data: PhotometricData): void;
  (e: "import", data: PhotometricData): void;
}>();

const searchQuery = ref("");
const selectedCategory = ref<"all" | "indoor" | "roadway" | "floodlight" | "industrial">("all");
const sortBy = ref<"name" | "lumens" | "efficacy" | "watts">("name");
const fileInput = ref<HTMLInputElement>();

// Filtered and sorted catalog items
const filteredCatalog = computed(() => {
  return props.catalog
    .filter((item) => {
      // Category filter
      if (selectedCategory.value !== "all" && item.category !== selectedCategory.value) {
        return false;
      }
      // Text query
      if (searchQuery.value.trim()) {
        const q = searchQuery.value.toLowerCase();
        const d = item.data;
        const matchesName = d.fileName.toLowerCase().includes(q);
        const matchesCat = (d.keywords["LUMCAT"] || "").toLowerCase().includes(q);
        const matchesLum = (d.keywords["LUMINAIRE"] || "").toLowerCase().includes(q);
        const matchesMan = (d.keywords["MANUFAC"] || "").toLowerCase().includes(q);
        const matchesLamp = (d.keywords["LAMP"] || "").toLowerCase().includes(q);
        if (!matchesName && !matchesCat && !matchesLum && !matchesMan && !matchesLamp) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy.value === "lumens") {
        return b.data.calculated.totalLuminaireLumens - a.data.calculated.totalLuminaireLumens;
      }
      if (sortBy.value === "efficacy") {
        return b.data.calculated.efficacyLER - a.data.calculated.efficacyLER;
      }
      if (sortBy.value === "watts") {
        return b.data.inputWatts - a.data.inputWatts;
      }
      return a.data.fileName.localeCompare(b.data.fileName);
    });
});

// Imports are stored by the shell, so closing this dialog does not discard them.
async function handleImportFiles(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  input.value = "";
  for (const file of files) {
    try { emit("import", parsePhotometric(await readPhotometricText(file), file.name)); }
    catch (error) { window.alert(`Could not import ${file.name}: ${error instanceof Error ? error.message : error}`); }
  }
}
function getThumbnailPath(data: PhotometricData) { return polarPath(data, 36, 36, 30); }
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <div class="catalog-window" role="dialog" aria-modal="true" aria-label="Photometric Library">
      <!-- Header -->
      <div class="catalog-header">
        <div class="header-branding">
          <AppIcon name="database" :size="20" />
          <span>Photometric Library</span>
          <span class="count-badge">{{ filteredCatalog.length }} luminaires</span>
        </div>
        <div class="header-actions">
          <button class="button secondary" @click="fileInput?.click()">
            <AppIcon name="open" :size="14" />
            <span>Import IES / LDT Files</span>
          </button>
          <input
            ref="fileInput"
            type="file"
            multiple
            accept=".ies,.ldt,.txt"
            style="display: none"
            @change="handleImportFiles"
          />
          <button class="icon-button" aria-label="Close" title="Close" @click="emit('close')">
            <AppIcon name="close" :size="16" />
          </button>
        </div>
      </div>

      <!-- Search & Filters Toolbar -->
      <div class="search-toolbar">
        <div class="search-input-wrap">
          <AppIcon name="search" :size="16" />
          <input
            v-model="searchQuery"
            type="text"
            aria-label="Search luminaires"
            placeholder="Search by catalog number, luminaire name, manufacturer, or lamp..."
            class="search-input"
          />
          <button v-if="searchQuery" class="clear-btn" aria-label="Clear search" @click="searchQuery = ''">×</button>
        </div>

        <div class="filter-controls">
          <div class="category-pills">
            <button
              class="cat-pill"
              :class="{ active: selectedCategory === 'all' }"
              @click="selectedCategory = 'all'"
            >
              All
            </button>
            <button
              class="cat-pill"
              :class="{ active: selectedCategory === 'indoor' }"
              @click="selectedCategory = 'indoor'"
            >
              Indoor
            </button>
            <button
              class="cat-pill"
              :class="{ active: selectedCategory === 'roadway' }"
              @click="selectedCategory = 'roadway'"
            >
              Roadway
            </button>
            <button
              class="cat-pill"
              :class="{ active: selectedCategory === 'floodlight' }"
              @click="selectedCategory = 'floodlight'"
            >
              Floodlight
            </button>
          </div>

          <div class="sort-wrap">
            <label for="catalog-field-1">Sort:</label>
            <ThemedSelect label="Sort library" v-model="sortBy" :options="[{label:'Name / File',value:'name'},{label:'Lumens (High to Low)',value:'lumens'},{label:'Efficacy (LER)',value:'efficacy'},{label:'Power (Watts)',value:'watts'}]" />
          </div>
        </div>
      </div>

      <!-- Catalog Grid View -->
      <div class="catalog-grid">
        <div
          v-for="item in filteredCatalog"
          :key="item.id"
          class="catalog-card"
        >
          <!-- Left: Thumbnail Polar Shape -->
          <div class="card-thumbnail">
            <svg width="72" height="72" viewBox="0 0 72 72" class="thumb-svg">
              <circle cx="36" cy="36" r="30" fill="none" stroke="var(--line-soft, #3d3d46)" stroke-width="1" />
              <path :d="getThumbnailPath(item.data)" fill="rgba(217, 119, 6, 0.2)" stroke="var(--accent, #d97706)" stroke-width="1.5" />
            </svg>
          </div>

          <!-- Middle: Metadata -->
          <div class="card-details">
            <div class="card-title-row">
              <span class="lum-title">{{ item.data.keywords["LUMINAIRE"] || item.data.fileName }}</span>
              <span class="cat-badge">{{ item.category }}</span>
            </div>

            <div class="card-meta-line">
              <span class="lumcat">{{ item.data.keywords["LUMCAT"] || "Generic" }}</span>
              <span class="divider">•</span>
              <span class="manufac">{{ item.data.keywords["MANUFAC"] || "Standard" }}</span>
            </div>

            <div class="metrics-row">
              <div class="metric-pill">
                <span class="m-val">{{ item.data.calculated.totalLuminaireLumens.toLocaleString() }}</span>
                <span class="m-lbl">lm</span>
              </div>
              <div class="metric-pill">
                <span class="m-val">{{ item.data.inputWatts }}</span>
                <span class="m-lbl">W</span>
              </div>
              <div class="metric-pill">
                <span class="m-val">{{ item.data.calculated.efficacyLER }}</span>
                <span class="m-lbl">lm/W</span>
              </div>
              <div class="metric-pill">
                <span class="m-val">{{ item.data.calculated.cieClassification }}</span>
              </div>
              <div class="metric-pill">
                <span class="m-val">{{ item.data.calculated.bugRating.fullRating }}</span>
              </div>
            </div>
          </div>

          <!-- Right: Actions -->
          <div class="card-actions">
            <button class="button primary" title="Load into workspace" @click="emit('load', item.data); emit('close')">
              <AppIcon name="open" :size="14" />
              <span>Open</span>
            </button>
            <button class="button secondary" title="Compare side-by-side with current" @click="emit('compare', item.data); emit('close')">
              <AppIcon name="compare" :size="14" />
              <span>Compare</span>
            </button>
          </div>
        </div>

        <div v-if="filteredCatalog.length === 0" class="empty-state">
          <AppIcon name="search" :size="32" />
          <p>No luminaires found matching "{{ searchQuery }}"</p>
        </div>
      </div>

      <!-- Footer -->
      <div class="catalog-footer">
        <span class="footer-note">Load or compare a luminaire from your library.</span>
        <button class="button secondary" @click="emit('close')">Close</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(2px);
}

.catalog-window {
  background: var(--panel, #1e1e24);
  border: 1px solid var(--line, #383842);
  border-radius: var(--control-radius, 6px);
  width: 900px;
  max-width: 95vw;
  height: 85vh;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  color: var(--text, #edebe8);
  overflow: hidden;
}

.catalog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--line, #383842);
  background: var(--well, #2a2a32);
}

.header-branding {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  font-size: 0.95rem;
}

.count-badge {
  font-size: 0.75rem;
  background: var(--hover, #33333d);
  color: var(--text-soft, #d4d4d8);
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 500;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-toolbar {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 16px;
  background: var(--panel, #1e1e24);
  border-bottom: 1px solid var(--line-soft, #3d3d46);
}

.search-input-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--well, #2a2a32);
  border: 1px solid var(--line-soft, #3d3d46);
  border-radius: 4px;
  padding: 6px 12px;
  color: var(--muted, #a1a1aa);
}

.search-input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text, #edebe8);
  font-size: 0.85rem;
  outline: none;
}

.clear-btn {
  background: none;
  border: none;
  color: var(--muted, #a1a1aa);
  font-size: 1.1rem;
  cursor: pointer;
  padding: 0 4px;
}

.filter-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.category-pills {
  display: flex;
  gap: 6px;
}

.cat-pill {
  background: var(--well, #2a2a32);
  border: 1px solid var(--line-soft, #3d3d46);
  color: var(--text-soft, #d4d4d8);
  font-size: 0.78rem;
  padding: 3px 10px;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.cat-pill:hover {
  background: var(--hover, #33333d);
}

.cat-pill.active {
  background: var(--accent, #d97706);
  border-color: var(--accent, #d97706);
  color: var(--on-accent);
  font-weight: 600;
}

.sort-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.78rem;
  color: var(--muted, #a1a1aa);
}

.sort-select {
  background: var(--well, #2a2a32);
  border: 1px solid var(--line-soft, #3d3d46);
  color: var(--text, #edebe8);
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 0.78rem;
  outline: none;
}

.catalog-grid {
  flex: 1;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
}

.catalog-card {
  display: flex;
  align-items: center;
  gap: 16px;
  background: var(--well, #2a2a32);
  border: 1px solid var(--line-soft, #3d3d46);
  border-radius: 4px;
  padding: 10px 14px;
  transition: all 0.15s ease;
}

.catalog-card:hover {
  border-color: var(--line, #383842);
  background: var(--hover, #33333d);
}

.card-thumbnail {
  width: 72px;
  height: 72px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--panel, #1e1e24);
  border-radius: 4px;
  border: 1px solid var(--line-soft, #3d3d46);
}

.card-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.card-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.lum-title {
  font-weight: 600;
  font-size: 0.88rem;
  color: var(--text, #edebe8);
}

.cat-badge {
  background: var(--line, #383842);
  color: var(--accent, #d97706);
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 3px;
}

.card-meta-line {
  font-size: 0.78rem;
  color: var(--muted, #a1a1aa);
  display: flex;
  align-items: center;
  gap: 6px;
}

.divider {
  color: var(--hint, #71717a);
}

.metrics-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.metric-pill {
  background: var(--panel, #1e1e24);
  border: 1px solid var(--line-soft, #3d3d46);
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 0.72rem;
  display: flex;
  gap: 4px;
  align-items: baseline;
}

.m-val {
  font-weight: 700;
  color: var(--text, #edebe8);
}

.m-lbl {
  color: var(--muted, #a1a1aa);
}

.card-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.catalog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-top: 1px solid var(--line, #383842);
  background: var(--well, #2a2a32);
}

.footer-note {
  font-size: 0.75rem;
  color: var(--hint, #71717a);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: var(--muted, #a1a1aa);
  gap: 12px;
}

.button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: var(--control-radius, 4px);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s ease;
}

.button.primary {
  background: var(--accent, #d97706);
  color: var(--on-accent);
}

.button.primary:hover {
  filter: brightness(1.1);
}

.button.secondary {
  background: var(--hover, #33333d);
  color: var(--text, #edebe8);
  border-color: var(--line-soft, #3d3d46);
}

.button.secondary:hover {
  background: var(--line, #383842);
}

.icon-button {
  background: transparent;
  border: none;
  color: var(--muted, #a1a1aa);
  cursor: pointer;
  padding: 4px;
  border-radius: 3px;
  display: inline-flex;
}

.icon-button:hover {
  color: var(--text, #edebe8);
  background: var(--hover, #33333d);
}
</style>
