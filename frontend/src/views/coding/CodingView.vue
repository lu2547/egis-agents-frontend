<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BrowseIcon,
  CloudIcon,
  CloseIcon,
  FolderOpenIcon,
  LoadingIcon,
  StopCircleIcon,
  TerminalIcon
} from 'tdesign-icons-vue-next';
import { renderMarkdown } from '../chat/markdown';
import { bindingDisplayPath, CODING_EXAMPLES, codingModeMap } from './constants';
import { useCodingChat } from './useCodingChat';
import type { CommandInfo } from './types';
import ModeSwitch from './components/ModeSwitch.vue';
import FileExplorer from './components/FileExplorer.vue';
import PermissionCard from './components/PermissionCard.vue';
import SessionSidebar from './components/SessionSidebar.vue';
import TaskCard from './components/TaskCard.vue';
import TodoPanel from './components/TodoPanel.vue';
import ToolCallCard from './components/ToolCallCard.vue';

const {
  mode,
  inputValue,
  messages,
  isLoading,
  chatBodyRef,
  showJumpBottom,
  onBodyScroll,
  scrollToBottom,
  sessionId,
  sessions,
  backendError,
  workspaceRoot,
  workspaceStatus,
  workspaceError,
  binding,
  commands,
  recentDirs,
  newSession,
  selectSession,
  removeSession,
  respondToPermission,
  sendMessage,
  stop,
  switchMode,
  bindLocalDir,
  unbindWorkspace
} = useCodingChat();

const modeHint = computed(() => codingModeMap[mode.value].description);

/* 未落定的审批请求：固定展示在输入区上方（不再随消息流滚动） */
const pendingRequests = computed(() =>
  messages.value
    .flatMap((message) => message.pendingPermissions)
    .filter((request) => !request.resolved)
);

const pendingCount = computed(() => pendingRequests.value.length);

/* 最新一份任务计划：固定展示在右侧面板 */
const todoMessage = computed(() => {
  for (let i = messages.value.length - 1; i >= 0; i--) {
    const message = messages.value[i];
    if (message.role === 'assistant' && message.todos.length) return message;
  }
  return null;
});

/* ── 工作目录指示（沙箱 / 本地） ─────── */

const workspaceLabel = computed(() =>
  workspaceRoot.value ? bindingDisplayPath(workspaceRoot.value) : '沙箱工作区'
);

/** 右侧文件浏览器面板开关 */
const showExplorer = ref(false);

/** run 结束信号：递增触发文件树刷新（agent 可能改动过文件系统） */
const explorerRefreshToken = ref(0);
watch(isLoading, (now, prev) => {
  if (prev && !now) explorerRefreshToken.value++;
});

/* ── 右侧栏宽度拖拽 ─────────────────── */

const RAIL_MIN_WIDTH = 300;
const RAIL_MAX_WIDTH = 760;
const railWidth = ref(360);

/** 拖拽 rail 左边缘调宽：向左拖变宽，chat 区同步被压缩（flex:1） */
const startRailResize = (event: MouseEvent) => {
  event.preventDefault();
  const startX = event.clientX;
  const startWidth = railWidth.value;
  const onMove = (ev: MouseEvent) => {
    railWidth.value = Math.min(
      RAIL_MAX_WIDTH,
      Math.max(RAIL_MIN_WIDTH, startWidth + (startX - ev.clientX))
    );
  };
  const onUp = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.body.style.userSelect = '';
  };
  document.body.style.userSelect = 'none';
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
};

const workspaceTitle = computed(() => {
  if (!workspaceRoot.value) return '远程克隆的项目都在隔离的沙箱工作区（多租户）';
  const status = workspaceStatus.value;
  const lines = [`本地目录：${bindingDisplayPath(workspaceRoot.value)}`];
  if (status?.is_git_repo) {
    lines.push(
      `${status.branch || '—'} @ ${status.head_short || '—'} · ${status.dirty_files} 改动 / ${status.untracked_files} 未跟踪`
    );
  }
  return lines.join('\n');
});

/* ── slash 命令面板（输入 / 触发） ────── */

const showCommandPanel = computed(
  () => inputValue.value.startsWith('/') && !isLoading.value
);

