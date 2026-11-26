<script setup lang="ts">
import AppIcon from "./AppIcon.vue";
defineProps<{ icon: string; label: string; accessibleLabel?: string }>();
defineEmits<{ click: [] }>();
</script>
<template>
  <button type="button" class="ribbon-action" :aria-label="accessibleLabel || label" :title="accessibleLabel || label" @click="$emit('click')">
    <AppIcon :name="icon" :size="24" /><span class="ribbon-label">{{ label }}</span>
  </button>
</template>
