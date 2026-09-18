<script setup lang="ts">
import { computed } from 'vue';
import { SecuredIcon } from 'tdesign-icons-vue-next';
import type { PermissionRequest } from '../types';

const props = defineProps<{ request: PermissionRequest }>();
const emit = defineEmits<{ (e: 'respond', requestId: string, action: 'once' | 'always' | 'reject'): void }>();

/** 待审批条目（bash 复合命令 → 每条子命令完整文本，同 opencode patterns） */
const displayPatterns = computed(() => {
  if (props.request.patterns?.length) return props.request.patterns;
  return props.request.pattern ? [props.request.pattern] : [];
});

const alwaysHint = computed(() => {
  const always = props.request.always_patterns?.length
    ? props.request.always_patterns
    : displayPatterns.value;
  return `记住 ${always.join('、')}，之后同类操作不再询问`;
});

const argsPreview = computed(() => {
  const entries = Object.entries(props.request.tool_args || {});
  // bash 的 command 已在 patterns 列表展示，避免重复
  const visible = props.request.permission === 'bash'
    ? entries.filter(([key]) => key !== 'command')
    : entries;
  if (!visible.length) return '';
  return visible
    .slice(0, 4)
    .map(([key, value]) => {
      const text = typeof value === 'string' ? value : JSON.stringify(value);
      const clipped = text.length > 120 ? `${text.slice(0, 120)}…` : text;
      return `${key}: ${clipped}`;
    })
    .join('\n');
});

const resolvedLabel = computed(() => {
  switch (props.request.resolved) {
    case 'once':
      return '已允许';
    case 'always':
      return '已记住';
    case 'reject':
      return '已拒绝';
    case 'timeout':
      return '等待超时，自动拒绝';
    default:
      return '';
  }
});
</script>

<template>
  <section class="permission-card" :class="{ resolved: request.resolved }">
    <header>
      <span class="perm-icon"><SecuredIcon /></span>
      <div class="perm-head">
        <strong>需要审批：{{ request.permission }}</strong>
        <span>{{ request.tool_name }}</span>
      </div>
      <em v-if="request.resolved" :class="['resolved-badge', request.resolved]">{{ resolvedLabel }}</em>
    </header>

    <ul v-if="displayPatterns.length" class="perm-patterns">
      <li v-for="(item, i) in displayPatterns" :key="i">{{ item }}</li>
    </ul>

    <pre v-if="argsPreview" class="perm-args">{{ argsPreview }}</pre>

    <footer v-if="!request.resolved">
      <button type="button" class="once" @click="emit('respond', request.request_id, 'once')">允许一次</button>
      <button
        type="button"
        class="always"
        :title="alwaysHint"
        @click="emit('respond', request.request_id, 'always')"
      >
        总是允许
      </button>
      <button type="button" class="reject" @click="emit('respond', request.request_id, 'reject')">拒绝</button>
    </footer>
  </section>
</template>

<style scoped>
.permission-card {
  margin: 6px 0;
  padding: 12px 14px;
  border: 1px solid #f3d9a4;
  border-radius: 8px;
  background: #fffaf0;
}

.permission-card.resolved {
  border-color: #e2e8f3;
  background: #f8fafc;
  opacity: 0.85;
}

.permission-card header {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.perm-icon {
  width: 30px;
  height: 30px;
  border-radius: 7px;
  display: grid;
  place-items: center;
  color: #b26300;
  background: #fff1d7;
  flex: 0 0 auto;
}

.perm-icon svg {
  width: 17px;
  height: 17px;
}

.perm-head {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.perm-head strong {
  color: #8a5300;
  font-size: 13px;
}

.perm-head span {
  color: #a07c3c;
  font-size: 12px;
}

.resolved-badge {
  flex: 0 0 auto;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-style: normal;
  font-weight: 700;
}

.resolved-badge.once,
.resolved-badge.always {
  color: #157347;
  background: #d8f3e4;
}

.resolved-badge.reject,
.resolved-badge.timeout {
  color: #b42318;
  background: #fde3e1;
}

.perm-args {
  margin: 10px 0 0;
  padding: 8px 10px;
  border-radius: 6px;
  color: #57430f;
  background: #fdf4e3;
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 160px;
  overflow: auto;
}

.perm-patterns {
  margin: 10px 0 0;
  padding: 8px 10px;
  border-radius: 6px;
  background: #fdf4e3;
  list-style: none;
}

.perm-patterns li {
  color: #57430f;
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: 12px;
  line-height: 1.7;
  word-break: break-all;
}

.perm-patterns li + li {
  border-top: 1px dashed #efdfb7;
}

.permission-card footer {
  margin-top: 10px;
  display: flex;
  gap: 8px;
}

.permission-card footer button {
  height: 30px;
  padding: 0 14px;
  border: 0;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 700;
  transition: filter 0.15s ease;
}

.permission-card footer button:hover {
  filter: brightness(0.96);
}

footer .once {
  color: #ffffff;
  background: linear-gradient(135deg, #2f62f6 0%, #2348c7 100%);
}

footer .always {
  color: #3157da;
  background: #edf3ff;
}

footer .reject {
  color: #b42318;
  background: #fdecea;
}
</style>
