<script setup lang="ts">
import { onMounted, ref } from 'vue';
import {
  ArrowUpIcon,
  CheckCircleIcon,
  CircleIcon,
  CloseIcon,
  FileIcon,
  LoadingIcon,
  SettingIcon,
  AddIcon,
  UploadIcon
} from 'tdesign-icons-vue-next';
import { usePlaygroundChat } from './usePlaygroundChat';
import ConfigPanel from './ConfigPanel.vue';
import { renderMarkdown } from '../chat/markdown';
import { SEND_SHORTCUT_HINT } from '../../utils/platform';
import type { ChatMessage, ResearchTrace } from '../chat/types';
import {
  activeStepId,
  completedCount,
  displayTodoSteps,
  todoSteps,
  todoSummary,
  todoTitle
} from '../chat/todo';
import {
  deleteUploadedFile,
  fetchPlaygroundAssets,
  fetchPlaygroundConfig,
  fetchUploadedFiles,
  putPlaygroundConfig,
  uploadPlaygroundFile,
  type PlaygroundAssets,
  type PlaygroundConfig,
  type PlaygroundConfigPayload,
  type UploadedFile
} from './api';

const {
  inputValue,
  messages,
  isLoading,
  chatBodyRef,
  sendMessage,
  resetSession,
  sseLog,
  clearLog
} = usePlaygroundChat();

const assets = ref<PlaygroundAssets | null>(null);
const config = ref<PlaygroundConfig | null>(null);
const showConfig = ref(true);
const configError = ref('');
const saving = ref(false);

/** Research Loop 过程摘要按轮次分组：同一 turn 的规划/取证/评估归入「第 N 轮」。 */
const traceGroups = (message: ChatMessage): { turn: number; items: ResearchTrace[] }[] => {
  const groups: { turn: number; items: ResearchTrace[] }[] = [];
  for (const trace of message.researchTraces || []) {
    const turn = trace.turn || 0;
    const last = groups[groups.length - 1];
    if (last && last.turn === turn) last.items.push(trace);
    else groups.push({ turn, items: [trace] });
  }
  return groups;
};

const refresh = async () => {
  try {
    const [cfg, ast] = await Promise.all([fetchPlaygroundConfig(), fetchPlaygroundAssets()]);
    config.value = cfg;
    assets.value = ast;
    configError.value = '';
  } catch (err: any) {
    configError.value = err.message || '加载配置失败';
  }
};

const applyConfig = async (payload: PlaygroundConfigPayload) => {
  saving.value = true;
  configError.value = '';
  try {
    // 仅当 MCP server 集合（id+enabled）变化时才需重拉 assets（工具清单会变）；
    // 纯工具/技能开关拨动不改变工具清单，跳过重拉以避免面板无谓重渲染抖动。
    const mcpSig = (list: PlaygroundConfigPayload['mcp_servers'] | undefined) =>
      JSON.stringify((list ?? []).map((s) => `${s.id}:${s.enabled}`).sort());
    const mcpChanged = mcpSig(payload.mcp_servers) !== mcpSig(config.value?.mcp_servers);

    const updated = await putPlaygroundConfig(payload);
    config.value = updated;
    if (mcpChanged) {
      assets.value = await fetchPlaygroundAssets();
    }
  } catch (err: any) {
    configError.value = err.message || '保存配置失败';
    // 保存失败时重新拉取权威状态，避免本地开关（乐观更新）与后端实际状态脱节。
    // 注：不调 refresh()（其成功分支会清空 configError），仅替换数据、保留错误提示。
    try {
      const [cfg, ast] = await Promise.all([fetchPlaygroundConfig(), fetchPlaygroundAssets()]);
      config.value = cfg;
      assets.value = ast;
    } catch {
      /* 忽略回拉时的二次失败 */
    }
  } finally {
    saving.value = false;
  }
};

onMounted(refresh);

/* ── 文件上传（data/files/）：勾选后随下一条消息发给 agent ── */
const uploadedFiles = ref<UploadedFile[]>([]);
const selectedFiles = ref<Set<string>>(new Set());
const uploading = ref(false);
const uploadError = ref('');
const fileInputRef = ref<HTMLInputElement | null>(null);

const loadFiles = async () => {
  try {
    const { files } = await fetchUploadedFiles();
    uploadedFiles.value = files;
    // 清除已不存在文件的选中态
    const names = new Set(files.map((f) => f.abs_path));
    selectedFiles.value = new Set([...selectedFiles.value].filter((p) => names.has(p)));
  } catch {
    /* 后端未就绪时静默失败 */
  }
};

