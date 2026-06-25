<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { renderA2UI } from '../views/chat/a2ui';

const props = defineProps<{
  payload: any;
}>();

const emit = defineEmits<{
  (e: 'action', actionType: string, actionArgs: string): void;
}>();

const containerRef = ref<HTMLElement | null>(null);

const html = computed(() => renderA2UI(props.payload));

const bindActions = () => {
  const el = containerRef.value;
  if (!el) return;
  const buttons = el.querySelectorAll('[data-a2ui-action]');
  buttons.forEach((btn) => {
    btn.addEventListener('click', (evt) => {
      evt.preventDefault();
      const actionType = btn.getAttribute('data-a2ui-action') || '';
      const actionArgs = btn.getAttribute('data-a2ui-args') || '';
      emit('action', actionType, actionArgs);
    });
  });
};

onMounted(bindActions);
watch(() => props.payload, bindActions, { deep: true });
</script>

<template>
  <div ref="containerRef" class="a2ui-card" v-html="html" />
</template>

<style scoped>
.a2ui-card {
  margin: 8px 0;
}

.a2ui-card :deep(.a2ui-rendered) {
  width: 100%;
}

.a2ui-card :deep(button) {
  transition: all 0.15s ease;
}

.a2ui-card :deep(button:hover) {
  filter: brightness(0.95);
  transform: translateY(-1px);
}

.a2ui-card :deep(a) {
  transition: all 0.15s ease;
}

.a2ui-card :deep(a:hover) {
  filter: brightness(0.95);
}
</style>
