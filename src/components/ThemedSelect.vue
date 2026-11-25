<script setup lang="ts">
import { ref, useId } from "vue";
import Select from "primevue/select";

defineProps<{
  modelValue: unknown;
  options: readonly { label: string; value: unknown; disabled?: boolean }[];
  label: string;
  filter?: boolean;
  disabled?: boolean;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: any] }>();
const control = ref<{ $el: HTMLElement }>();
const id = useId();
const inDialog = ref(false);
const isOpen = ref(false);
function opened() {
  isOpen.value = true;
  inDialog.value = Boolean(control.value?.$el.closest('[role="dialog"]'));
}
function escapeWhenClosed(event: KeyboardEvent) {
  // PrimeVue consumes Escape even when closed. Let the owning dialog/menu
  // receive that key without sending it through the Select handler again.
  if (event.key === 'Escape' && !isOpen.value) {
    event.stopPropagation();
    control.value?.$el.parentElement?.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true, cancelable:true}));
  }
}
</script>

<template>
  <Select ref="control" :model-value="modelValue" :options="options as any[]"
    option-label="label" option-value="value" option-disabled="disabled"
    :aria-label="label" :filter="filter" :disabled="disabled" :filter-placeholder="`Search ${label.toLowerCase()}`"
    append-to="body" scroll-height="min(18rem, 45vh)" unstyled
    :pt="{
      root: { class: 'app-select' }, label: { class: 'app-select-label' },
      dropdown: { class: 'app-select-arrow' },
      overlay: { class: 'app-select-panel', 'data-app-select-overlay': id, 'data-dialog-overlay': String(inDialog) },
      listContainer: { class: 'app-select-list-container' }, list: { class: 'app-select-list' },
      option: { class: 'app-select-option' }, header: { class: 'app-select-header' },
      pcFilter: { root: { class: 'app-select-filter' } }, emptyMessage: { class: 'app-select-empty' }
      , pcFilterContainer: { root: { class: 'app-select-filter-wrap' } }, pcFilterIconContainer: { root: { class: 'app-select-filter-icon' } }
    }" @before-show="opened" @hide="isOpen = false" @keydown.capture="escapeWhenClosed" @update:model-value="emit('update:modelValue', $event)" />
</template>

<style>
.app-select { display: inline-flex; align-items: center; min-width: 0; max-width: 100%; position: relative; cursor: pointer; background: var(--well); border: 1px solid var(--line); border-radius: var(--control-radius); color: var(--text); font: inherit; }
.app-select-label { padding: 6px 9px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; outline-offset: -2px; }
.app-select-arrow { display: flex; align-items: center; padding: 0 8px 0 0; flex-shrink: 0; }
.app-select-arrow svg { width: 11px; height: 11px; }
.app-select[data-p-focused="true"] { outline: var(--focus-width) solid var(--accent); outline-offset: 2px; }
.app-select-panel { z-index: 20000 !important; max-width: calc(100vw - 16px); padding: 4px; background: var(--panel); color: var(--text); border: 1px solid var(--line); border-radius: var(--control-radius); box-shadow: var(--shadow); font-family: var(--ui-font-family); font-size: calc(var(--ui-font-size) * var(--ui-scale, 1)); }
.app-select-list-container { overflow: auto; max-height: 45vh; }
.app-select-list { margin: 0; padding: 0; list-style: none; }
.app-select-option { display: flex; align-items: center; padding: 7px 10px; border-radius: var(--control-radius); cursor: pointer; overflow-wrap: anywhere; }
.app-select-option[aria-selected="true"] { background: var(--accent-soft); color: var(--accent); }
.app-select-option[data-p-focused="true"], .app-select-option:hover { background: var(--raised); outline: 1px solid var(--accent); outline-offset: -1px; }
.app-select-option[aria-disabled="true"] { opacity: .5; cursor: default; }
.app-select-header { padding: 4px; }
.app-select-filter-wrap { position: relative; }
.app-select-filter-icon { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); display: flex; pointer-events: none; }
.app-select-filter-icon svg { width: 13px; height: 13px; }
.app-select-filter { width: 100%; padding: 7px 28px 7px 7px; background: var(--well); color: var(--text); border: 1px solid var(--line); border-radius: var(--control-radius); font: inherit; }
.app-select-empty { padding: 8px; color: var(--muted); }
</style>
