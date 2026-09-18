<script setup lang="ts">
import { computed } from 'vue';
import type { ToolCard } from '../types';

const props = defineProps<{ card: ToolCard }>();

const exitLabel = computed(() => {
  if (props.card.exit_code === null || props.card.exit_code === undefined) return '';
  return `exit ${props.card.exit_code}`;
});
</script>

<template>
  <div class="bash-card">
    <div class="bash-command-row">
      <span class="bash-prompt">$</span>
      <code class="bash-command">{{ card.command || card.title }}</code>
      <em v-if="exitLabel" :class="['exit-badge', { ok: card.exit_code === 0 }]">{{ exitLabel }}</em>
    </div>
    <pre v-if="card.stdout_tail" class="bash-output">{{ card.stdout_tail }}</pre>
    <p v-else-if="card.note" class="bash-note">{{ card.note }}</p>
  </div>
</template>

<style scoped>
.bash-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bash-command-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.bash-prompt {
  color: #2aaa5b;
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: 12px;
  font-weight: 800;
  flex: 0 0 auto;
}

.bash-command {
  flex: 1;
  min-width: 0;
  color: #1f2433;
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: 12px;
  word-break: break-all;
}

.exit-badge {
  flex: 0 0 auto;
  padding: 1px 7px;
  border-radius: 4px;
  color: #b42318;
  background: #fdecea;
  font-size: 11px;
  font-style: normal;
  font-weight: 800;
}

.exit-badge.ok {
  color: #157347;
  background: #d8f3e4;
}

.bash-output {
  margin: 0;
  padding: 8px 10px;
  border-radius: 6px;
  color: #475467;
  background: #f7f9fc;
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 240px;
  overflow: auto;
}

.bash-note {
  margin: 0;
  color: #667085;
  font-size: 12px;
}
</style>
