<script setup lang="ts">
import { CODING_MODES, codingModeMap } from '../constants';
import type { CodingMode } from '../types';

defineProps<{ modelValue: CodingMode }>();
const emit = defineEmits<{ (e: 'update:modelValue', mode: CodingMode): void }>();

const select = (mode: CodingMode) => emit('update:modelValue', mode);
</script>

<template>
  <div class="mode-switch" role="tablist" aria-label="模式切换">
    <button
      v-for="item in CODING_MODES"
      :key="item.mode"
      type="button"
      role="tab"
      :class="['mode-option', { active: modelValue === item.mode, readonly: item.mode === 'plan' }]"
      :title="codingModeMap[item.mode].description"
      :aria-selected="modelValue === item.mode"
      @click="select(item.mode)"
    >
      {{ item.name }}
    </button>
  </div>
</template>

<style scoped>
.mode-switch {
  display: inline-flex;
  padding: 3px;
  border: 1px solid #e2e8f3;
  border-radius: 8px;
  background: #f5f7fb;
  gap: 2px;
}

.mode-option {
  height: 28px;
  padding: 0 14px;
  border: 0;
  border-radius: 6px;
  color: #667085;
  background: transparent;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.15s ease;
}

.mode-option:hover {
  color: #2f62f6;
}

.mode-option.active {
  color: #ffffff;
  background: linear-gradient(135deg, #2f62f6 0%, #2348c7 100%);
  box-shadow: 0 4px 10px rgba(47, 98, 246, 0.24);
}
</style>
