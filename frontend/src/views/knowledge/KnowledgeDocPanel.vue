<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import type { ChunkMethodSpec, KnowledgeDocument, Library, Tag } from './api';
import KnowledgeDocDrawer from './KnowledgeDocDrawer.vue';
import { createTag, deleteDocument, fetchChunkMethods, listDocuments, moveDocument, retryDocument, uploadDocument } from './api';
import type { KnowledgeDocument as Doc } from './api';

const props = defineProps<{ library: Library; tags: Tag[]; activeTagId: string }>();
const emit = defineEmits<{
  (e: 'tags-changed', selectTagId?: string): void;
}>();

const documents = ref<KnowledgeDocument[]>([]);
const loading = ref(false);
let poller: ReturnType<typeof setInterval> | null = null;

/** 五种切分策略示意图（原图出自 Avi Chawla《5 Chunking Strategies For RAG》）。 */
const DIAGRAMS: Record<string, string> = {
  fixed:
    'https://substackcdn.com/image/fetch/$s_!RG5y!,w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F98c422a0-f0e2-457c-a256-4476a56a601f_943x232.png',
  semantic:
    'https://substackcdn.com/image/fetch/$s_!sTc2!,w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F74037e11-362d-4ea2-8ee2-ee85ab013523_963x231.png',
  recursive:
    'https://substackcdn.com/image/fetch/$s_!5-DV!,w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fb0e40cc1-996f-48f4-9306-781b112536e4_984x428.png',
  structure:
    'https://substackcdn.com/image/fetch/$s_!9CjT!,w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F40bdaf3b-601d-4357-bc7f-89b47f812097_1025x663.png',
  llm: 'https://substackcdn.com/image/fetch/$s_!jVmL!,w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F4d1b6d60-8956-4030-8525-d899ee61a9d5_1140x198.gif'
};

// ── 上传 modal ──
const showUpload = ref(false);
const methodSpecs = ref<ChunkMethodSpec[]>([]);
const chunkMethod = ref('recursive');
const paramValues = ref<Record<string, any>>({});
const withSummary = ref(false);
const pendingFiles = ref<File[]>([]);
const uploading = ref(false);
const uploadProgress = ref({ current: 0, total: 0, name: '' });
const fileInput = ref<HTMLInputElement>();
const dirInput = ref<HTMLInputElement>();

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  pending: { text: '排队中', cls: 'is-pending' },
  parsing: { text: '解析中', cls: 'is-running' },
  chunking: { text: '分块中', cls: 'is-running' },
  done: { text: '已完成', cls: 'is-done' },
  error: { text: '失败', cls: 'is-error' }
};

const activeSpec = computed(
  () => methodSpecs.value.find((m) => m.method === chunkMethod.value) || null
);

/** 当前方法需要渲染的参数。 */
const visibleParams = computed(() => activeSpec.value?.params || []);

function onMethodChange() {
  // 重置为该方法的默认参数
  const spec = activeSpec.value;
  paramValues.value = {};
  for (const p of spec?.params || []) paramValues.value[p.name] = p.default;
}

function buildChunkingConfig(): Record<string, any> {
  const cfg: Record<string, any> = { method: chunkMethod.value };
  for (const p of visibleParams.value) {
    const v = paramValues.value[p.name];
    if (v !== undefined && v !== null && v !== '') cfg[p.name] = p.type === 'int' ? Number(v) : v;
  }
  if (withSummary.value) cfg.with_summary = true;
  return cfg;
}

function addFiles(list: FileList | null) {
  if (!list?.length) return;
  const existing = new Set(pendingFiles.value.map((f) => f.name + f.size));
  for (const f of Array.from(list)) {
    // 跳过 .DS_Store 等隐藏文件（文件夹上传时 macOS 会带上）
    if (f.name.startsWith('.')) continue;
    if (!existing.has(f.name + f.size)) pendingFiles.value.push(f);
  }
}

function removeFile(i: number) {
  pendingFiles.value.splice(i, 1);
}

