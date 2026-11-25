import { computed, shallowRef, type ShallowRef } from "vue";
import { parsePhotometric } from "../core/photometricParser";
import { COMMERCIAL_DOWNLIGHT_IES, ROADWAY_COBRA_HEAD_IES, FLOODLIGHT_NEMA_IES } from "../core/samples";
import type { PhotometricData } from "../core/types";

export interface CatalogItem {
  id: string;
  category: "indoor" | "roadway" | "floodlight" | "industrial";
  data: PhotometricData;
}

export function useLuminaireCatalog(active: ShallowRef<PhotometricData | null>) {
  let sequence = 0;
  const catalog = shallowRef<CatalogItem[]>([]);
  function register(data: PhotometricData, category?: CatalogItem['category']) {
    const existing = catalog.value.find(item => item.data === data);
    if (existing) return existing.id;
    const id = `luminaire-${++sequence}`;
    catalog.value = [...catalog.value, { id, data, category: category ?? (data.photometricType === 2 ? "floodlight" : "indoor") }];
    return id;
  }
  register(parsePhotometric(COMMERCIAL_DOWNLIGHT_IES, "Commercial_Downlight_40W.ies"), "indoor");
  const roadwayId = register(parsePhotometric(ROADWAY_COBRA_HEAD_IES, "Cobra_Head_Roadway_150W.ies"), "roadway");
  register(parsePhotometric(FLOODLIGHT_NEMA_IES, "Architectural_Floodlight_250W.ies"), "floodlight");
  const selectionA = shallowRef("active");
  const selectionB = shallowRef(roadwayId);
  const resolve = (id: string) => id === "active" ? active.value : catalog.value.find(item => item.id === id)?.data ?? null;
  const primary = computed(() => resolve(selectionA.value));
  const secondary = computed(() => resolve(selectionB.value));
  const options = computed(() => [
    { label: `Current document — ${active.value?.fileName ?? "none"}`, value: "active" },
    ...catalog.value.map(item => ({ label: `${item.data.fileName} · ${item.id.replace('luminaire-', '#')}`, value: item.id }))
  ]);
  function select(slot: "A" | "B", data: PhotometricData) {
    const id = register(data);
    (slot === "A" ? selectionA : selectionB).value = id;
  }
  return { catalog, register, select, selectionA, selectionB, primary, secondary, options };
}