const pickFiles = () => fileInputRef.value?.click();

const onFilesPicked = async (e: Event) => {
  const input = e.target as HTMLInputElement;
  const picked = [...(input.files ?? [])];
  input.value = '';
  if (!picked.length) return;
  uploading.value = true;
  uploadError.value = '';
  try {
    for (const f of picked) {
      const saved = await uploadPlaygroundFile(f);
      selectedFiles.value.add(saved.abs_path);
    }
    await loadFiles();
  } catch (err: any) {
    uploadError.value = err.message || '上传失败';
  } finally {
    uploading.value = false;
  }
};

const toggleFile = (absPath: string, on: boolean) => {
  const next = new Set(selectedFiles.value);
  if (on) next.add(absPath);
  else next.delete(absPath);
  selectedFiles.value = next;
};

const removeFile = async (f: UploadedFile) => {
  try {
    await deleteUploadedFile(f.name);
    await loadFiles();
  } catch (err: any) {
    uploadError.value = err.message || '删除失败';
  }
};

const send = () => sendMessage([...selectedFiles.value]).then(() => {
  selectedFiles.value = new Set();
});

onMounted(loadFiles);
</script>

<template>
  <div class="agentic-panel">
    <!-- ── 左：聊天区 ── -->
    <div class="chat-pane">
      <header class="chat-pane-header">
        <div class="chat-pane-title">
          <strong>AgenticAgent</strong>
          <em>实时调参 · 通用调试助手</em>
        </div>
        <div class="chat-pane-actions">
          <button type="button" class="ghost-btn" @click="resetSession">
            <AddIcon /> 新会话
          </button>
          <button type="button" class="ghost-btn" :class="{ on: showConfig }" @click="showConfig = !showConfig">
            <SettingIcon /> 配置
          </button>
        </div>
      </header>

      <div ref="chatBodyRef" class="chat-scroll">
        <div v-if="!messages.length" class="chat-empty">
          <h3>和 Playground 调试助手对话</h3>
          <p>右侧可实时调整 SystemPrompt、技能、工具与 MCP 服务，修改后下一轮对话即生效。</p>
        </div>

        <div v-else class="message-list">
          <article v-for="message in messages" :key="message.id" :class="['message', message.role]">
            <div v-if="message.role === 'user'" class="user-message-wrap">
              <div class="user-bubble">{{ message.content }}</div>
            </div>

            <div v-else class="assistant-stack">
              <section v-if="message.isStreaming || message.todoCard || message.reasoning || message.researchTraces?.length" class="process-card">
                <header class="agent-entered">
                  <div>
                    <span class="spark">✦</span>
                    <span>调试助手正在处理</span>
                  </div>
                  <em v-if="message.elapsed">耗时 {{ message.elapsed }}s</em>
                </header>

                <div class="thinking-title">
                  <span>{{ message.todoCard ? todoTitle(message) : '正在分析问题...' }}</span>
                  <em v-if="message.todoCard">{{ todoSummary(message) }}</em>
                  <i aria-hidden="true"></i>
                </div>

                <div v-if="displayTodoSteps(message).length || message.reasoning" class="thinking-box">
                  <ul v-if="displayTodoSteps(message).length">
                    <li v-for="step in displayTodoSteps(message)" :key="step.id" :class="step.status">
                      <CheckCircleIcon v-if="step.status === 'completed'" />
                      <LoadingIcon v-else-if="step.status === 'in_progress'" />
                      <CircleIcon v-else />
                      <span>{{ step.text }}</span>
                    </li>
                  </ul>
                  <div
                    v-if="message.reasoning"
                    :class="['reasoning-inline', { active: activeStepId(message) }]"
                    v-html="renderMarkdown(message.reasoning)"
                  ></div>
                </div>

                <!-- Research Loop 过程摘要：按轮次分组，逐条可展开 -->
                <div v-if="message.researchTraces?.length" class="research-traces">
                  <template v-for="(group, gi) in traceGroups(message)" :key="`g${gi}`">
                    <div class="trace-turn-header">第 {{ group.turn }} 轮</div>
                    <details v-for="trace in group.items" :key="trace.id" class="research-trace">
                      <summary>
                        <span class="trace-index">#{{ trace.id }}</span>
                        <span>{{ trace.title }}</span>
                      </summary>
                      <div class="trace-body" v-html="renderMarkdown(trace.content)"></div>
                    </details>
                  </template>
                </div>

                <footer v-if="!message.isStreaming && todoSteps(message).length" class="done-line">
                  已完成 {{ completedCount(message) }}/{{ todoSteps(message).length }} 步，{{ todoSummary(message) }}
                </footer>
              </section>

              <div v-if="message.content" class="assistant-answer" v-html="renderMarkdown(message.content)"></div>
            </div>
          </article>
        </div>
      </div>

      <div class="composer">
        <!-- 已上传文件：勾选后随下一条消息发送 -->
        <div v-if="uploadedFiles.length" class="file-chips">
          <label v-for="f in uploadedFiles" :key="f.name" class="file-chip">
            <t-checkbox
              size="small"
              :value="selectedFiles.has(f.abs_path)"
              @change="(v: boolean) => toggleFile(f.abs_path, v)"
            />
            <FileIcon />
            <span class="file-chip-name" :title="f.abs_path">{{ f.name }}</span>
            <button type="button" class="file-chip-del" aria-label="删除" @click="removeFile(f)">
              <CloseIcon />
            </button>
          </label>
        </div>
        <textarea
          v-model="inputValue"
          rows="2"
          :placeholder="`输入消息，${SEND_SHORTCUT_HINT}`"
          @keydown.ctrl.enter.prevent="send"
          @keydown.meta.enter.prevent="send"
        />
        <div class="composer-footer">
          <div class="composer-left">
            <button type="button" class="ghost-btn" :disabled="uploading" @click="pickFiles">
              <LoadingIcon v-if="uploading" /> <UploadIcon v-else /> 上传文件
            </button>
            <span v-if="uploadError" class="upload-error">{{ uploadError }}</span>
            <span v-else class="composer-hint">
              agent_id: playground_agent<span v-if="selectedFiles.size"> · 已选 {{ selectedFiles.size }} 个文件</span>
            </span>
          </div>
          <button type="button" class="send-button" :disabled="isLoading || !inputValue.trim()" @click="send">
            <ArrowUpIcon />
          </button>
        </div>
        <input ref="fileInputRef" type="file" multiple hidden @change="onFilesPicked" />
      </div>
    </div>

    <!-- ── 右：配置区（可折叠） ── -->
    <transition name="slide">
      <ConfigPanel
        v-if="showConfig"
        class="config-pane"
        :assets="assets"
        :config="config"
        :saving="saving"
        :error="configError"
        :log="sseLog"
        @apply="applyConfig"
        @refresh="refresh"
        @clear-log="clearLog"
      />
    </transition>
  </div>
