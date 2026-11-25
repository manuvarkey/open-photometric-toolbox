<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{ name: string; size?: number }>();

const rr = (x: number, y: number, w: number, h: number, r = 1.6) =>
  `M${x + r} ${y}H${x + w - r}a${r} ${r} 0 0 1 ${r} ${r}V${y + h - r}a${r} ${r} 0 0 1-${r} ${r}H${x + r}a${r} ${r} 0 0 1-${r}-${r}V${y + r}a${r} ${r} 0 0 1 ${r}-${r}Z`;
const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0-${2 * r} 0Z`;

const icons: Record<string, [string, string?]> = {
  blank: [""],
  open: ["M4 7h4l2 2h10a1.6 1.6 0 0 1 1.6 1.6v8.8a1.6 1.6 0 0 1-1.6 1.6H4a1.6 1.6 0 0 1-1.6-1.6V7Z", "M4 11h16l-2 8H2l2-8Z"],
  save: ["M5 4h11l4 4v12H4V4h1z M8 4v5h8V4 M7 15h10v5H7z"],
  "save-as": ["M5 4h11l4 4v12H4V4h1z M8 4v5h8V4 M14 16l4 4 M18 16l-4 4"],
  refresh: ["M4 12a8 8 0 0 1 14-5.3L20 9 M20 4v5h-5 M20 12a8 8 0 0 1-14 5.3L4 15 M4 20v-5h5"],
  cube: ["M12 2 3 7v10l9 5 9-5V7l-9-5z M12 12 3 7 M12 12l9-5 M12 12v10"],
  wireframe: ["M12 2 3 7v10l9 5 9-5V7l-9-5z M12 2v20 M3 7l18 10 M21 7 3 17"],
  polar: [circle(12, 12, 9) + circle(12, 12, 5) + circle(12, 12, 1.5) + " M12 2v20 M2 12h20", "M12 12 C14 8, 17 6, 18 12 C19 18, 14 16, 12 12"],
  chart: ["M4 4v16h16 M7 15l4-5 4 3 5-7", circle(15, 13, 1.5)],
  eye: ["M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" + circle(12, 12, 3)],
  compare: ["M4 6h7v12H4z M13 6h7v12h-7z", "M9 12h6"],
  convert: ["M7 8l-4 4 4 4 M3 12h11 M17 16l4-4-4-4 M21 12H10"],
  edit: ["M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"],
  calculator: [rr(4, 3, 16, 18) + " M7 6h10 M7 10h2 M11 10h2 M15 10h2 M7 14h2 M11 14h2 M15 14h2 M7 18h2 M11 18h2 M15 18h2"],
  shield: ["M12 2L4 5v6c0 5.5 3.5 10.7 8 12 4.5-1.3 8-6.5 8-12V5l-8-3z", "M12 7v10"],
  report: ["M6 2h9l5 5v15H6V2z M14 2v6h6 M9 12h6 M9 16h6"],
  lightbulb: ["M9 18h6 M10 21h4 M12 2a7 7 0 0 0-7 7c0 2.5 1.3 4.7 3.3 5.9.4.3.7.8.7 1.3V17h6v-.8c0-.5.3-1 .7-1.3C17.7 13.7 19 11.5 19 9a7 7 0 0 0-7-7z", circle(12, 9, 2)],
  layers: ["M12 2 2 7l10 5 10-5-10-5z M2 12l10 5 10-5 M2 17l10 5 10-5"],
  table: ["M3 4h18v16H3V4z M3 9h18 M3 14h18 M9 4v16 M15 4v16"],
  sun: [circle(12, 12, 4) + " M12 2.5v2 M12 19.5v2 M2.5 12h2 M19.5 12h2 M5.3 5.3l1.4 1.4 M17.3 17.3l1.4 1.4 M5.3 18.7l1.4-1.4 M17.3 6.7l1.4-1.4"],
  moon: ["M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"],
  close: ["M6 6l12 12 M6 18L18 6"],
  check: ["M5 12.5l4.5 4.5L19 7"],
  plus: ["M12 5v14 M5 12h14"],
  minus: ["M5 12h14"],
  dots: ["M5 12h.01 M12 12h.01 M19 12h.01"],
  settings: ["M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"],
  info: [circle(12, 12, 9) + " M12 16v-4 M12 8h.01"],
  reset: ["M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8 M3 3v5h5"],
  folder: ["M4 4h6l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"],
  minimize: ["M5 12h14"],
  maximize: ["M4 4h16v16H4z"],
  help: [circle(12, 12, 9) + " M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3 M12 17h.01"],
  file: ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6"],
  database: ["M4 6c0-1.66 3.58-3 8-3s8 1.34 8 3v12c0 1.66-3.58 3-8 3s-8-1.34-8-3V6zm0 6c0 1.66 3.58 3 8 3s8-1.34 8-3"],
  "zoom-in": [circle(11, 11, 7) + " M11 8v6 M8 11h6 M21 21l-4.35-4.35"],
  "zoom-out": [circle(11, 11, 7) + " M8 11h6 M21 21l-4.35-4.35"],
  template: ["M3 3h18v18H3z M3 9h18 M3 15h18 M9 3v18 M15 3v18"],
  search: [circle(11, 11, 7) + " M21 21l-4.35-4.35"],
  "scale-compact": [rr(4, 5, 16, 14) + " M10 15l2-6 2 6 M10.8 13h2.4 M6 8h1 M6 11h1 M6 14h1"],
  "scale-default": [rr(3, 4, 18, 16) + " M9 15.5l3-8 3 8 M10 13h4"],
  "scale-medium": [rr(3, 3, 18, 18) + " M8 16.5l4-10 4 10 M9.2 13h5.6"],
  "scale-large": [rr(2, 2, 20, 20) + " M7 18l5-12 5 12 M8.5 13.5h7"],
};

const icon = computed(() => icons[props.name] ?? icons.blank);
</script>

<template>
  <svg
    :width="size ?? 24"
    :height="size ?? 24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="app-icon"
    aria-hidden="true"
    focusable="false"
  >
    <path :d="icon[0]" />
    <path v-if="icon[1]" :d="icon[1]" stroke="var(--icon-accent, #d97706)" />
  </svg>
</template>

<style scoped>
.app-icon {
  flex-shrink: 0;
  display: inline-block;
  vertical-align: middle;
}
</style>
