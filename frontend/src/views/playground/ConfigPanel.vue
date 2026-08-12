<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { AddIcon, CloseIcon, RefreshIcon } from 'tdesign-icons-vue-next';
import type {
  MCPServerSpec,
  MCPToolInfo,
  PlaygroundAssets,
  PlaygroundConfig,
  PlaygroundConfigPayload,
  SkillDetail,
  SkillFile,
  ToolAsset
} from './api';
import { fetchSkillDetail, fetchSkillFile } from './api';
import type { KnowledgeDocument, Library, Tag } from '../knowledge/api';
import { listDocuments, listLibraries, listTags } from '../knowledge/api';
import type { SseLogEntry } from '../chat/types';
import { renderMarkdown } from '../chat/markdown';

const props = defineProps<{
  assets: PlaygroundAssets | null;
  config: PlaygroundConfig | null;
  saving: boolean;
  error: string;
  /** SSE 运行日志（由 usePlaygroundChat 实时采集）。 */
  log: SseLogEntry[];
}>();

const emit = defineEmits<{
  (e: 'apply', payload: PlaygroundConfigPayload): void;
  (e: 'refresh'): void;
  (e: 'clear-log'): void;
}>();

const activeTab = ref('prompt');

/* ── 本地可编辑状态 ── */
const systemPrompt = ref('');
const enabledTools = ref<Set<string>>(new Set());
const enabledSkills = ref<Set<string>>(new Set());
const mcpServers = ref<MCPServerSpec[]>([]);

/* ── 知识库：资料范围 + research 开关 ── */
const kbEnabled = ref(false);
const researchEnabled = ref(false);
const selLibraries = ref<Set<string>>(new Set());
const selTags = ref<Set<string>>(new Set());
const selDocs = ref<Set<string>>(new Set());

const kbLibraries = ref<Library[]>([]);
const kbTags = ref<Map<string, Tag[]>>(new Map());
const kbDocs = ref<Map<string, KnowledgeDocument[]>>(new Map());
const kbLoading = ref(false);
const kbError = ref('');

/* 从后端 config 同步到本地状态 */
watch(
  () => props.config,
  (cfg) => {
    if (!cfg) return;
    systemPrompt.value = cfg.system_prompt;
    enabledTools.value = new Set(cfg.enabled_tools ?? []);
    enabledSkills.value = new Set(cfg.enabled_skills ?? []);
    mcpServers.value = cfg.mcp_servers.map((s) => ({
      id: s.id,
      url: s.url,
      transport: s.transport,
      enabled: s.enabled
    }));
    const kb = cfg.knowledge ?? { enabled: false, library_ids: [], tag_ids: [], document_ids: [] };
    kbEnabled.value = kb.enabled;
    selLibraries.value = new Set(kb.library_ids);
    selTags.value = new Set(kb.tag_ids);
    selDocs.value = new Set(kb.document_ids);
    researchEnabled.value = cfg.research_enabled ?? false;
    // 已选库补齐标签/文档元数据，保证勾选态可渲染
    for (const id of kb.library_ids) void ensureKbMeta(id);
  },
  { immediate: true }
);

/* ── 知识库数据加载与开关 ── */
const loadKbLibraries = async () => {
  if (kbLibraries.value.length || kbLoading.value) return;
  kbLoading.value = true;
  kbError.value = '';
  try {
    kbLibraries.value = await listLibraries();
  } catch (err: any) {
    kbError.value = err.message || '加载知识库失败';
  } finally {
    kbLoading.value = false;
  }
};

watch(activeTab, (tab) => {
  if (tab === 'kb') void loadKbLibraries();
});

/** 选中库时懒加载其标签与文档（缓存，不重复拉）。 */
const ensureKbMeta = async (libId: string) => {
  if (!kbTags.value.has(libId)) {
    try {
      kbTags.value.set(libId, await listTags(libId));
    } catch {
      kbTags.value.set(libId, []);
    }
  }
  if (!kbDocs.value.has(libId)) {
    try {
      kbDocs.value.set(libId, await listDocuments(libId));
    } catch {
      kbDocs.value.set(libId, []);
    }
  }
};

const toggleKb = (on: boolean) => {
  kbEnabled.value = on;
  emitApply();
};

const toggleResearch = (on: boolean) => {
  researchEnabled.value = on;
  emitApply();
};

const toggleKbLibrary = (id: string, on: boolean) => {
  const libs = new Set(selLibraries.value);
  if (on) {
    libs.add(id);
    void ensureKbMeta(id);
  } else {
    libs.delete(id);
    // 同步清掉该库下已选的标签/文档，避免范围残留
    const tags = new Set(selTags.value);
    for (const t of kbTags.value.get(id) ?? []) tags.delete(t.id_tag);
    selTags.value = tags;
    const docs = new Set(selDocs.value);
    for (const d of kbDocs.value.get(id) ?? []) docs.delete(d.id_document);
    selDocs.value = docs;
  }
  selLibraries.value = libs;
  emitApply();
};