</template>

<style scoped>
.agentic-panel {
  display: flex;
  gap: 14px;
  height: 100%;
  min-height: 0;
}

/* ── 聊天区 ── */
.chat-pane {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid #e7ebf2;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 12px 28px rgba(18, 32, 63, 0.06);
  overflow: hidden;
}

.chat-pane-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid #eef1f6;
}

.chat-pane-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.chat-pane-title strong {
  font-size: 16px;
  color: #1f2733;
}

.chat-pane-title em {
  font-style: normal;
  font-size: 12px;
  color: #7b8495;
}

.chat-pane-actions {
  display: flex;
  gap: 8px;
}

.ghost-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border: 1px solid #dfe5ef;
  border-radius: 8px;
  background: #fff;
  color: #4a5568;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.ghost-btn:hover {
  border-color: #b9cdff;
  color: #2e63f5;
}

.ghost-btn.on {
  border-color: #2e63f5;
  color: #2e63f5;
  background: #eef3ff;
}

.ghost-btn svg {
  width: 15px;
  height: 15px;
}

.chat-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 18px 20px;
}

.chat-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 100%;
  text-align: center;
  color: #7b8495;
}

.chat-empty h3 {
  color: #2e63f5;
  font-size: 18px;
}

.chat-empty p {
  max-width: 460px;
  font-size: 13px;
  line-height: 1.7;
}