async function onUploadConfirm() {
  if (!pendingFiles.value.length) {
    MessagePlugin.warning('请先选择文件或文件夹');
    return;
  }
  const cfg = buildChunkingConfig();
  const files = [...pendingFiles.value];
  uploading.value = true;
  uploadProgress.value = { current: 0, total: files.length, name: '' };
  let failed = 0;
  try {
    for (let i = 0; i < files.length; i++) {
      uploadProgress.value = { current: i + 1, total: files.length, name: files[i].name };
      try {
        await uploadDocument(props.library.id_library, files[i], props.activeTagId, cfg);
      } catch {
        failed += 1;
      }
    }
    if (failed) MessagePlugin.warning(`上传完成：${files.length - failed} 成功，${failed} 失败`);
    else MessagePlugin.success(`已上传 ${files.length} 个文件，后台解析中`);
    showUpload.value = false;
    pendingFiles.value = [];
    await refresh();
  } finally {
    uploading.value = false;
    if (fileInput.value) fileInput.value.value = '';
    if (dirInput.value) dirInput.value.value = '';
  }
}

async function refresh() {
  if (!props.library) return;
  loading.value = true;
  try {
    documents.value = await listDocuments(
      props.library.id_library,
      props.activeTagId || undefined
    );
  } catch (e: any) {
    MessagePlugin.error(e.message);
  } finally {
    loading.value = false;
  }
}

function startPolling() {
  stopPolling();
  poller = setInterval(() => {
    if (documents.value.some((d) => ['pending', 'parsing', 'chunking'].includes(d.parse_status))) {
      refresh();
    }
  }, 3000);
}

function stopPolling() {
  if (poller) clearInterval(poller);
  poller = null;
}

const showDrawer = ref(false);
const drawerDoc = ref<Doc | null>(null);

function onShowChunks(doc: KnowledgeDocument) {
  drawerDoc.value = doc;
  showDrawer.value = true;
}

async function onRetry(doc: KnowledgeDocument) {
  try {
    await retryDocument(doc.id_document);
    MessagePlugin.success('已重新排队解析');
    await refresh();
  } catch (e: any) {
    MessagePlugin.error(e.message);
  }
}

// ── 移动目录 ──
const showMove = ref(false);
const moveDoc = ref<KnowledgeDocument | null>(null);
const moveTarget = ref('');

/** 扁平化目录树供 select 使用（缩进表示层级）。 */
const tagOptions = computed(() => {
  const byParent = new Map<string, Tag[]>();
  for (const t of props.tags) {
    const key = t.parent_id_tag || '';
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(t);
  }
  const out: { label: string; value: string }[] = [];
  const walk = (parentId: string, depth: number) => {
    for (const t of byParent.get(parentId) || []) {
      out.push({ label: `${'── '.repeat(depth)}${t.name}`, value: t.id_tag });
      walk(t.id_tag, depth + 1);
    }
  };
  walk('', 0);
  return out;
});

function onMove(doc: KnowledgeDocument) {
  moveDoc.value = doc;
  moveTarget.value = doc.id_tag;
  showMove.value = true;
}

async function onMoveConfirm() {
  if (!moveDoc.value) return;
  try {
    await moveDocument(moveDoc.value.id_document, moveTarget.value);
    MessagePlugin.success('已移动');
    showMove.value = false;
    emit('tags-changed');
    await refresh();
  } catch (e: any) {
    MessagePlugin.error(e.message);
  }
}

async function onCreateRootTag() {
  const name = window.prompt('根目录名称');
  if (!name?.trim()) return;
  try {
    const tag = await createTag(props.library.id_library, name.trim(), '');
    MessagePlugin.success('根目录已创建');
    emit('tags-changed', tag.id_tag);
  } catch (e: any) {
    MessagePlugin.error(e.message);
  }
}

async function onDelete(doc: KnowledgeDocument) {
  try {
    await deleteDocument(doc.id_document);
    MessagePlugin.success('已删除');
    await refresh();
  } catch (e: any) {
    MessagePlugin.error(e.message);
  }
}

watch(
  () => [props.library?.id_library, props.activeTagId],
  () => {
    refresh();
    startPolling();
  },
  { immediate: true }
);
onMounted(async () => {
  try {
    const r = await fetchChunkMethods();
    methodSpecs.value = r.methods;
    chunkMethod.value = r.default || 'recursive';
    onMethodChange();
  } catch {
    /* 接口不可用时保持默认 */
  }
});
onUnmounted(stopPolling);
</script>