const commandQuery = computed(() => inputValue.value.slice(1).split(/\s/, 1)[0] ?? '');

const filteredCommands = computed(() => {
  const query = commandQuery.value.toLowerCase();
  if (!query) return commands.value;
  return commands.value.filter((cmd) => cmd.name.startsWith(query));
});

const applyCommand = (cmd: CommandInfo) => {
  inputValue.value = `/${cmd.name} `;
};
</script>

<template>
  <section class="coding-shell">
    <SessionSidebar
      :sessions="sessions"
      :active-session-id="sessionId"
      :backend-error="backendError"
      :workspace-root="workspaceRoot"
      :workspace-status="workspaceStatus"
      :workspace-error="workspaceError"
      :binding="binding"
      :recent-dirs="recentDirs"
      @select="selectSession"
      @new="newSession"
      @delete="removeSession"
      @bind="bindLocalDir"
      @unbind="unbindWorkspace"
    />

    <main class="coding-main">
      <header class="coding-topbar">
        <ModeSwitch :model-value="mode" @update:model-value="switchMode" />
        <span class="mode-hint">{{ modeHint }}</span>
        <span v-if="pendingCount" class="pending-pill">{{ pendingCount }} 项待审批</span>
        <button
          type="button"
          class="explorer-toggle"
          :class="{ active: showExplorer }"
          :title="showExplorer ? '收起文件面板' : '浏览工作目录文件'"
          @click="showExplorer = !showExplorer"
        >
          <BrowseIcon />
          <span>文件</span>
        </button>
        <span class="workspace-pill" :class="{ local: !!workspaceRoot }" :title="workspaceTitle">
          <FolderOpenIcon v-if="workspaceRoot" />
          <CloudIcon v-else />
          <span class="workspace-pill-text">{{ workspaceLabel }}</span>
          <button
            v-if="workspaceRoot"
            type="button"
            class="workspace-unbind"
            aria-label="解绑本地目录"
            title="解绑，回到沙箱工作区"
            @click="unbindWorkspace"
          >
            <CloseIcon />
          </button>
        </span>
      </header>

      <div ref="chatBodyRef" class="coding-body" @scroll.passive="onBodyScroll">
        <div v-if="!messages.length" class="empty-state">
          <h1>编码智能体 <span>Coding Agent</span></h1>
          <p>
            {{
              commands.length
                ? '当前目录提供以下命令，点击或输入 / 使用'
                : '在沙箱工作区里读代码、改代码、跑命令'
            }}
          </p>
          <div class="example-list">
            <template v-if="commands.length">
              <button
                v-for="cmd in commands"
                :key="cmd.name"
                type="button"
                class="example-command"
                @click="inputValue = `/${cmd.name} `"
              >
                <strong>/{{ cmd.name }}</strong>
                <em>{{ cmd.description }}</em>
              </button>
            </template>
            <template v-else>
              <button
                v-for="example in CODING_EXAMPLES"
                :key="example"
                type="button"
                @click="inputValue = example"
              >
                {{ example }}
              </button>
            </template>
          </div>
        </div>

        <div v-else class="message-list">
          <article v-for="message in messages" :key="message.id" :class="['message', message.role]">
            <div v-if="message.role === 'user'" class="user-bubble">{{ message.content }}</div>

            <div v-else class="assistant-stack">
              <!-- 正文与工具卡按时序交织（同 opencode parts 渲染：
                   说话→工具→说话→工具，而非卡片堆顶/正文垫底） -->
              <template
                v-for="(part, index) in message.parts"
                :key="part.kind === 'tool' ? part.card.tool_call_id : `text-${index}`"
              >
                <div
                  v-if="part.kind === 'text'"
                  class="assistant-content"
                  v-html="renderMarkdown(part.text)"
                ></div>
                <ToolCallCard v-else :card="part.card" />
              </template>

              <!-- 子 agent 并行任务 -->
              <TaskCard :tasks="message.subagentTasks" />

              <div v-if="message.reasoning" class="reasoning-box" v-html="renderMarkdown(message.reasoning)"></div>

              <footer v-if="message.isStreaming" class="streaming-hint">
                <LoadingIcon class="spin" />
                <span>正在处理…</span>
                <em v-if="message.elapsed">{{ message.elapsed }}s</em>
              </footer>
              <footer v-else-if="message.elapsed" class="elapsed-hint">耗时 {{ message.elapsed }}s</footer>
            </div>
          </article>
        </div>

        <!-- 回到底部（上翻查看历史时出现） -->
        <button
          v-if="showJumpBottom"
          type="button"
          class="jump-bottom"
          title="回到底部"
          @click="scrollToBottom(true)"
        >
          <ArrowDownIcon />
        </button>
      </div>

      <!-- 待审批卡片：固定在输入区上方，不随消息流滚动 -->
      <div v-if="pendingRequests.length" class="permission-dock">
        <PermissionCard
          v-for="request in pendingRequests"
          :key="request.request_id"
          :request="request"
          @respond="respondToPermission"
        />
      </div>

      <footer class="composer">
        <div v-if="showCommandPanel" class="command-panel">
          <button
            v-for="cmd in filteredCommands"
            :key="cmd.name"
            type="button"
            class="command-item"
            @mousedown.prevent="applyCommand(cmd)"
          >
            <TerminalIcon />
            <strong>/{{ cmd.name }}</strong>
            <span>{{ cmd.description }}</span>
          </button>
          <p v-if="!filteredCommands.length" class="command-empty">
            {{
              commands.length
                ? '无匹配命令'
                : '当前工作目录没有命令 —— 在左侧绑定本地目录（如 llm-wiki）后可用 /ingest、/query、/lint'
            }}
          </p>
        </div>
        <textarea
          v-model="inputValue"
          rows="3"
          :placeholder="`输入指令，当前模式：${codingModeMap[mode].name}（${modeHint}）`"
          @keydown.enter.exact.prevent="sendMessage"
        ></textarea>
        <div class="composer-footer">
          <span class="composer-note">Enter 发送</span>
          <button
            v-if="isLoading"
            type="button"
            class="stop-button"
            title="终止当前运行"
            @click="stop"
          >
            <StopCircleIcon />
            终止
          </button>
          <button
            v-else
            type="button"
            class="send-button"
            :disabled="!inputValue.trim()"
            @click="sendMessage"
          >
            <ArrowUpIcon />
          </button>
        </div>
      </footer>
    </main>

    <!-- 右侧栏：任务计划（可折叠，有 todos 时展示）+ 文件浏览器；
         左边缘可拖拽调宽，变宽时压缩左侧 chat -->
    <aside
      v-if="todoMessage || showExplorer"
      class="right-rail"
      :style="{ width: `${railWidth}px` }"
    >
      <div class="rail-resizer" title="拖拽调宽" @mousedown="startRailResize"></div>
      <TodoPanel
        v-if="todoMessage"
        :todos="todoMessage.todos"
        :streaming="!!todoMessage.isStreaming"
      />
      <FileExplorer
        v-if="showExplorer"
        :workspace-root="workspaceRoot"
        :refresh-token="explorerRefreshToken"
        @close="showExplorer = false"
      />
    </aside>
  </section>