.message-list {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.message.user {
  display: flex;
  justify-content: flex-end;
}

.user-message-wrap {
  max-width: min(760px, 72%);
  display: grid;
  justify-items: end;
  gap: 8px;
}

.user-bubble {
  padding: 10px 14px;
  border-radius: 14px 14px 4px 14px;
  background: linear-gradient(120deg, #315cff, #4f7bff);
  color: #fff;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.assistant-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 92%;
}

.process-card {
  border: 1px solid #e3eaf6;
  border-radius: 12px;
  background: linear-gradient(180deg, #f7faff, #ffffff);
  padding: 12px 14px;
}

.agent-entered {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: #667085;
}

.agent-entered .spark {
  color: #2e63f5;
  margin-right: 4px;
}

.agent-entered em {
  font-style: normal;
  color: #98a2b3;
}

.thinking-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #344054;
}

.thinking-title em {
  font-style: normal;
  font-weight: 400;
  font-size: 12px;
  color: #7b8495;
}

.thinking-title i {
  flex: 1;
  height: 1px;
  background: #e6ebf5;
}

.thinking-box {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.thinking-box ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.thinking-box li {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #4a5568;
}

.thinking-box li svg {
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
}

.thinking-box li.completed svg {
  color: #22c55e;
}

.thinking-box li.in_progress svg {
  color: #2e63f5;
}

.thinking-box li.pending svg {
  color: #c3cbd9;
}

.reasoning-inline {
  padding: 8px 10px;
  border-left: 2px solid #dfe5ef;
  color: #667085;
  font-size: 13px;
  line-height: 1.7;
}

.reasoning-inline.active {
  border-left-color: #2e63f5;
}

.done-line {
  margin-top: 10px;
  font-size: 12px;
  color: #22c55e;
}

.research-traces {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.trace-turn-header {
  margin: 4px 2px -2px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.5px;
  color: #98a2b3;
}

.research-trace {
  border: 1px solid #e6ebf5;
  border-radius: 8px;
  background: #fbfdff;
}

.research-trace summary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  font-size: 13px;
  color: #344054;
  cursor: pointer;
  user-select: none;
}

.research-trace .trace-index {
  flex: none;
  font-size: 11px;
  color: #2e63f5;
  background: #eef3ff;
  border-radius: 4px;
  padding: 1px 5px;
}

.research-trace .trace-body {
  padding: 4px 12px 10px;
  border-top: 1px dashed #e6ebf5;
  font-size: 12px;
  line-height: 1.7;
  color: #4a5568;
  max-height: 320px;
  overflow-y: auto;
}

.research-trace .trace-body :deep(p),
.research-trace .trace-body :deep(ul) {
  margin: 4px 0;
}

.research-trace .trace-body :deep(ul) {
  padding-left: 18px;
}

.assistant-answer {
  padding: 2px 2px;
  font-size: 14px;
  line-height: 1.75;
  color: #1f2733;
  word-break: break-word;
}

.assistant-answer :deep(pre) {
  padding: 12px;
  border-radius: 8px;
  background: #0f172a;
  color: #e2e8f0;
  overflow-x: auto;
}

.assistant-answer :deep(code) {
  font-family: 'SFMono-Regular', Menlo, Consolas, monospace;
  font-size: 13px;
}

.assistant-answer :deep(p) {
  margin: 0 0 8px;
}

.assistant-answer :deep(ul),
.assistant-answer :deep(ol) {
  margin: 0 0 8px;
  padding-left: 20px;
}

.assistant-answer :deep(table) {
  border-collapse: collapse;
  margin: 8px 0;
}

.assistant-answer :deep(th),
.assistant-answer :deep(td) {
  border: 1px solid #e3eaf6;
  padding: 6px 10px;
  font-size: 13px;
}

/* ── 输入区 ── */
.composer {
  border-top: 1px solid #eef1f6;
  padding: 12px 16px;
}

.composer textarea {
  width: 100%;
  resize: none;
  border: 1px solid #dfe5ef;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 14px;
  line-height: 1.6;
  font-family: inherit;
  outline: none;
  box-sizing: border-box;
}

.composer textarea:focus {
  border-color: #2e63f5;
}

.composer-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}

.composer-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.upload-error {
  font-size: 12px;
  color: #d92d20;
}

.file-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.file-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 6px;
  border: 1px solid #dfe5ef;
  border-radius: 8px;
  background: #f8fafd;
  cursor: pointer;
  max-width: 260px;
}

.file-chip svg {
  width: 14px;
  height: 14px;
  flex: none;
  color: #2e63f5;
}

.file-chip-name {
  font-size: 12px;
  color: #344054;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-chip-del {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: #98a2b3;
  cursor: pointer;
  padding: 1px;
}

.file-chip-del:hover {
  background: #fff1f0;
  color: #d92d20;
}

.file-chip-del svg {
  width: 12px;
  height: 12px;
  color: inherit;
}

.composer-hint {
  font-size: 12px;
  color: #98a2b3;
}

.send-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 9px;
  background: linear-gradient(120deg, #315cff, #4f7bff);
  color: #fff;
  cursor: pointer;
}

.send-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.send-button svg {
  width: 18px;
  height: 18px;
}

/* ── 配置区 ── */
.config-pane {
  flex: 0 0 380px;
  min-height: 0;
}

.slide-enter-active,
.slide-leave-active {
  transition: all 0.2s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateX(12px);
}

@media (max-width: 1180px) {
  .config-pane {
    flex-basis: 320px;
  }
}
</style>