<template>
  <div class="doc-panel">
    <div v-if="!tags.length" class="doc-guide">
      该库还没有目录，先创建根目录再上传文档。
      <t-button size="small" theme="primary" variant="outline" @click="onCreateRootTag">
        创建根目录
      </t-button>
    </div>
    <div class="doc-toolbar">
      <t-button
        size="small"
        theme="primary"
        :disabled="!activeTagId"
        :title="activeTagId ? '' : '请先在左侧选择一个目录'"
        @click="showUpload = true"
      >
        上传文档
      </t-button>
      <span class="doc-hint">
        {{ activeTagId ? '支持多选与整个文件夹，pdf / office / md，MinerU3 解析' : '请先在左侧选择目录后再上传' }}
      </span>
    </div>

    <div v-if="!documents.length && !loading" class="doc-empty">当前目录下暂无文档</div>
    <ul class="doc-list">
      <li v-for="doc in documents" :key="doc.id_document" class="doc-item">
        <div class="doc-main">
          <span class="doc-name">{{ doc.file_name }}</span>
          <span class="doc-meta">
            {{ (doc.file_size / 1024).toFixed(1) }} KB · {{ doc.file_type }}
          </span>
        </div>
        <div class="doc-side">
          <span
            class="doc-status"
            :class="STATUS_LABEL[doc.parse_status]?.cls"
            :title="doc.error_message"
          >
            {{ STATUS_LABEL[doc.parse_status]?.text || doc.parse_status }}
          </span>
          <t-button
            v-if="doc.parse_status === 'done'"
            size="small"
            variant="text"
            theme="primary"
            @click="onShowChunks(doc)"
          >
            切片
          </t-button>
          <t-button
            v-if="doc.parse_status === 'error'"
            size="small"
            variant="text"
            theme="primary"
            @click="onRetry(doc)"
          >
            重试
          </t-button>
          <t-button size="small" variant="text" @click="onMove(doc)">
            移动
          </t-button>
          <t-button size="small" variant="text" theme="danger" @click="onDelete(doc)">
            删除
          </t-button>
        </div>
        <p v-if="doc.description" class="doc-summary">{{ doc.description }}</p>
      </li>
    </ul>

    <KnowledgeDocDrawer v-model:visible="showDrawer" :doc="drawerDoc" />

    <t-dialog
      v-model:visible="showMove"
      header="移动到其他目录"
      :on-confirm="onMoveConfirm"
      width="380px"
    >
      <t-select v-model="moveTarget" :options="tagOptions" placeholder="选择目标目录" />
    </t-dialog>

    <t-dialog
      v-model:visible="showUpload"
      header="上传文档"
      width="520px"
      :confirm-btn="{ content: '开始上传', loading: uploading }"
      :on-confirm="onUploadConfirm"
    >
      <div class="upload-form">
        <div class="upload-block">
          <div class="upload-pick">
            <t-button size="small" variant="outline" @click="fileInput?.click()">选择文件</t-button>
            <t-button size="small" variant="outline" @click="dirInput?.click()">选择文件夹</t-button>
            <input
              ref="fileInput"
              type="file"
              multiple
              style="display: none"
              accept=".pdf,.docx,.pptx,.xlsx,.md,.txt,.png,.jpg,.jpeg"
              @change="addFiles(($event.target as HTMLInputElement).files)"
            />
            <input
              ref="dirInput"
              type="file"
              webkitdirectory
              style="display: none"
              @change="addFiles(($event.target as HTMLInputElement).files)"
            />
          </div>
          <ul v-if="pendingFiles.length" class="pick-list">
            <li v-for="(f, i) in pendingFiles" :key="f.name + f.size" class="pick-item">
              <span class="pick-name" :title="(f as any).webkitRelativePath || f.name">
                {{ (f as any).webkitRelativePath || f.name }}
              </span>
              <span class="pick-size">{{ (f.size / 1024).toFixed(1) }} KB</span>
              <span class="pick-del" @click="removeFile(i)">×</span>
            </li>
          </ul>
          <p v-else class="pick-empty">未选择文件</p>
        </div>

        <div class="upload-block">
          <p class="block-label">切分方式</p>
          <t-select
            v-model="chunkMethod"
            :options="methodSpecs.map((m) => ({ label: m.label, value: m.method }))"
            @change="onMethodChange"
          />
        </div>

        <div v-if="visibleParams.length" class="upload-block">
          <p class="block-label">切分参数</p>
          <div v-for="p in visibleParams" :key="p.name" class="param-row">
            <span class="param-label" :title="p.desc">{{ p.label }}</span>
            <t-input-number
              v-if="p.type === 'int'"
              v-model="paramValues[p.name]"
              size="small"
              style="width: 140px"
              :min="0"
            />
            <t-select
              v-else-if="p.type === 'select'"
              v-model="paramValues[p.name]"
              size="small"
              style="width: 140px"
              :options="(p.options || []).map((o) => ({
                label: methodSpecs.find((m) => m.method === o)?.label || o,
                value: o
              }))"
              @change="onMethodChange"
            />
          </div>
          <p v-if="activeSpec?.params.some((p) => p.desc)" class="param-desc">
            {{ visibleParams.map((p) => p.desc).filter(Boolean).join('；') }}
          </p>
        </div>

        <div class="upload-block">
          <t-checkbox v-model="withSummary">
            每个切片头部拼接文档摘要（提升召回相关性）
          </t-checkbox>
        </div>

        <div class="upload-block">
          <p class="block-label">切分效果示意</p>
          <img
            :src="DIAGRAMS[chunkMethod]"
            class="chunk-diagram"
            :alt="activeSpec?.label || chunkMethod"
          />
        </div>

        <div v-if="uploading" class="upload-progress">
          正在上传 {{ uploadProgress.current }}/{{ uploadProgress.total }}：{{ uploadProgress.name }}
        </div>
      </div>
    </t-dialog>
  </div>