</template>

<style scoped>
.coding-shell {
  height: calc(100vh - 50px);
  display: flex;
  overflow: hidden;
  background: #f3f5f8;
}

.coding-main {
  flex: 1;
  min-width: 420px; /* rail 拖宽时同步压缩，但不低于可读宽度 */
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── 右侧栏：纵向堆叠（计划在上/可折叠，文件浏览占余下全部） ── */

.right-rail {
  flex: 0 0 auto;
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-left: 1px solid #e7ebf2;
  background: #ffffff;
  overflow: hidden;
}

/* 左边缘拖拽条：hover / 拖拽时高亮 */
.rail-resizer {
  position: absolute;
  left: -3px;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: col-resize;
  z-index: 10;
}

.rail-resizer:hover,
.rail-resizer:active {
  background: rgba(47, 98, 246, 0.18);
}

/* ── 顶栏 ─────────────────────────────── */

.coding-topbar {
  height: 52px;
  padding: 0 18px;
  border-bottom: 1px solid #e7ebf2;
  display: flex;
  align-items: center;
  gap: 12px;
  background: #ffffff;
  flex: 0 0 auto;
}

.mode-hint {
  overflow: hidden;
  color: #8d95a4;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pending-pill {
  padding: 3px 10px;
  border-radius: 999px;
  color: #b26300;
  background: #fff1d7;
  font-size: 12px;
  font-weight: 800;
  flex: 0 0 auto;
}

.explorer-toggle {
  margin-left: auto;
  padding: 5px 11px;
  border: 1px solid #e2e8f3;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #667085;
  background: #f8fafc;
  font-size: 12px;
  font-weight: 700;
  flex: 0 0 auto;
}

.explorer-toggle:hover {
  color: #2f62f6;
  border-color: #c9d8ff;
}

.explorer-toggle.active {
  color: #2f62f6;
  border-color: #2f62f6;
  background: #e7efff;
}

.explorer-toggle svg {
  width: 13px;
  height: 13px;
}

.workspace-pill {
  padding: 4px 8px 4px 10px;
  border: 1px solid #e2e8f3;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #667085;
  background: #f8fafc;
  font-size: 12px;
  font-weight: 600;
  max-width: 46%;
  flex: 0 1 auto;
  min-width: 0;
}

.workspace-pill.local {
  color: #0e6f42;
  border-color: #bfe5cd;
  background: #effaf3;
}

.workspace-pill svg {
  width: 13px;
  height: 13px;
  flex: 0 0 auto;
}

.workspace-pill-text {
  overflow: hidden;
  min-width: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workspace-unbind {
  border: 0;
  padding: 2px;
  display: inline-flex;
  align-items: center;
  color: inherit;
  background: transparent;
  cursor: pointer;
  flex: 0 0 auto;
}

.workspace-unbind:hover {
  color: #b42318;
}

.workspace-unbind svg {
  width: 12px;
  height: 12px;
}

/* ── 消息区 ───────────────────────────── */

.coding-body {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 20px clamp(14px, 3vw, 40px);
}

/* 回到底部悬浮按钮 */
.jump-bottom {
  position: absolute;
  right: 26px;
  bottom: 18px;
  width: 36px;
  height: 36px;
  border: 1px solid #dce5f5;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: #2f62f6;
  background: #ffffff;
  box-shadow: 0 6px 16px rgba(18, 32, 63, 0.14);
  z-index: 5;
}

.jump-bottom:hover {
  border-color: #2f62f6;
}

.jump-bottom svg {
  width: 16px;
  height: 16px;
}

.empty-state {
  max-width: 560px;
  margin: clamp(30px, 10vh, 90px) auto 0;
  text-align: center;
}

.empty-state h1 {
  font-size: clamp(22px, 2.2vw, 30px);
  font-weight: 900;
}

.empty-state h1 span {
  background: linear-gradient(90deg, #315cff 0%, #8b5cff 58%, #35b8a6 100%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.empty-state p {
  margin-top: 8px;
  color: #667085;
  font-size: 14px;
}

.example-list {
  margin-top: 26px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.example-list button {
  min-height: 46px;
  padding: 0 16px;
  border: 1px solid #e6ebf2;
  border-radius: 8px;
  color: #2c3140;
  text-align: left;
  background: #ffffff;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.15s ease;
}

.example-list button:hover {
  border-color: #9fb7ff;
  color: #2f62f6;
}

.example-list button.example-command {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.example-list button.example-command strong {
  color: #2f62f6;
  font-family: "SFMono-Regular", Consolas, monospace;
}

.example-list button.example-command em {
  color: #98a2b3;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
}

.message-list {
  max-width: 860px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.message.user {
  display: flex;
  justify-content: flex-end;
}

.user-bubble {
  max-width: 76%;
  padding: 10px 14px;
  border-radius: 12px 12px 3px 12px;
  color: #ffffff;
  background: linear-gradient(135deg, #2f62f6 0%, #2348c7 100%);
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
  white-space: pre-wrap;
}

.assistant-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 待审批固定区（输入区上方，不随消息流滚动） */
.permission-dock {
  flex: 0 0 auto;
  max-width: 920px;
  width: calc(100% - clamp(28px, 6vw, 80px));
  margin: 0 auto 10px;
  max-height: 280px;
  overflow-y: auto;
}

/* 正文 / 思考 */
.assistant-content {
  padding: 4px 2px;
  color: #1f2433;
  font-size: 14px;
  line-height: 1.75;
  word-break: break-word;
}

.assistant-content :deep(p) {
  margin: 0 0 8px;
}

.assistant-content :deep(pre) {
  margin: 8px 0;
  padding: 10px 12px;
  border-radius: 8px;
  overflow-x: auto;
  background: #0f1b3d;
  color: #dce4ff;
  font-size: 12.5px;
  line-height: 1.6;
}

.assistant-content :deep(code) {
  font-family: "SFMono-Regular", Consolas, monospace;
}

.assistant-content :deep(:not(pre) > code) {
  padding: 1px 5px;
  border-radius: 4px;
  color: #b26300;
  background: #fff1d7;
  font-size: 12.5px;
}

.reasoning-box {
  padding: 8px 12px;
  border-left: 3px solid #d5dcf5;
  border-radius: 0 6px 6px 0;
  color: #8d95a4;
  background: #f8fafc;
  font-size: 12.5px;
  line-height: 1.65;
}

.streaming-hint {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #2f62f6;
  font-size: 12px;
  font-weight: 600;
}

.streaming-hint svg {
  width: 14px;
  height: 14px;
  animation: coding-spin 1s linear infinite;
}

.streaming-hint em {
  color: #98a2b3;
  font-style: normal;
}

.elapsed-hint {
  color: #98a2b3;
  font-size: 11px;
}

/* ── 输入区 ───────────────────────────── */

.composer {
  flex: 0 0 auto;
  max-width: 920px;
  width: calc(100% - clamp(28px, 6vw, 80px));
  margin: 0 auto 18px;
  padding: 12px;
  border: 1px solid #dce5f5;
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 12px 28px rgba(18, 32, 63, 0.08);
}

.composer:focus-within {
  border-color: #2f62f6;
}

/* ── slash 命令面板 ───────────────────── */

.command-panel {
  margin: 0 0 8px;
  border: 1px solid #e7ebf2;
  border-radius: 8px;
  background: #f8fafc;
  overflow: hidden;
  flex: 0 0 auto;
}

.command-item {
  width: 100%;
  padding: 7px 10px;
  border: 0;
  border-bottom: 1px solid #eef2f8;
  display: flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  text-align: left;
}

.command-item:last-of-type {
  border-bottom: 0;
}

.command-item:hover {
  background: #eef2fb;
}

.command-item svg {
  width: 13px;
  height: 13px;
  color: #2f62f6;
  flex: 0 0 auto;
}

.command-item strong {
  color: #1f2433;
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: 12.5px;
  flex: 0 0 auto;
}

.command-item span {
  overflow: hidden;
  color: #98a2b3;
  font-size: 12px;
  min-width: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.command-empty {
  margin: 0;
  padding: 7px 10px;
  color: #98a2b3;
  font-size: 12px;
  line-height: 1.5;
}

.composer textarea {
  width: 100%;
  border: 0;
  outline: 0;
  resize: vertical;
  min-height: 44px;
  max-height: 200px;
  color: #1f2433;
  background: transparent;
  font-size: 14px;
  line-height: 1.6;
}

.composer textarea::placeholder {
  color: #b6bfcc;
}

.composer-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.composer-note {
  color: #98a2b3;
  font-size: 11px;
}

.send-button,
.stop-button {
  height: 34px;
  border: 0;
  border-radius: 9px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
}

.send-button {
  width: 34px;
  justify-content: center;
  color: #ffffff;
  background: linear-gradient(135deg, #2f62f6 0%, #2348c7 100%);
  box-shadow: 0 8px 18px rgba(47, 98, 246, 0.22);
}

.send-button:disabled {
  background: #b6c6e8;
  box-shadow: none;
}

.stop-button {
  padding: 0 14px;
  color: #b42318;
  background: #fdf0ef;
  border: 1px solid #f2c1bd;
}

.stop-button svg,
.send-button svg {
  width: 16px;
  height: 16px;
}

@keyframes coding-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
