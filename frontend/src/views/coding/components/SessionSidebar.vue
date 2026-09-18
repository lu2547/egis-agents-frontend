<script setup lang="ts">
import {
  ChatAddIcon,
  DeleteIcon,
  ErrorCircleIcon
} from 'tdesign-icons-vue-next';
import type { SessionMeta } from '../types';

defineProps<{
  sessions: SessionMeta[];
  activeSessionId: string;
  backendError: string;
}>();

const emit = defineEmits<{
  (e: 'select', sessionId: string): void;
  (e: 'new'): void;
  (e: 'delete', sessionId: string): void;
}>();

const formatTime = (value: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .format(date)
    .replace(/\//g, '-');
};
</script>

<template>
  <aside class="coding-sidebar">
    <div v-if="backendError" class="backend-alert">
      <ErrorCircleIcon />
      <span>{{ backendError }}</span>
    </div>

    <button type="button" class="new-session-button" @click="emit('new')">
      <ChatAddIcon />
      新对话
    </button>

    <div class="section-label">会话历史</div>
    <div class="session-list">
      <button
        v-for="session in sessions"
        :key="session.session_id"
        type="button"
        :class="['session-item', { active: session.session_id === activeSessionId }]"
        @click="emit('select', session.session_id)"
      >
        <span class="session-title">{{ session.title || '未命名会话' }}</span>
        <span class="session-meta">{{ formatTime(session.updated_at) }}</span>
        <span
          role="button"
          class="session-delete"
          aria-label="删除会话"
          @click.stop="emit('delete', session.session_id)"
        >
          <DeleteIcon />
        </span>
      </button>
      <p v-if="!sessions.length" class="empty-hint">暂无历史会话</p>
    </div>
  </aside>
</template>

<style scoped>
.coding-sidebar {
  width: 268px;
  flex: 0 0 auto;
  padding: 14px 12px;
  border-right: 1px solid #e7ebf2;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: #fbfcfe;
  overflow-y: auto;
}

.backend-alert {
  padding: 8px 10px;
  border: 1px solid #f2c1bd;
  border-radius: 7px;
  display: flex;
  align-items: flex-start;
  gap: 7px;
  color: #b42318;
  background: #fdf3f2;
  font-size: 12px;
  line-height: 1.5;
}

.backend-alert svg {
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
  margin-top: 1px;
}

.new-session-button {
  height: 38px;
  border: 0;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  color: #ffffff;
  background: linear-gradient(135deg, #2f62f6 0%, #2348c7 100%);
  font-size: 14px;
  font-weight: 700;
  box-shadow: 0 8px 18px rgba(47, 98, 246, 0.22);
  flex: 0 0 auto;
}

.new-session-button svg {
  width: 16px;
  height: 16px;
}

.section-label {
  margin-top: 4px;
  color: #98a2b3;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.04em;
}

.session-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.session-item {
  position: relative;
  padding: 8px 30px 8px 10px;
  border: 1px solid transparent;
  border-radius: 7px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: transparent;
  text-align: left;
}

.session-item:hover {
  background: #eef2fb;
}

.session-item.active {
  border-color: #c9d8ff;
  background: #e7efff;
}

.session-title {
  overflow: hidden;
  color: #1f2433;
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-meta {
  color: #98a2b3;
  font-size: 11px;
}

.session-delete {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  width: 22px;
  height: 22px;
  border-radius: 5px;
  display: none;
  place-items: center;
  color: #98a2b3;
}

.session-delete:hover {
  color: #b42318;
  background: #fdf3f2;
}

.session-delete svg {
  width: 14px;
  height: 14px;
}

.session-item:hover .session-delete {
  display: grid;
}

.empty-hint {
  margin: 0;
  padding: 6px 2px;
  color: #9299a7;
  font-size: 12px;
}
</style>
