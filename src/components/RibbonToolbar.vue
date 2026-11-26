<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
const host = ref<HTMLElement>();
let frame = 0;
let resize: ResizeObserver | undefined;
let contents: MutationObserver | undefined;
let typography: MutationObserver | undefined;

/** Measure captions using the resolved desktop font, then fit the command rail. */
function prepare() {
  const root = host.value;
  if (!root) return;
  root.removeAttribute('data-compact-actions');
  const context = document.createElement('canvas').getContext('2d');
  if (context) for (const action of root.querySelectorAll<HTMLElement>('.ribbon-action')) {
    const caption = action.querySelector<HTMLElement>('.ribbon-label');
    if (!caption) continue;
    const style = getComputedStyle(caption);
    context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const words = caption.textContent?.trim().split(/\s+/) ?? [];
    const measure = (text: string) => context.measureText(text).width;
    let width = measure(words.join(' '));
    for (let split = 1; split < words.length; split++) width = Math.min(width, Math.max(measure(words.slice(0, split).join(' ')), measure(words.slice(split).join(' '))));
    const captionWidth = Math.min(80, Math.ceil(width) + 3);
    action.style.setProperty('--ribbon-caption-width', `${captionWidth}px`);
    action.style.setProperty('--ribbon-button-width', `${Math.max(52, captionWidth + 8)}px`);
  }
  if (root.scrollWidth > root.clientWidth) root.setAttribute('data-compact-actions', '');
}
function schedule() { cancelAnimationFrame(frame); frame = requestAnimationFrame(prepare); }
defineExpose({ prepare });
onMounted(() => {
  resize = new ResizeObserver(schedule); resize.observe(host.value!);
  contents = new MutationObserver(schedule); contents.observe(host.value!, {childList:true,subtree:true,characterData:true});
  typography = new MutationObserver(schedule); typography.observe(document.documentElement, {attributes:true,attributeFilter:['style']});
  document.fonts.addEventListener('loadingdone', schedule);
  void document.fonts.ready.then(schedule);
  schedule();
});
onBeforeUnmount(() => { resize?.disconnect(); contents?.disconnect(); typography?.disconnect(); document.fonts.removeEventListener('loadingdone',schedule); cancelAnimationFrame(frame); });
</script>
<template><section ref="host" class="ribbon" aria-label="Workspace commands"><slot /></section></template>
