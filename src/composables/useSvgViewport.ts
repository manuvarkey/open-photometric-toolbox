import { computed, onBeforeUnmount, ref, watch, type ComputedRef } from "vue";

/** An SVG camera: zoom/pan changes coordinates, leaving vector geometry intact. */
export function useSvgViewport(size: ComputedRef<{ width: number; height: number }>) {
  const svg = ref<SVGSVGElement | null>(null);
  const zoom = ref(1);
  const center = ref({ x: size.value.width / 2, y: size.value.height / 2 });
  const isPanning = ref(false);
  let drag: { pointer: number; x: number; y: number } | null = null;
  const viewBox = computed(() => {
    const width = size.value.width / zoom.value, height = size.value.height / zoom.value;
    return `${center.value.x - width / 2} ${center.value.y - height / 2} ${width} ${height}`;
  });
  function point(event: { clientX: number; clientY: number }) {
    const matrix = svg.value?.getScreenCTM();
    return matrix ? new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()) : null;
  }
  function changeZoom(factor: number, anchor = center.value) {
    const next = Math.max(.4, Math.min(5, zoom.value * factor));
    const ratio = zoom.value / next;
    center.value = { x: anchor.x + (center.value.x - anchor.x) * ratio, y: anchor.y + (center.value.y - anchor.y) * ratio };
    zoom.value = next;
  }
  function wheel(event: WheelEvent) {
    if (!event.deltaY) return;
    changeZoom(event.deltaY < 0 ? 1.15 : 1 / 1.15, point(event) ?? center.value);
  }
  function pointerDown(event: PointerEvent) {
    if (drag || !event.isPrimary || (event.button !== 0 && event.button !== 1)) return;
    const anchor = point(event);
    if (!anchor) return;
    event.preventDefault();
    drag = { pointer: event.pointerId, x: anchor.x, y: anchor.y };
    isPanning.value = true;
    svg.value?.setPointerCapture(event.pointerId);
  }
  function pointerMove(event: PointerEvent) {
    if (!drag || event.pointerId !== drag.pointer) return;
    const current = point(event);
    if (current) center.value = { x: center.value.x + drag.x - current.x, y: center.value.y + drag.y - current.y };
  }
  function pointerUp(event?: PointerEvent) {
    if (event && drag && event.pointerId !== drag.pointer) return;
    if (drag && svg.value?.hasPointerCapture(drag.pointer)) svg.value.releasePointerCapture(drag.pointer);
    drag = null;
    isPanning.value = false;
  }
  function fit() {
    pointerUp();
    zoom.value = 1;
    center.value = { x: size.value.width / 2, y: size.value.height / 2 };
  }
  watch(size, fit);
  onBeforeUnmount(pointerUp);
  return { svg, zoom, viewBox, isPanning, point, wheel, pointerDown, pointerMove, pointerUp, fit,
    zoomIn: () => changeZoom(1.25), zoomOut: () => changeZoom(1 / 1.25) };
}
