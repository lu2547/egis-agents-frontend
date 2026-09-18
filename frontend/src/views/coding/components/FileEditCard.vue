<script setup lang="ts">
import { computed } from 'vue';
import type { ToolCard } from '../types';

const props = defineProps<{ card: ToolCard }>();

const diffLines = computed(() =>
  (props.card.diff || '')
    .split('\n')
    .filter(Boolean)
    .slice(0, 200)
    .map((line) => ({
      kind: line.startsWith('+') ? 'add' : line.startsWith('-') ? 'del' : 'ctx',
      text: line
    }))
);
</script>

<template>
  <div class="file-edit-card">
    <div v-if="card.path" class="edit-path">{{ card.path }}</div>
    <pre v-if="diffLines.length" class="edit-diff"><code
      v-for="(line, index) in diffLines"
      :key="index"
      :class="line.kind"
    >{{ line.text }}</code></pre>
    <p v-else-if="card.note" class="edit-note">{{ card.note }}</p>
    <p v-else class="edit-note muted">（无 diff 预览）</p>
  </div>
</template>

<style scoped>
.file-edit-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.edit-path {
  color: #3157da;
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: 12px;
  font-weight: 700;
  word-break: break-all;
}

.edit-diff {
  margin: 0;
  padding: 8px 0;
  border-radius: 6px;
  background: #f7f9fc;
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: 12px;
  line-height: 1.6;
  overflow-x: auto;
  max-height: 320px;
}

.edit-diff code {
  display: block;
  padding: 0 10px;
  color: #475467;
  white-space: pre;
}

.edit-diff code.add {
  background: #e6f6ec;
  color: #157347;
}

.edit-diff code.del {
  background: #fdecea;
  color: #b42318;
}

.edit-note {
  margin: 0;
  color: #667085;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
}

.edit-note.muted {
  color: #9299a7;
}
</style>
