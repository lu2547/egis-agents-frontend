<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  CheckCircleIcon,
  ChevronRightIcon,
  CloseCircleIcon,
  EditIcon,
  LoadingIcon,
  SearchIcon,
  TerminalIcon,
  ToolsIcon
} from 'tdesign-icons-vue-next';
import type { ToolCard } from '../types';
import BashCard from './BashCard.vue';
import FileEditCard from './FileEditCard.vue';
import SearchCard from './SearchCard.vue';

const props = defineProps<{ card: ToolCard }>();

const expanded = ref(false);

/* 用户手动操作过就不再自动展开（尊重用户选择） */
const touched = ref(false);

/* 终态自动展开：结果直接可见（对齐 opencode 的实时输出体验） */
watch(
  () => props.card.status,
  (status) => {
    if (
      !touched.value &&
      (status === 'success' || status === 'error' || status === 'denied')
    ) {
      expanded.value = true;
    }
  },
  { immediate: true }
);

const toggle = () => {
  touched.value = true;
  expanded.value = !expanded.value;
};

const headline = computed(() => props.card.title || props.card.tool_name || props.card.display_type);

const statusLabel = computed(() => {
  switch (props.card.status) {
    case 'running':
      return '执行中';
    case 'success':
      return '成功';
    case 'error':
      return '失败';
    case 'denied':
      return '已拒绝';
    default:
      return '等待';
  }
});

const iconComponent = computed(() => {
  switch (props.card.display_type) {
    case 'file_edit':
      return EditIcon;
    case 'bash':
      return TerminalIcon;
    case 'search':
      return SearchIcon;
    default:
      return ToolsIcon;
  }
});

/** 有可展开详情的卡片才显示折叠箭头。 */
const expandable = computed(() =>
  Boolean(
    props.card.diff ||
      props.card.stdout_tail ||
      props.card.results_preview?.length ||
      props.card.note ||
      props.card.path ||
      props.card.command
  )
);
</script>

<template>
  <section :class="['tool-call-card', card.status]">
    <button type="button" class="tool-head" :disabled="!expandable" @click="toggle">
      <span class="tool-icon"><component :is="iconComponent" /></span>
      <span class="tool-title">{{ headline }}</span>
      <LoadingIcon v-if="card.status === 'running' || card.status === 'pending'" class="spin" />
      <CheckCircleIcon v-else-if="card.status === 'success'" class="ok" />
      <CloseCircleIcon v-else-if="card.status === 'error' || card.status === 'denied'" class="bad" />
      <em class="status-text">{{ statusLabel }}</em>
      <ChevronRightIcon v-if="expandable" :class="['chevron', { open: expanded }]" />
    </button>

    <div v-if="expanded" class="tool-detail">
      <FileEditCard v-if="card.display_type === 'file_edit'" :card="card" />
      <BashCard v-else-if="card.display_type === 'bash'" :card="card" />
      <SearchCard v-else-if="card.display_type === 'search'" :card="card" />
      <p v-else-if="card.note" class="fallback-note">{{ card.note }}</p>
      <p v-else class="fallback-note muted">（无详情）</p>
    </div>
  </section>
</template>

<style scoped>
.tool-call-card {
  margin: 5px 0;
  border: 1px solid #e7ebf2;
  border-radius: 8px;
  background: #ffffff;
  overflow: hidden;
}

.tool-call-card.error,
.tool-call-card.denied {
  border-color: #f2c1bd;
}

.tool-head {
  width: 100%;
  min-height: 40px;
  padding: 6px 10px;
  border: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  text-align: left;
}

.tool-head:disabled {
  cursor: default;
}

.tool-head:not(:disabled):hover {
  background: #f7f9fc;
}

.tool-icon {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  display: grid;
  place-items: center;
  color: #3157da;
  background: #edf3ff;
  flex: 0 0 auto;
}

.tool-icon svg {
  width: 15px;
  height: 15px;
}

.tool-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: #1f2433;
  font-size: 12px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tool-head svg {
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
}

.tool-head .spin {
  color: #2f62f6;
  animation: tool-spin 1s linear infinite;
}

.tool-head .ok {
  color: #157347;
}

.tool-head .bad {
  color: #b42318;
}

.status-text {
  flex: 0 0 auto;
  color: #8d95a4;
  font-size: 11px;
  font-style: normal;
  font-weight: 700;
}

.chevron {
  color: #98a2b3;
  transition: transform 0.15s ease;
}

.chevron.open {
  transform: rotate(90deg);
}

.tool-detail {
  padding: 0 12px 12px;
  border-top: 1px dashed #e7ebf2;
  padding-top: 10px;
}

.fallback-note {
  margin: 0;
  color: #667085;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
}

.fallback-note.muted {
  color: #9299a7;
}

@keyframes tool-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