const toggleKbTag = (id: string, on: boolean) => {
  const next = new Set(selTags.value);
  if (on) next.add(id);
  else next.delete(id);
  selTags.value = next;
  emitApply();
};

const toggleKbDoc = (id: string, on: boolean) => {
  const next = new Set(selDocs.value);
  if (on) next.add(id);
  else next.delete(id);
  selDocs.value = next;
  emitApply();
};

/* ── 工具：null 语义 = 全部放行 ── */
const allToolNames = computed(() => (props.assets?.tools ?? []).map((t) => t.name));
const toolsAllEnabled = computed(() => props.config?.enabled_tools == null);

const isToolEnabled = (name: string) => toolsAllEnabled.value || enabledTools.value.has(name);

const materializeTools = (): Set<string> =>
  toolsAllEnabled.value ? new Set(allToolNames.value) : new Set(enabledTools.value);

const toggleTool = (name: string, on: boolean) => {
  const next = materializeTools();
  if (on) next.add(name);
  else next.delete(name);
  enabledTools.value = next;
  emitApply();
};

/* ── 技能：null 语义 = 全部放行 ── */
const allSkillIds = computed(() => (props.assets?.skills ?? []).map((s) => s.id));
const skillsAllEnabled = computed(() => props.config?.enabled_skills == null);

const isSkillEnabled = (id: string) => skillsAllEnabled.value || enabledSkills.value.has(id);

const toggleSkill = (id: string, on: boolean) => {
  const next = skillsAllEnabled.value ? new Set(allSkillIds.value) : new Set(enabledSkills.value);
  if (on) next.add(id);
  else next.delete(id);
  enabledSkills.value = next;
  emitApply();
};

/* ── 技能明细：目录树 + 文件内容 ── */
const skillDetail = ref<SkillDetail | null>(null);
const skillDetailLoading = ref(false);
const skillFile = ref<SkillFile | null>(null);
const skillFileLoading = ref(false);
const skillDetailError = ref('');
const skillFileVisible = ref(false);

const openSkillDetail = async (id: string) => {
  skillDetailError.value = '';
  skillDetailLoading.value = true;
  skillFile.value = null;
  try {
    skillDetail.value = await fetchSkillDetail(id);
  } catch (err: any) {
    skillDetailError.value = err.message || '加载技能明细失败';
  } finally {
    skillDetailLoading.value = false;
  }
};

const closeSkillDetail = () => {
  skillDetail.value = null;
  skillFile.value = null;
  skillDetailError.value = '';
  skillFileVisible.value = false;
};

const openSkillFile = async (path: string) => {
  if (!skillDetail.value) return;
  skillFileLoading.value = true;
  try {
    skillFile.value = await fetchSkillFile(skillDetail.value.id, path);
    skillFileVisible.value = true;
  } catch (err: any) {
    skillDetailError.value = err.message || '加载文件失败';
  } finally {
    skillFileLoading.value = false;
  }
};

/** 是否按 markdown 渲染（.md / .markdown 后缀）。 */
const isMarkdownFile = (path?: string) => !!path && /\.(md|markdown)$/i.test(path);

/** 目录树按目录分组，目录在前文件在后。 */
const skillFileTree = computed(() => {
  if (!skillDetail.value) return [];
  const dirs = new Map<string, string[]>();
  const rootFiles: string[] = [];
  for (const f of skillDetail.value.files) {
    const slash = f.path.lastIndexOf('/');
    if (slash === -1) rootFiles.push(f.path);
    else {
      const dir = f.path.slice(0, slash);
      if (!dirs.has(dir)) dirs.set(dir, []);
      dirs.get(dir)!.push(f.path);
    }
  }
  return [...dirs.entries()].map(([dir, files]) => ({ dir, files }));
});

/* ── MCP server 管理 ── */
const newServerId = ref('');
const newServerUrl = ref('');
const mcpFormError = ref('');

/* ── MCP 工具详情展开 ── */
interface McpParam {
  name: string;
  type: string;
  description: string;
  required: boolean;
}

const expandedTools = ref<Set<string>>(new Set());

const toolKey = (serverId: string, toolName: string) => `${serverId}::${toolName}`;
const isToolExpanded = (serverId: string, toolName: string) =>
  expandedTools.value.has(toolKey(serverId, toolName));
