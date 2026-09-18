<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import {
  ChatAddIcon,
  CloseIcon,
  DeleteIcon,
  FolderIcon,
  FolderOpenIcon,
  GitBranchIcon,
  LinkIcon,
  ErrorCircleIcon
} from 'tdesign-icons-vue-next';
import { cloneProject, listProjects } from '../api';
import { bindingDisplayPath, CODING_USER_ID, LOCAL_DIR_EXAMPLE } from '../constants';
import type { ProjectStatus, SessionMeta } from '../types';

const props = defineProps<{
  sessions: SessionMeta[];
  activeSessionId: string;
  backendError: string;
  /** 当前会话工作目录："" = 多租户沙箱；"local:<绝对路径>" = 本地锁定 */
  workspaceRoot: string;
  /** 本地绑定目录状态（名称 / git 分支等） */
  workspaceStatus: ProjectStatus | null;
  workspaceError: string;
  binding: boolean;
  /** 成功绑定过的本地目录（最近优先；对齐 opencode directory 记忆） */
  recentDirs: string[];
}>();

const emit = defineEmits<{
  (e: 'select', sessionId: string): void;
  (e: 'new'): void;
  (e: 'delete', sessionId: string): void;
  (e: 'bind', dir: string): void;
  (e: 'unbind'): void;
}>();

const projects = ref<ProjectStatus[]>([]);
const repoUrl = ref('');
const cloning = ref(false);
const cloneError = ref('');
const localDir = ref('');

const bindingName = computed(
  () =>
    props.workspaceStatus?.name ||
    bindingDisplayPath(props.workspaceRoot).split('/').filter(Boolean).pop() ||
    '本地目录'
);

/** 除当前绑定外的最近目录（一键重新绑定/切换）。 */
const otherRecentDirs = computed(() => {
  const current = bindingDisplayPath(props.workspaceRoot);
  return props.recentDirs.filter((dir) => dir !== current);
});

/** 目录短名（路径最后一段；末尾斜杠容错）。 */
const dirName = (dir: string) => dir.split('/').filter(Boolean).pop() || dir;

// 绑定成功 / 切换会话后清空残留输入
watch(
  () => props.workspaceRoot,
  () => {
    localDir.value = '';
  }
);