</template>

<style scoped>
.doc-panel { display: flex; flex-direction: column; gap: 10px; min-height: 0; }
.doc-guide {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px; border: 1px dashed #f0b429; border-radius: 8px;
  background: #fffbea; color: #8a6d1a; font-size: 12px;
}
.doc-toolbar { display: flex; align-items: center; gap: 8px; }
.doc-hint { font-size: 12px; color: #98a2b3; }
.doc-empty { padding: 32px 0; text-align: center; color: #98a2b3; font-size: 13px; }
.doc-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; overflow-y: auto; }
.doc-item {
  display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px;
  padding: 10px 12px; border: 1px solid #e7ebf2; border-radius: 8px; background: #fff;
}
.doc-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.doc-name { font-size: 13px; font-weight: 600; color: #1d2939; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.doc-meta { font-size: 12px; color: #98a2b3; }
.doc-side { display: flex; align-items: center; gap: 8px; }
.doc-status { font-size: 12px; padding: 2px 8px; border-radius: 10px; }
.doc-status.is-pending { background: #f2f4f7; color: #667085; }
.doc-status.is-running { background: #e0eaff; color: #2f5bff; }
.doc-status.is-done { background: #e7f8f0; color: #039855; }
.doc-status.is-error { background: #fef3f2; color: #d92d20; }
.doc-summary { flex-basis: 100%; margin: 0; font-size: 12px; color: #667085; line-height: 1.6; }

.upload-form { display: flex; flex-direction: column; gap: 14px; padding: 4px 0; }
.upload-block { display: flex; flex-direction: column; gap: 8px; }
.upload-pick { display: flex; gap: 8px; }
.block-label { margin: 0; font-size: 13px; font-weight: 600; color: #1d2939; }
.pick-list {
  list-style: none; margin: 0; padding: 6px; max-height: 160px; overflow-y: auto;
  border: 1px solid #e7ebf2; border-radius: 8px; display: flex; flex-direction: column; gap: 4px;
}
.pick-item { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.pick-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #1d2939; }
.pick-size { color: #98a2b3; }
.pick-del { color: #c0c6d4; cursor: pointer; padding: 0 4px; }
.pick-del:hover { color: #d92d20; }
.pick-empty { margin: 0; font-size: 12px; color: #c0c6d4; }
.param-row { display: flex; align-items: center; gap: 10px; }
.param-label { flex: 0 0 120px; font-size: 12px; color: #4a5568; }
.param-desc { margin: 0; font-size: 11px; color: #98a2b3; line-height: 1.6; }
.chunk-diagram {
  width: 100%; border: 1px solid #e7ebf2; border-radius: 8px; background: #fff;
}
.upload-progress { font-size: 12px; color: #2f5bff; }
</style>
