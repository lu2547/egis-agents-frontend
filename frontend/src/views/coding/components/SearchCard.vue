<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ToolCard } from '../types';

const props = defineProps<{ card: ToolCard }>();

const summary = computed(() => {
    const parts: string[] = [];
    if (props.card.pattern) parts.push(`模式 ${props.card.pattern}`);
    if (props.card.result_count !== null && props.card.result_count !== undefined) {
        parts.push(`${props.card.result_count} 条结果`);
    }
    return parts.join(' · ');
});

/** read 卡片：行区间徽标（对齐 opencode display.lineStart/lineEnd/totalLines） */
const rangeLabel = computed(() => {
    const { line_start, line_end, total_lines } = props.card;
    if (line_start == null || line_end == null) return '';
    const range = `第 ${line_start}-${line_end} 行`;
    return total_lines != null ? `${range} · 共 ${total_lines} 行` : range;
});

/** read 完整内容行（带行号渲染，与模型视角一致） */
const fileLines = computed(() => {
    if (!props.card.file_text) return [] as Array<{ no: number; text: string }>;
    const start = props.card.line_start ?? 1;
    return props.card.file_text.split('\n').map((text, i) => ({ no: start + i, text }));
});

/** 大内容默认折叠，点击展开滚动查看（避免长会话页被 881 行撑爆） */
const expanded = ref(false);
</script>

<template>
  <div class="search-card">
    <div class="search-summary">
      <span v-if="card.path" class="search-path">{{ card.path }}</span>
      <em v-if="summary">{{ summary }}</em>
      <em v-if="rangeLabel" class="range-badge">{{ rangeLabel }}</em>
      <em v-if="card.content_truncated" class="range-badge truncated">已截断</em>
    </div>
    <!-- read：完整读取内容（模型收到的就是这份全文，非 8 行摘要） -->
    <div v-if="fileLines.length" class="file-content" :class="{ collapsed: !expanded }">
      <div class="line" v-for="line in fileLines" :key="line.no">
        <span class="line-no">{{ line.no }}</span>
        <span class="line-text">{{ line.text }}</span>
      </div>
    </div>
    <button
      v-if="fileLines.length > 12"
      class="toggle-btn"
      type="button"
      @click="expanded = !expanded"
    >
      {{ expanded ? '收起' : `展开全部 ${fileLines.length} 行` }}
    </button>
    <!-- glob/grep/list：结果预览列表 -->
    <ul v-else-if="card.results_preview?.length" class="result-list">
      <li v-for="(item, i) in card.results_preview" :key="i">{{ item }}</li>
    </ul>
    <p v-if="card.note" class="search-note">{{ card.note }}</p>
  </div>
</template>

<style scoped>
.search-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.search-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.search-path {
  color: #3157da;
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: 12px;
  font-weight: 700;
  word-break: break-all;
}

.search-summary em {
  padding: 1px 7px;
  border-radius: 4px;
  color: #2e63f5;
  background: #e9efff;
  font-size: 11px;
  font-style: normal;
  font-weight: 800;
}

.range-badge.truncated {
  color: #b54708;
  background: #fef0c7;
}

/* read 完整内容区：与结果预览同风格，带行号列 */
.file-content {
  padding: 8px 10px;
  border-radius: 6px;
  background: #f7f9fc;
  overflow: auto;
}

.file-content.collapsed {
  max-height: 220px;
  /* 底部渐隐提示可展开 */
  mask-image: linear-gradient(to bottom, #000 82%, transparent 100%);
  -webkit-mask-image: linear-gradient(to bottom, #000 82%, transparent 100%);
}

.file-content .line {
  display: flex;
  gap: 10px;
  align-items: baseline;
}

.file-content .line-no {
  min-width: 34px;
  text-align: right;
  color: #98a2b3;
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: 11px;
  user-select: none;
}

.file-content .line-text {
  color: #475467;
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-all;
}

.toggle-btn {
  align-self: flex-start;
  padding: 2px 10px;
  border: 1px solid #d0d5dd;
  border-radius: 5px;
  background: #fff;
  color: #2e63f5;
  font-size: 11px;
  cursor: pointer;
}

.toggle-btn:hover {
  border-color: #2e63f5;
}

/* 结果列表：文件名 / 内容行 / 目录项，直接可见 */
.result-list {
  margin: 0;
  padding: 8px 10px;
  border-radius: 6px;
  list-style: none;
  background: #f7f9fc;
  display: flex;
  flex-direction: column;
  gap: 3px;
  max-height: 220px;
  overflow: auto;
}

.result-list li {
  color: #475467;
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-all;
}

.search-note {
  margin: 0;
  color: #667085;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