const formatTime = (value: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .format(date)
    .replace(/\//g, '-');
};

const refreshProjects = async () => {
  try {
    projects.value = await listProjects(CODING_USER_ID);
  } catch {
    projects.value = [];
  }
};

const submitClone = async () => {
  const url = repoUrl.value.trim();
  if (!url || cloning.value) return;
  cloning.value = true;
  cloneError.value = '';
  try {
    await cloneProject(CODING_USER_ID, url);
    repoUrl.value = '';
    await refreshProjects();
  } catch (err: any) {
    cloneError.value = err?.message || '克隆失败';
  } finally {
    cloning.value = false;
  }
};

const submitLocal = () => {
  const dir = localDir.value.trim();
  if (!dir || props.binding) return;
  emit('bind', dir);
};

onMounted(refreshProjects);

defineExpose({ refreshProjects });
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

    <div class="section-label workspace-label">
      <FolderOpenIcon />
      工作区项目（远程克隆）
    </div>
    <ul class="project-list">
      <li v-for="project in projects" :key="project.path">
        <div class="project-name">
          <GitBranchIcon />
          <strong>{{ project.name }}</strong>
        </div>
        <span class="project-meta">
          {{ project.branch || '—' }}<template v-if="project.head_short"> @ {{ project.head_short }}</template>
          <template v-if="project.dirty_files || project.untracked_files">
            · {{ project.dirty_files }} 改动 / {{ project.untracked_files }} 未跟踪
          </template>
        </span>
      </li>
      <p v-if="!projects.length" class="empty-hint">尚无项目，粘贴仓库地址克隆</p>
    </ul>

    <form class="clone-form" @submit.prevent="submitClone">
      <LinkIcon />
      <input
        v-model="repoUrl"
        type="text"
        placeholder="https://git.example.com/repo.git"
        aria-label="仓库地址"
      />
      <button type="submit" :disabled="!repoUrl.trim() || cloning">
        {{ cloning ? '克隆中…' : '克隆' }}
      </button>
    </form>

    <div class="section-label local-label">
      <FolderIcon />
      本地目录（直连）
    </div>

    <div v-if="workspaceRoot" class="local-binding">
      <div class="local-binding-head">
        <FolderOpenIcon />
        <strong>{{ bindingName }}</strong>
      </div>
      <span class="local-binding-path" :title="bindingDisplayPath(workspaceRoot)">
        {{ bindingDisplayPath(workspaceRoot) }}
      </span>
      <span v-if="workspaceStatus?.is_git_repo" class="local-binding-meta">
        {{ workspaceStatus.branch || '—' }}<template v-if="workspaceStatus.head_short"> @ {{ workspaceStatus.head_short }}</template>
      </span>
      <button type="button" class="unbind-button" :disabled="binding" @click="emit('unbind')">
        <CloseIcon />
        解绑，回到沙箱工作区
      </button>
      <template v-if="otherRecentDirs.length">
        <span class="recent-label">切换到其他目录</span>
        <button
          v-for="dir in otherRecentDirs"
          :key="dir"
          type="button"
          class="recent-dir-item"
          :title="dir"
          :disabled="binding"
          @click="emit('bind', dir)"
        >
          <FolderIcon />
          <span>{{ dirName(dir) }}</span>
        </button>
      </template>
    </div>

    <template v-else>
      <button
        v-for="dir in recentDirs"
        :key="dir"
        type="button"
        class="recent-dir-item standalone"
        :title="dir"
        :disabled="binding"
        @click="emit('bind', dir)"
      >
        <FolderIcon />
        <span>{{ dirName(dir) }}</span>
      </button>
      <form class="clone-form" @submit.prevent="submitLocal">
        <FolderOpenIcon />
        <input
          v-model="localDir"
          type="text"
          :placeholder="LOCAL_DIR_EXAMPLE"
          aria-label="本地目录绝对路径"
          spellcheck="false"
        />
        <button type="submit" :disabled="!localDir.trim() || binding">
          {{ binding ? '绑定中…' : '绑定' }}
        </button>
      </form>
      <p class="local-hint">绑定后 agent 直接在本机目录读写，/ 命令从该目录发现</p>
    </template>
    <p v-if="workspaceError" class="clone-error">{{ workspaceError }}</p>
    <p v-if="cloneError" class="clone-error">{{ cloneError }}</p>
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

.workspace-label {
  margin-top: auto;
  display: flex;
  align-items: center;
  gap: 5px;
}

.workspace-label svg {
  width: 13px;
  height: 13px;
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

.project-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.project-name {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.project-name svg {
  width: 13px;
  height: 13px;
  color: #8d5b00;
  flex: 0 0 auto;
}

.project-name strong {
  overflow: hidden;
  color: #1f2433;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-meta {
  margin-left: 19px;
  color: #98a2b3;
  font-size: 11px;
  line-height: 1.5;
}

.clone-form {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 4px 4px 10px;
  border: 1px solid #e2e8f3;
  border-radius: 7px;
  background: #ffffff;
}

.clone-form svg {
  width: 14px;
  height: 14px;
  color: #98a2b3;
  flex: 0 0 auto;
}

.clone-form input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  color: #1f2433;
  background: transparent;
  font-size: 12px;
}

.clone-form input::placeholder {
  color: #b6bfcc;
}

.clone-form button {
  height: 26px;
  padding: 0 12px;
  border: 0;
  border-radius: 5px;
  color: #ffffff;
  background: #2f62f6;
  font-size: 12px;
  font-weight: 700;
  flex: 0 0 auto;
}

.clone-form button:disabled {
  background: #b6c6e8;
}

.clone-error {
  margin: 0;
  color: #b42318;
  font-size: 11px;
  line-height: 1.5;
}

/* ── 本地目录绑定 ─────────────────── */

.local-label {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 5px;
}

.local-label svg {
  width: 13px;
  height: 13px;
}

.local-binding {
  padding: 8px 10px;
  border: 1px solid #bfe5cd;
  border-radius: 7px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  background: #effaf3;
}

.local-binding-head {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.local-binding-head svg {
  width: 13px;
  height: 13px;
  color: #0e6f42;
  flex: 0 0 auto;
}

.local-binding-head strong {
  overflow: hidden;
  color: #0e6f42;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.local-binding-path {
  overflow: hidden;
  color: #475467;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.local-binding-meta {
  color: #98a2b3;
  font-size: 11px;
}

.unbind-button {
  margin-top: 4px;
  height: 26px;
  border: 1px solid #d8eadf;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  color: #475467;
  background: #ffffff;
  font-size: 11px;
  font-weight: 600;
}

.unbind-button:hover {
  color: #b42318;
  border-color: #f2c1bd;
  background: #fdf3f2;
}

.unbind-button svg {
  width: 12px;
  height: 12px;
}

.local-hint {
  margin: 0;
  color: #9299a7;
  font-size: 11px;
  line-height: 1.5;
}

/* ── 最近目录（一键绑定 / 切换） ───────────────── */

.recent-label {
  margin-top: 2px;
  color: #98a2b3;
  font-size: 10px;
}

.recent-dir-item {
  height: 28px;
  padding: 0 8px;
  border: 1px solid #e2e8f3;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
  color: #1f2433;
  background: #ffffff;
  font-size: 12px;
  text-align: left;
}

.recent-dir-item:hover {
  border-color: #c9d8ff;
  background: #f0f4ff;
}

.recent-dir-item:disabled {
  opacity: 0.6;
}

.recent-dir-item svg {
  width: 13px;
  height: 13px;
  color: #3157da;
  flex: 0 0 auto;
}

.recent-dir-item span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-dir-item.standalone {
  margin-bottom: 0;
}
</style>
