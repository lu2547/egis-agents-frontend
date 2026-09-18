<script setup lang="ts">
import { CheckCircleIcon, CloseCircleIcon, LoadingIcon } from 'tdesign-icons-vue-next';
import type { SubagentTask } from '../types';

defineProps<{ tasks: SubagentTask[] }>();
</script>

<template>
  <section v-if="tasks.length" class="task-card">
    <header>并行子任务（{{ tasks.length }}）</header>
    <ul>
      <li v-for="task in tasks" :key="task.scope_id" :class="task.status">
        <CheckCircleIcon v-if="task.status === 'finished'" />
        <CloseCircleIcon v-else-if="task.status === 'failed'" />
        <LoadingIcon v-else />
        <div class="task-copy">
          <strong>{{ task.label }}</strong>
          <span v-if="task.summary">{{ task.summary }}</span>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.task-card {
  margin: 6px 0;
  padding: 10px 12px;
  border: 1px solid #e7ebf2;
  border-radius: 8px;
  background: #ffffff;
}

.task-card header {
  color: #667085;
  font-size: 12px;
  font-weight: 800;
}

.task-card ul {
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.task-card li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.task-card li svg {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
  margin-top: 1px;
}

.task-card li.finished svg {
  color: #157347;
}

.task-card li.failed svg {
  color: #b42318;
}

.task-card li.started svg {
  color: #2f62f6;
}

.task-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.task-copy strong {
  color: #1f2433;
  font-size: 12px;
}

.task-copy span {
  color: #8d95a4;
  font-size: 12px;
  line-height: 1.5;
  word-break: break-all;
}
</style>
