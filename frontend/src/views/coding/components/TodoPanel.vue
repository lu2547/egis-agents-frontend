<script setup lang="ts">
/** 任务计划面板 — 可折叠：默认收起为一行摘要（当前项 + 完成度），
 * 点击 header 展开/收起，避免长计划把右侧文件面板挤下去。 */
import { computed, ref } from 'vue';
import {
  CheckCircleIcon,
  ChevronDownIcon,
  CircleIcon,
  CloseCircleIcon,
  LoadingIcon
} from 'tdesign-icons-vue-next';
import type { TodoItem } from '../types';

const props = defineProps<{ todos: TodoItem[]; streaming?: boolean }>();

const collapsed = ref(true);

const toggle = () => {
  collapsed.value = !collapsed.value;
};

const doneCount = computed(() => props.todos.filter((item) => item.status === 'completed').length);

const activeText = computed(() => {
  const active = props.todos.find((item) => item.status === 'in_progress');
  return active ? active.activeForm || active.content : '任务计划';
});
</script>

<template>
  <aside class="todo-panel">
    <button type="button" class="todo-header" :class="{ open: !collapsed }" @click="toggle">
      <LoadingIcon v-if="streaming" class="spin" />
      <CheckCircleIcon v-else />
      <strong>{{ activeText }}</strong>
      <em>{{ doneCount }}/{{ todos.length }}</em>
      <ChevronDownIcon class="chev" :class="{ flip: collapsed }" />
    </button>
    <ul v-if="!collapsed">
      <li v-for="todo in todos" :key="todo.id" :class="todo.status">
        <CheckCircleIcon v-if="todo.status === 'completed'" />
        <CloseCircleIcon v-else-if="todo.status === 'cancelled'" />
        <LoadingIcon v-else-if="todo.status === 'in_progress'" class="spin" />
        <CircleIcon v-else />
        <span>{{ todo.status === 'in_progress' && todo.activeForm ? todo.activeForm : todo.content }}</span>
      </li>
    </ul>
  </aside>
</template>

<style scoped>
.todo-panel {
  flex: 0 0 auto;
  padding: 8px 10px 10px;
  border-bottom: 1px solid #e7ebf2;
  display: flex;
  flex-direction: column;
  min-height: 0;
  max-height: 45%;
  background: #ffffff;
  overflow: hidden;
}

.todo-header {
  border: 0;
  padding: 2px 0;
  display: flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  text-align: left;
  flex: 0 0 auto;
}

.todo-header:hover strong {
  color: #2f62f6;
}

.todo-header svg {
  width: 15px;
  height: 15px;
  color: #2f62f6;
  flex: 0 0 auto;
}

.todo-header svg.spin {
  animation: todo-spin 1s linear infinite;
}

.todo-header strong {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: #1f2433;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.todo-header em {
  color: #8d95a4;
  font-size: 12px;
  font-style: normal;
  font-weight: 700;
  flex: 0 0 auto;
}

.todo-header .chev {
  color: #98a2b3;
  transition: transform 0.15s ease;
}

.todo-header .chev.flip {
  transform: rotate(-90deg);
}

.todo-panel ul {
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 7px;
  overflow-y: auto;
  min-height: 0;
}

.todo-panel li {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  color: #667085;
  font-size: 12px;
  line-height: 1.5;
}

.todo-panel li svg {
  width: 14px;
  height: 14px;
  flex: 0 0 auto;
  margin-top: 2px;
}

.todo-panel li.completed {
  color: #98a2b3;
  text-decoration: line-through;
}

.todo-panel li.completed svg {
  color: #157347;
}

.todo-panel li.in_progress {
  color: #1f2433;
  font-weight: 600;
}

.todo-panel li.in_progress svg {
  color: #2f62f6;
  animation: todo-spin 1s linear infinite;
}

.todo-panel li.cancelled svg {
  color: #98a2b3;
}

@keyframes todo-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