const toggleToolExpand = (serverId: string, toolName: string) => {
  const key = toolKey(serverId, toolName);
  const next = new Set(expandedTools.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  expandedTools.value = next;
};

const toolParams = (t: MCPToolInfo): McpParam[] => {
  const schema = t.input_schema ?? {};
  const props = (schema.properties ?? {}) as Record<string, any>;
  const required = new Set<string>(schema.required ?? []);
  return Object.entries(props).map(([name, p]) => ({
    name,
    type: p && typeof p === 'object' ? String(p.type ?? 'object') : 'string',
    description: p && typeof p === 'object' ? String(p.description ?? '') : '',
    required: required.has(name)
  }));
};

const toggleServer = (id: string, on: boolean) => {
  mcpServers.value = mcpServers.value.map((s) => (s.id === id ? { ...s, enabled: on } : s));
  emitApply();
};

const removeServer = (id: string) => {
  mcpServers.value = mcpServers.value.filter((s) => s.id !== id);
  emitApply();
};

const addServer = () => {
  mcpFormError.value = '';
  const id = newServerId.value.trim();
  const url = newServerUrl.value.trim();
  if (!id || !url) {
    mcpFormError.value = '请填写 ID 与 URL';
    return;
  }
  if (!/^[A-Za-z0-9_-]+$/.test(id)) {
    mcpFormError.value = 'ID 仅支持字母、数字、下划线、连字符';
    return;
  }
  if (mcpServers.value.some((s) => s.id === id)) {
    mcpFormError.value = '该 ID 已存在';
    return;
  }
  mcpServers.value = [...mcpServers.value, { id, url, transport: 'streamable_http', enabled: true }];
  newServerId.value = '';
  newServerUrl.value = '';
  emitApply();
};

/* ── 组装并提交 ── */
const buildPayload = (): PlaygroundConfigPayload => ({
  system_prompt: systemPrompt.value,
  // null 语义 = 「全部放行」（仅在未动过开关、仍为全放行态时保持）；
  // 一旦用户拨动过开关就下发具体集合——哪怕全部关闭（空数组），
  // 避免「全关」被误传成 null 而后端重置为全开。
  enabled_tools: toolsAllEnabled.value && !enabledTools.value.size
    ? null
    : [...enabledTools.value],
  enabled_skills: skillsAllEnabled.value && !enabledSkills.value.size
    ? null
    : [...enabledSkills.value],
  mcp_servers: mcpServers.value.map((s) => ({
    id: s.id,
    url: s.url,
    transport: s.transport,
    enabled: s.enabled
  })),
  knowledge: {
    enabled: kbEnabled.value,
    library_ids: [...selLibraries.value],
    tag_ids: [...selTags.value],
    document_ids: [...selDocs.value]
  },
  research_enabled: researchEnabled.value
});

const emitApply = () => emit('apply', buildPayload());

/* SystemPrompt：500ms 防抖 PUT */
let promptTimer: ReturnType<typeof setTimeout> | null = null;
watch(systemPrompt, () => {
  if (promptTimer) clearTimeout(promptTimer);
  promptTimer = setTimeout(emitApply, 500);
});

/* ── 工具按 group 分组 ── */
const toolGroups = computed(() => {
  const map = new Map<string, ToolAsset[]>();
  for (const tool of props.assets?.tools ?? []) {
    const group = tool.group || 'local';
    if (!map.has(group)) map.set(group, []);
    map.get(group)!.push(tool);
  }
  return [...map.entries()].map(([group, tools]) => ({ group, tools }));
});

const serverStatus = (id: string) =>
  props.assets?.mcp_servers.find((s) => s.id === id) ??
  props.config?.mcp_servers.find((s) => s.id === id);

const statusMeta: Record<string, { label: string; cls: string }> = {
  connected: { label: '已连接', cls: 'ok' },
  error: { label: '连接失败', cls: 'err' },
  pending: { label: '连接中', cls: 'wait' },
  disabled: { label: '已停用', cls: 'off' }
};

/* ── 运行日志（SSE 事件流实时展示） ── */
const logBoxRef = ref<HTMLElement | null>(null);
const autoScroll = ref(true);

/** 事件分类 → 展示标签与颜色 class。 */
const categoryMeta: Record<string, { label: string; cls: string }> = {
  lifecycle: { label: '生命周期', cls: 'c-lifecycle' },
  tool: { label: '工具', cls: 'c-tool' },
  text: { label: '文本', cls: 'c-text' },
  step: { label: '步骤', cls: 'c-step' },
  digest: { label: 'UI 卡片', cls: 'c-digest' },
  snapshot: { label: '快照', cls: 'c-snapshot' },
  error: { label: '错误', cls: 'c-error' },
  other: { label: '其他', cls: 'c-other' }
};

/* 新事件到达时自动滚动到底部（可关闭）。 */
watch(
  () => props.log.length,
  () => {
    if (!autoScroll.value) return;
    nextTick(() => {
      const el = logBoxRef.value;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }
);
</script>

<template>
  <aside class="config-panel">
    <header class="config-header">
      <strong>运行配置</strong>
      <span v-if="saving" class="config-saving-inline">正在应用…</span>
      <button type="button" class="mini-btn" @click="emit('refresh')">
        <RefreshIcon /> 刷新
      </button>
    </header>

    <p v-if="error" class="config-error">{{ error }}</p>

    <div class="config-body">
      <t-tabs v-model="activeTab">
        <!-- ── SystemPrompt ── -->
        <t-tab-panel value="prompt" label="Prompt">
          <div class="tab-inner">
            <p class="field-hint">修改后约 0.5 秒自动保存并实时生效。</p>
            <textarea v-model="systemPrompt" class="prompt-area" rows="16" placeholder="System Prompt" />
          </div>
        </t-tab-panel>

        <!-- ── Skills ── -->
        <t-tab-panel value="skills" label="技能">
          <div class="tab-inner">
            <!-- 明细视图：目录树 + 文件内容 -->
            <template v-if="skillDetail">
              <div class="skill-detail-head">
                <button type="button" class="mini-btn" @click="closeSkillDetail">← 返回</button>
                <strong>{{ skillDetail.name }}</strong>
              </div>
              <p class="field-hint">{{ skillDetail.description }}</p>
              <div class="skill-tree">
                <div v-for="grp in skillFileTree" :key="grp.dir" class="skill-tree-group">
                  <div class="skill-tree-dir">{{ grp.dir }}/</div>
                  <button
                    v-for="path in grp.files"
                    :key="path"
                    type="button"
                    class="skill-tree-file"
                    :class="{ active: skillFile?.path === path }"
                    @click="openSkillFile(path)"
                  >
                    {{ path.slice(path.lastIndexOf('/') + 1) }}
                  </button>
                </div>
                <button
                  v-for="f in skillDetail.files.filter((file) => !file.path.includes('/'))"
                  :key="f.path"
                  type="button"
                  class="skill-tree-file root-file"
                  :class="{ active: skillFile?.path === f.path }"
                  @click="openSkillFile(f.path)"
                >
                  {{ f.path }}
                </button>
              </div>
              <div v-if="skillFileLoading" class="empty-tip">加载中…</div>
            </template>

            <!-- 列表视图：开关 + 明细入口 -->
            <template v-else>
              <p class="field-hint">
                动态加载的技能（read_skill 按需读取）。
                <em v-if="skillsAllEnabled">当前：全部启用</em>
              </p>
              <p v-if="skillDetailLoading" class="field-hint">加载明细中…</p>
              <p v-if="skillDetailError" class="config-error">{{ skillDetailError }}</p>
              <div v-if="!assets?.skills?.length" class="empty-tip">暂无可用技能</div>
              <div v-for="skill in assets?.skills ?? []" :key="skill.id" class="skill-row">
                <label class="check-row skill-check">
                  <t-switch size="small" :value="isSkillEnabled(skill.id)" @change="(v: boolean) => toggleSkill(skill.id, v)" />
                  <span class="check-text">
                    <strong>{{ skill.name }}</strong>
                    <em>{{ skill.description }}</em>
                  </span>
                </label>
                <button type="button" class="mini-btn" @click="openSkillDetail(skill.id)">明细</button>
              </div>
            </template>
          </div>
        </t-tab-panel>

        <!-- ── Tools ── -->
        <t-tab-panel value="tools" label="工具">
          <div class="tab-inner">
            <p class="field-hint">
              本地工具与 MCP 远端工具统一开关。
              <em v-if="toolsAllEnabled">当前：全部启用</em>
            </p>
            <div v-if="!toolGroups.length" class="empty-tip">暂无可用工具</div>
            <section v-for="grp in toolGroups" :key="grp.group" class="tool-group">
              <div class="tool-group-title">{{ grp.group }}</div>
              <label v-for="tool in grp.tools" :key="tool.name" class="check-row">
                <t-switch size="small" :value="isToolEnabled(tool.name)" @change="(v: boolean) => toggleTool(tool.name, v)" />
                <span class="check-text">
                  <strong>{{ tool.name }}</strong>
                  <em>{{ tool.description }}</em>
                </span>
              </label>
            </section>
          </div>
        </t-tab-panel>

        <!-- ── MCP ── -->
        <t-tab-panel value="mcp" label="MCP">
          <div class="tab-inner">
            <p class="field-hint">streamable_http 协议。连接成功后其工具会出现在「工具」页签。</p>

            <div v-if="!mcpServers.length" class="empty-tip">尚未添加 MCP server</div>
            <div v-for="server in mcpServers" :key="server.id" class="mcp-item">
              <div class="mcp-item-head">
                <t-switch size="small" :value="server.enabled" @change="(v: boolean) => toggleServer(server.id, v)" />
                <strong>{{ server.id }}</strong>
                <span class="transport-tag">流式</span>
                <span
                  v-if="serverStatus(server.id)"
                  class="status-dot"
                  :class="statusMeta[serverStatus(server.id)!.status]?.cls"
                >
                  {{ statusMeta[serverStatus(server.id)!.status]?.label }}
                </span>
                <button type="button" class="icon-mini" aria-label="删除" @click="removeServer(server.id)">
                  <CloseIcon />
                </button>
              </div>
              <div class="mcp-item-url">{{ server.url }}</div>
              <p v-if="serverStatus(server.id)?.error" class="mcp-error">{{ serverStatus(server.id)?.error }}</p>
              <div v-if="serverStatus(server.id)?.tools?.length" class="mcp-tools">
                <div v-for="t in serverStatus(server.id)!.tools" :key="t.name" class="mcp-tool-card">
                  <div class="mcp-tool-head">
                    <button
                      type="button"
                      class="icon-mini"
                      :aria-label="isToolExpanded(server.id, t.name) ? '收起' : '展开'"
                      @click="toggleToolExpand(server.id, t.name)"
                    >
                      {{ isToolExpanded(server.id, t.name) ? '−' : '+' }}
                    </button>
                    <strong>{{ t.name }}</strong>
                    <span v-if="!isToolExpanded(server.id, t.name)" class="mcp-tool-desc">{{ t.description }}</span>
                    <a class="expand-link" @click="toggleToolExpand(server.id, t.name)">
                      {{ isToolExpanded(server.id, t.name) ? '收起' : '展开' }}
                    </a>
                  </div>
                  <template v-if="isToolExpanded(server.id, t.name)">
                    <div v-if="t.description" class="mcp-tool-full-desc">{{ t.description }}</div>
                    <div v-if="toolParams(t).length" class="mcp-params">
                      <div v-for="p in toolParams(t)" :key="p.name" class="mcp-param-row">
                        <div class="p-name">
                          {{ p.name }}<span v-if="p.required" class="req">*</span>
                        </div>
                        <div class="p-body">
                          <div class="p-type"><span class="type-dot"></span>{{ p.type }}</div>
                          <div v-if="p.description" class="p-desc">{{ p.description }}</div>
                        </div>
                      </div>
                    </div>
                  </template>
                </div>
              </div>
            </div>

            <div class="mcp-form">
              <input v-model="newServerId" class="mcp-input" placeholder="ID，如 amap" />
              <input v-model="newServerUrl" class="mcp-input" placeholder="URL，如 http://host:port/mcp" />
              <button type="button" class="mini-btn primary" @click="addServer">
                <AddIcon /> 添加
              </button>
              <p v-if="mcpFormError" class="mcp-error">{{ mcpFormError }}</p>
            </div>
          </div>
        </t-tab-panel>

        <!-- ── 知识库：真实库/标签/文档范围 + research 开关 ── -->
        <t-tab-panel value="kb" label="知识库">
          <div class="tab-inner">
            <label class="check-row">
              <t-switch size="small" :value="kbEnabled" @change="(v: boolean) => toggleKb(v)" />
              <span class="check-text">
                <strong>启用知识库检索</strong>
                <em>回答前先 knowledge_search 检索，仅依据指定范围的结果作答</em>
              </span>
            </label>
            <label class="check-row">
              <t-switch size="small" :value="researchEnabled" @change="(v: boolean) => toggleResearch(v)" />
              <span class="check-text">
                <strong>智能研究（Research）</strong>
                <em>规划→取证→评估→汇总五阶段，llama-index 混合检索</em>
              </span>
            </label>

            <div class="kb-scope-title">资料范围</div>
            <p v-if="kbError" class="config-error kb-error">{{ kbError }}</p>
            <p v-if="kbLoading" class="field-hint">加载知识库中…</p>
            <div v-if="!kbLibraries.length && !kbLoading" class="empty-tip">
              暂无知识库，请先在「知识管理」页面创建并上传文档
            </div>

            <div v-for="lib in kbLibraries" :key="lib.id_library" class="kb-lib">
              <label class="check-row">
                <t-checkbox
                  :checked="selLibraries.has(lib.id_library)"
                  @change="(v: boolean) => toggleKbLibrary(lib.id_library, v)"
                />
                <span class="check-text">
                  <strong>{{ lib.name }}</strong>
                  <em>{{ lib.description || lib.collection_name }}</em>
                </span>
              </label>

              <template v-if="selLibraries.has(lib.id_library)">
                <div v-if="(kbTags.get(lib.id_library) ?? []).length" class="kb-sub">
                  <div class="kb-sub-title">标签精细筛选（不选 = 全库）</div>
                  <label
                    v-for="tag in kbTags.get(lib.id_library) ?? []"
                    :key="tag.id_tag"
                    class="check-row kb-sub-row"
                  >
                    <t-checkbox
                      :checked="selTags.has(tag.id_tag)"
                      @change="(v: boolean) => toggleKbTag(tag.id_tag, v)"
                    />
                    <span class="check-text"><strong>{{ tag.name }}</strong></span>
                  </label>
                </div>
                <div v-if="(kbDocs.get(lib.id_library) ?? []).length" class="kb-sub">
                  <div class="kb-sub-title">文档精细筛选（不选 = 全库）</div>
                  <label
                    v-for="doc in kbDocs.get(lib.id_library) ?? []"
                    :key="doc.id_document"
                    class="check-row kb-sub-row"
                  >
                    <t-checkbox
                      :checked="selDocs.has(doc.id_document)"
                      @change="(v: boolean) => toggleKbDoc(doc.id_document, v)"
                    />
                    <span class="check-text"><strong>{{ doc.file_name }}</strong></span>
                  </label>
                </div>
              </template>
            </div>
          </div>
        </t-tab-panel>

        <!-- ── 运行日志（SSE 事件流） ── -->
        <t-tab-panel value="log" label="运行日志">
          <div class="tab-inner log-tab">
            <div class="log-toolbar">
              <span class="log-count">共 {{ log.length }} 条事件</span>
              <label class="log-autoscroll">
                <input type="checkbox" v-model="autoScroll" /> 自动滚动
              </label>
              <button type="button" class="mini-btn" @click="emit('clear-log')">清空</button>
            </div>

            <div ref="logBoxRef" class="log-box">
              <div v-if="!log.length" class="empty-tip">
                暂无日志。在左侧发送一条消息，SSE 事件流将实时展示在这里。
              </div>

              <div v-for="entry in log" :key="entry.id" class="log-entry">
                <div class="log-head">
                  <span class="log-seq">#{{ entry.seq }}</span>
                  <span class="log-cat" :class="categoryMeta[entry.category]?.cls">
                    {{ categoryMeta[entry.category]?.label ?? entry.category }}
                  </span>
                  <span class="log-type">{{ entry.type }}</span>
                  <span class="log-ts">{{ entry.ts }}</span>
                </div>
                <div class="log-summary">{{ entry.summary }}</div>
                <div v-if="entry.detail" class="log-detail">{{ entry.detail }}</div>
                <details class="log-raw">
                  <summary>原始 JSON</summary>
                  <pre>{{ JSON.stringify(entry.raw, null, 2) }}</pre>
                </details>
              </div>
            </div>
          </div>
        </t-tab-panel>
      </t-tabs>
    </div>

    <!-- 文件内容弹窗：面板目录树点哪个文件就弹哪个；.md 渲染 markdown，其余显示源码 -->
    <t-dialog
      v-model:visible="skillFileVisible"
      :header="skillFile?.path || '文件内容'"
      :footer="false"
      width="820px"
      placement="center"
    >
      <div class="skill-file-modal">
        <div v-if="skillFileLoading" class="empty-tip">加载中…</div>
        <template v-else-if="skillFile">
          <p v-if="skillFile.truncated" class="skill-file-truncated">文件过大，仅展示前 512KB</p>
          <div
            v-if="isMarkdownFile(skillFile.path)"
            class="skill-md-body"
            v-html="renderMarkdown(skillFile.content)"
          ></div>
          <pre v-else class="skill-file-content">{{ skillFile.content }}</pre>
        </template>
      </div>
    </t-dialog>
  </aside>
</template>

<style scoped>
.config-panel {
  display: flex;
  flex-direction: column;
  border: 1px solid #e7ebf2;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 12px 28px rgba(18, 32, 63, 0.06);
  overflow: hidden;
}

.config-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #eef1f6;
}

.config-header strong {
  font-size: 15px;
  color: #1f2733;
}

.mini-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: 1px solid #dfe5ef;
  border-radius: 7px;
  background: #fff;
  color: #4a5568;
  font-size: 12px;
  cursor: pointer;
}

.mini-btn.primary {
  border-color: #2e63f5;
  color: #2e63f5;
  background: #eef3ff;
}

.mini-btn svg {
  width: 14px;
  height: 14px;
}

.config-error {
  margin: 8px 16px 0;
  padding: 6px 10px;
  border-radius: 6px;
  background: #fff1f0;
  color: #d92d20;
  font-size: 12px;
}

.config-saving-inline {
  margin-left: auto;
  margin-right: 8px;
  color: #2e63f5;
  font-size: 12px;
}

.config-body {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.config-body :deep(.t-tabs) {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.config-body :deep(.t-tabs__content) {
  flex: 1;
  overflow: hidden;
}

.config-body :deep(.t-tab-panel) {
  height: 100%;
}

.tab-inner {
  height: 100%;
  overflow-y: auto;
  padding: 12px 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.field-hint {
  color: #7b8495;
  font-size: 12px;
  line-height: 1.6;
}

.field-hint em {
  font-style: normal;
  color: #2e63f5;
}

.prompt-area {
  width: 100%;
  resize: vertical;
  border: 1px solid #dfe5ef;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 13px;
  line-height: 1.7;
  font-family: 'SFMono-Regular', Menlo, Consolas, monospace;
  outline: none;
  box-sizing: border-box;
}

.prompt-area:focus {
  border-color: #2e63f5;
}

.empty-tip {
  padding: 16px;
  text-align: center;
  color: #98a2b3;
  font-size: 13px;
  border: 1px dashed #e3eaf6;
  border-radius: 8px;
}

.check-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
}

.check-row:hover {
  background: #f6f8fc;
}

.skill-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.skill-row .mini-btn {
  flex: none;
  margin-top: 8px;
}

.skill-check {
  flex: 1;
  min-width: 0;
}

.skill-detail-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.skill-detail-head strong {
  font-size: 14px;
  color: #1f2733;
}

.skill-tree {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px;
  border: 1px solid #e3eaf6;
  border-radius: 8px;
  background: #fbfcfe;
}

.skill-tree-group {
  display: flex;
  flex-direction: column;
}

.skill-tree-dir {
  padding: 2px 6px;
  font-size: 12px;
  font-weight: 700;
  color: #7b8495;
}

.skill-tree-file {
  padding: 3px 6px 3px 18px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #344054;
  font-size: 12px;
  font-family: 'SFMono-Regular', Menlo, Consolas, monospace;
  text-align: left;
  cursor: pointer;
}

.skill-tree-file.root-file {
  padding-left: 6px;
}

.skill-tree-file:hover {
  background: #eef3ff;
}

.skill-tree-file.active {
  background: #e0ecff;
  color: #2e63f5;
}

.skill-file-content {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid #e3eaf6;
  border-radius: 8px;
  background: #0f172a;
  color: #e2e8f0;
  font-size: 12px;
  line-height: 1.6;
  font-family: 'SFMono-Regular', Menlo, Consolas, monospace;
  white-space: pre-wrap;
  word-break: break-all;
  overflow-x: auto;
}

.skill-file-modal {
  max-height: 70vh;
  overflow-y: auto;
}

.skill-file-truncated {
  padding: 4px 8px;
  border-radius: 6px;
  background: #fff7e6;
  color: #b45309;
  font-size: 12px;
}

.skill-md-body {
  font-size: 14px;
  line-height: 1.75;
  color: #1f2733;
  word-break: break-word;
}

.skill-md-body :deep(h1),
.skill-md-body :deep(h2),
.skill-md-body :deep(h3),
.skill-md-body :deep(h4) {
  margin: 16px 0 8px;
  color: #1f2733;
}

.skill-md-body :deep(h1) {
  font-size: 19px;
  border-bottom: 1px solid #eef1f6;
  padding-bottom: 6px;
}

.skill-md-body :deep(h2) {
  font-size: 16px;
}

.skill-md-body :deep(h3) {
  font-size: 14px;
}

.skill-md-body :deep(p),
.skill-md-body :deep(ul),
.skill-md-body :deep(ol) {
  margin: 0 0 8px;
}

.skill-md-body :deep(ul),
.skill-md-body :deep(ol) {
  padding-left: 20px;
}

.skill-md-body :deep(table) {
  border-collapse: collapse;
  margin: 8px 0;
}

.skill-md-body :deep(th),
.skill-md-body :deep(td) {
  border: 1px solid #e3eaf6;
  padding: 6px 10px;
  font-size: 13px;
}

.skill-md-body :deep(th) {
  background: #f6f8fc;
}

.skill-md-body :deep(pre) {
  padding: 12px;
  border-radius: 8px;
  background: #0f172a;
  color: #e2e8f0;
  overflow-x: auto;
}

.skill-md-body :deep(code) {
  font-family: 'SFMono-Regular', Menlo, Consolas, monospace;
  font-size: 13px;
}

.skill-md-body :deep(:not(pre) > code) {
  padding: 1px 5px;
  border-radius: 5px;
  background: #f1f5f9;
  color: #c026d3;
}

.skill-md-body :deep(blockquote) {
  margin: 8px 0;
  padding: 4px 12px;
  border-left: 3px solid #2e63f5;
  background: #f6f8fc;
  color: #667085;
}

.check-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.check-text strong {
  font-size: 13px;
  color: #344054;
  word-break: break-all;
}

.check-text em {
  font-style: normal;
  font-size: 12px;
  color: #98a2b3;
  line-height: 1.5;
}

.tool-group {
  display: flex;
  flex-direction: column;
}

.tool-group-title {
  margin: 6px 0 2px;
  padding: 0 10px;
  font-size: 12px;
  font-weight: 700;
  color: #7b8495;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.mcp-item {
  border: 1px solid #e3eaf6;
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.mcp-item-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mcp-item-head strong {
  font-size: 13px;
  color: #1f2733;
}

.transport-tag {
  padding: 1px 6px;
  border-radius: 5px;
  background: #eef3ff;
  color: #2e63f5;
  font-size: 11px;
}

.status-dot {
  font-size: 11px;
}

.status-dot.ok {
  color: #22c55e;
}

.status-dot.err {
  color: #d92d20;
}

.status-dot.wait {
  color: #f59e0b;
}

.status-dot.off {
  color: #98a2b3;
}

.icon-mini {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #98a2b3;
  cursor: pointer;
}

.icon-mini:hover {
  background: #fff1f0;
  color: #d92d20;
}

.icon-mini svg {
  width: 14px;
  height: 14px;
}

.mcp-item-url {
  font-size: 12px;
  color: #667085;
  word-break: break-all;
}

.mcp-error {
  font-size: 12px;
  color: #d92d20;
}

.mcp-tools {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.mcp-tool-card {
  border: 1px solid #e3eaf6;
  border-radius: 8px;
  background: #fbfcfe;
}

.mcp-tool-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
}

.mcp-tool-head strong {
  font-size: 13px;
  white-space: nowrap;
}

.mcp-tool-desc {
  flex: 1;
  font-size: 12px;
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.expand-link {
  color: #2563eb;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}

.mcp-tool-full-desc {
  margin: 0 10px 8px;
  font-size: 12px;
  color: #64748b;
  line-height: 1.6;
}

.mcp-params {
  margin: 0 10px 10px;
  border: 1px solid #e3eaf6;
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
}

.mcp-param-row {
  display: flex;
}

.mcp-param-row + .mcp-param-row {
  border-top: 1px solid #e3eaf6;
}

.p-name {
  width: 38%;
  padding: 8px 10px;
  font-weight: 600;
  font-size: 12px;
  border-right: 1px solid #e3eaf6;
}

.req {
  color: #d92d20;
  margin-left: 2px;
}

.p-body {
  flex: 1;
  padding: 8px 10px;
}

.p-type {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #475569;
}

.type-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #2563eb;
  display: inline-block;
}

.p-desc {
  margin-top: 4px;
  font-size: 12px;
  color: #64748b;
}

.mcp-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 6px;
  border-top: 1px dashed #e3eaf6;
}

.mcp-input {
  border: 1px solid #dfe5ef;
  border-radius: 7px;
  padding: 7px 10px;
  font-size: 13px;
  outline: none;
}

.mcp-input:focus {
  border-color: #2e63f5;
}

.kb-scope-title {
  margin-top: 4px;
  font-size: 12px;
  font-weight: 700;
  color: #7b8495;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.kb-error {
  margin: 0;
}

.kb-lib {
  border: 1px solid #e3eaf6;
  border-radius: 10px;
  padding: 4px 6px;
  display: flex;
  flex-direction: column;
}

.kb-sub {
  margin: 2px 0 6px;
  padding-left: 30px;
  display: flex;
  flex-direction: column;
}

.kb-sub-title {
  font-size: 11px;
  font-weight: 600;
  color: #98a2b3;
  padding: 2px 10px;
}

.kb-sub-row {
  padding: 4px 10px;
}

/* ── 运行日志 ── */
.log-tab {
  overflow: hidden;
  gap: 8px;
}

.log-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: none;
}

.log-count {
  font-size: 12px;
  color: #7b8495;
}

.log-autoscroll {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #4a5568;
  cursor: pointer;
}

.log-toolbar .mini-btn {
  margin-left: auto;
}

.log-box {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 2px;
}

.log-entry {
  border: 1px solid #e3eaf6;
  border-radius: 8px;
  padding: 8px 10px;
  background: #fbfcfe;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.log-head {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.log-seq {
  font-size: 11px;
  font-weight: 700;
  color: #98a2b3;
  font-family: 'SFMono-Regular', Menlo, Consolas, monospace;
}

.log-cat {
  padding: 1px 7px;
  border-radius: 5px;
  font-size: 11px;
  font-weight: 600;
}

.log-cat.c-lifecycle {
  background: #f3e8ff;
  color: #7c3aed;
}

.log-cat.c-tool {
  background: #e0ecff;
  color: #2563eb;
}

.log-cat.c-text {
  background: #dcfce7;
  color: #16a34a;
}

.log-cat.c-step {
  background: #eef1f6;
  color: #64748b;
}

.log-cat.c-digest {
  background: #ffedd5;
  color: #ea580c;
}

.log-cat.c-snapshot {
  background: #ccfbf1;
  color: #0d9488;
}

.log-cat.c-error {
  background: #fee2e2;
  color: #dc2626;
}

.log-cat.c-other {
  background: #f1f5f9;
  color: #475569;
}

.log-type {
  font-size: 11px;
  color: #475569;
  font-family: 'SFMono-Regular', Menlo, Consolas, monospace;
}

.log-ts {
  margin-left: auto;
  font-size: 10px;
  color: #b3bccb;
  font-family: 'SFMono-Regular', Menlo, Consolas, monospace;
}

.log-summary {
  font-size: 12px;
  color: #344054;
  line-height: 1.5;
}

.log-detail {
  font-size: 11px;
  color: #667085;
  line-height: 1.5;
  word-break: break-all;
  background: #f6f8fc;
  border-radius: 6px;
  padding: 4px 8px;
  font-family: 'SFMono-Regular', Menlo, Consolas, monospace;
  white-space: pre-wrap;
}

.log-raw summary {
  font-size: 11px;
  color: #2e63f5;
  cursor: pointer;
  user-select: none;
}

.log-raw pre {
  margin: 6px 0 0;
  padding: 8px;
  border-radius: 6px;
  background: #0f172a;
  color: #e2e8f0;
  font-size: 11px;
  line-height: 1.5;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
