<script setup lang="ts">
import {
  FileWordIcon,
  ChevronRightIcon
} from 'tdesign-icons-vue-next';

export type WordSection = {
  level: number;
  title: string;
  summary?: string;
  wordCount?: number;
  expanded?: boolean;
};

defineProps<{
  sections: WordSection[];
  title?: string;
  totalWords?: number;
}>();
</script>

<template>
  <div class="word-preview-card">
    <header class="preview-header">
      <div class="header-left">
        <FileWordIcon />
        <strong>{{ title || 'Word 文档预览' }}</strong>
      </div>
      <em v-if="totalWords">约 {{ totalWords }} 字</em>
    </header>

    <div class="doc-structure">
      <div
        v-for="(section, index) in sections"
        :key="index"
        class="doc-section"
        :class="`level-${section.level}`"
        :style="{ paddingLeft: `${12 + (section.level - 1) * 20}px` }"
      >
        <div class="section-row">
          <ChevronRightIcon class="section-arrow" />
          <div class="section-badge">{{ section.level === 1 ? 'H1' : section.level === 2 ? 'H2' : `H${section.level}` }}</div>
          <div class="section-info">
            <span class="section-title">{{ section.title }}</span>
            <span v-if="section.summary" class="section-summary">{{ section.summary }}</span>
          </div>
          <span v-if="section.wordCount" class="word-count">{{ section.wordCount }}字</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.word-preview-card {
  border-radius: 10px;
  background: #ffffff;
  border: 1px solid #e4e9f2;
  box-shadow: 0 8px 20px rgba(20, 34, 70, 0.06);
  overflow: hidden;
}

.preview-header {
  padding: 12px 16px;
  border-bottom: 1px solid #eef1f6;
  background: linear-gradient(135deg, #f0f8ff, #f5f2ff);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-left svg {
  width: 18px;
  height: 18px;
  color: #2b7d4f;
}

.header-left strong {
  color: #1e2432;
  font-size: 15px;
  font-weight: 900;
}

.preview-header em {
  color: #7b8493;
  font-size: 12px;
  font-style: normal;
  font-weight: 800;
}

.doc-structure {
  padding: 8px;
  max-height: 420px;
  overflow-y: auto;
  display: grid;
  gap: 2px;
}

.doc-section {
  border-radius: 6px;
  transition: background 0.15s ease;
}

.doc-section:hover {
  background: #f3f7ff;
}

.section-row {
  padding: 7px 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-arrow {
  width: 12px;
  height: 12px;
  color: #b0b8c8;
  flex: 0 0 auto;
}

.section-badge {
  flex: 0 0 auto;
  min-width: 24px;
  height: 18px;
  padding: 0 5px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 900;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.level-1 .section-badge {
  color: #ffffff;
  background: #3f7cff;
}

.level-2 .section-badge {
  color: #3f7cff;
  background: #e8f1ff;
}

.level-3 .section-badge {
  color: #8c5cff;
  background: #f0edff;
}

.level-4 .section-badge {
  color: #ff9b40;
  background: #fff5e8;
}

.section-info {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.section-title {
  color: #1e2432;
  font-size: 13px;
  font-weight: 800;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.level-1 .section-title {
  font-size: 14px;
}

.section-summary {
  color: #7b8493;
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.word-count {
  flex: 0 0 auto;
  color: #9298a4;
  font-size: 11px;
}
</style>
