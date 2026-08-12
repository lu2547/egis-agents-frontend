<script setup lang="ts">
// 知识评估：ragas 四指标（忠实度/答案相关性/上下文精确率/上下文召回率）
// 左栏库与案例集，右栏运行历史 + 汇总 + 逐案例分段打分明细。
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import type { EvalCase, EvalRun, EvalRunDetail, EvalRetrieved, Library } from './api';
import {
  createEvalCase,
  deleteEvalCase,
  generateEvalCases,
  getEvalRun,
  listEvalCases,
  listEvalRuns,
  listLibraries,
  startEvalRun
} from './api';

const METRIC_LABELS: Record<string, string> = {
  faithfulness: '忠实度',
  answer_relevancy: '答案相关性',
  context_precision: '上下文精确率',
  context_recall: '上下文召回率'
};
const METRIC_KEYS = ['faithfulness', 'answer_relevancy', 'context_precision', 'context_recall'];

// ── 库选择 ──
const libraries = ref<Library[]>([]);
const activeLibId = ref('');
const evalLibs = computed(() => libraries.value.filter((l) => l.sub_type !== 'experience'));

// ── 案例集 ──
const cases = ref<EvalCase[]>([]);
const showAddCase = ref(false);
const caseForm = ref({ question: '', ground_truth: '', category: '' });
const showGenerate = ref(false);
const generateCount = ref(5);
const generating = ref(false);

// ── 运行 ──
const runs = ref<EvalRun[]>([]);
const runMode = ref('hybrid');
const runTopK = ref(5);
const starting = ref(false);
const activeRunId = ref('');
const runDetail = ref<EvalRunDetail | null>(null);
const expanded = ref<Record<string, boolean>>({});
let poller: ReturnType<typeof setInterval> | null = null;

function scoreCls(v?: number) {
  if (v === undefined || v === null) return 'is-na';
  if (v >= 0.8) return 'is-good';
  if (v >= 0.5) return 'is-mid';
  return 'is-bad';
}

function pct(v?: number) {
  return v === undefined || v === null ? '—' : (v * 100).toFixed(1);
}

async function refreshCases() {
  if (!activeLibId.value) {
    cases.value = [];
    return;
  }
  cases.value = await listEvalCases(activeLibId.value);
}

async function refreshRuns(selectLatest = false) {
  if (!activeLibId.value) {
    runs.value = [];
    return;
  }
  runs.value = await listEvalRuns(activeLibId.value);
  if (selectLatest && runs.value.length) activeRunId.value = runs.value[0].id_run;
}

async function refreshDetail() {
  if (!activeRunId.value) {
    runDetail.value = null;
    return;
  }
  runDetail.value = await getEvalRun(activeRunId.value);
}

async function onAddCase() {
  if (!caseForm.value.question.trim()) {
    MessagePlugin.warning('问题不能为空');
    return;
  }
  try {
    await createEvalCase(activeLibId.value, {
      question: caseForm.value.question.trim(),
      ground_truth: caseForm.value.ground_truth.trim(),
      category: caseForm.value.category.trim() || '手动添加'
    });
    MessagePlugin.success('已添加案例');
    showAddCase.value = false;
    caseForm.value = { question: '', ground_truth: '', category: '' };
    await refreshCases();
  } catch (e: any) {
    MessagePlugin.error(e.message);
  }
}

async function onGenerate() {
  generating.value = true;
  try {
    const res = await generateEvalCases(activeLibId.value, generateCount.value);
    MessagePlugin.success(`自动生成 ${res.created}/${res.requested} 条案例`);
    showGenerate.value = false;
    await refreshCases();
  } catch (e: any) {
    MessagePlugin.error(e.message);
  } finally {
    generating.value = false;
  }
}

async function onDeleteCase(c: EvalCase) {
  try {
    await deleteEvalCase(c.id_case);
    await refreshCases();
  } catch (e: any) {
    MessagePlugin.error(e.message);
  }
}

async function onStartRun() {
  if (!cases.value.length) {
    MessagePlugin.warning('案例集为空，请先添加或自动生成案例');
    return;
  }
  starting.value = true;
  try {
    const run = await startEvalRun(activeLibId.value, runMode.value, runTopK.value);
    activeRunId.value = run.id_run;
    await refreshRuns();
    await refreshDetail();
    MessagePlugin.info('评估已开始，逐条打分需几分钟');
    startPolling();
  } catch (e: any) {
    MessagePlugin.error(e.message);
  } finally {
    starting.value = false;
  }
}

function startPolling() {
  stopPolling();
  poller = setInterval(async () => {
    if (!runDetail.value || runDetail.value.status !== 'running') {
      // 仍在列表里有 running 就继续刷
      if (!runs.value.some((r) => r.status === 'running')) {
        stopPolling();
        return;
      }
    }
    try {
      await refreshRuns();
      await refreshDetail();
    } catch {
      /* 轮询失败忽略，下轮重试 */
    }
  }, 5000);
}

function stopPolling() {
  if (poller) clearInterval(poller);
  poller = null;
}

watch(activeLibId, async () => {
  activeRunId.value = '';
  runDetail.value = null;
  stopPolling();
  await Promise.all([refreshCases(), refreshRuns(true)]);
  await refreshDetail();
  if (runs.value.some((r) => r.status === 'running')) startPolling();
});

watch(activeRunId, refreshDetail);

onMounted(async () => {
  try {
    libraries.value = await listLibraries();
    activeLibId.value = evalLibs.value[0]?.id_library || '';
  } catch (e: any) {
    MessagePlugin.error(e.message);
  }
});

onUnmounted(stopPolling);

const summary = computed(() => runDetail.value?.summary || {});

// ── Markdown 渲染 & 截断 ──
marked.setOptions({ breaks: true, gfm: true });

function renderMd(t: string): string {
  return DOMPurify.sanitize(marked.parse(t || '') as string);
}
function truncateLines(content: string, max = 10): { text: string; hasMore: boolean } {
  const lines = content.split('\n');
  if (lines.length <= max) return { text: content, hasMore: false };
  return { text: lines.slice(0, max).join('\n'), hasMore: true };
}
function truncateTable(content: string, maxRows = 10): { text: string; hasMore: boolean } {
  const lines = content.split('\n');
  const tableStart = lines.findIndex((l) => l.trimStart().startsWith('|'));
  if (tableStart < 0) return truncateLines(content, maxRows);
  const dataStart = tableStart + 2;
  const dataLines = lines.slice(dataStart).filter((l) => l.trimStart().startsWith('|'));
  if (dataLines.length <= maxRows) return { text: content, hasMore: false };
  const kept = [...lines.slice(0, dataStart), ...dataLines.slice(0, maxRows)];
  return { text: kept.join('\n'), hasMore: true };
}
function isTable(c: string): boolean {
  return /\|.*\|/.test(c.split('\n').find((l) => l.trimStart().startsWith('|')) || '');
}
function getPreview(content: string): { html: string; hasMore: boolean } {
  const c = content || '';
  const { text, hasMore } = isTable(c) ? truncateTable(c) : truncateLines(c);
  return { html: renderMd(text), hasMore };
}

// ── 知识块详情弹窗 ──
const showChunkModal = ref(false);
const modalContent = ref('');
const modalTitle = ref('');
function openChunk(hit: EvalRetrieved) {
  modalTitle.value = hit.file_name;
  modalContent.value = renderMd(hit.content || hit.snippet || '');
  showChunkModal.value = true;
}
</script>

<template>
  <div class="eval-panel">
    <!-- 左栏：库 + 案例集 -->
    <aside class="side-column">
      <div class="side-section">
        <div class="col-head"><span>评估库</span></div>
        <t-select v-model="activeLibId" placeholder="选择库" size="small">
          <t-option
            v-for="lib in evalLibs"
            :key="lib.id_library"
            :value="lib.id_library"
            :label="lib.name"
          />
        </t-select>
      </div>

      <div class="side-section case-section">
        <div class="col-head">
          <span>案例集（{{ cases.length }}）</span>
          <div class="case-head-op">
            <t-button size="small" variant="outline" :disabled="!activeLibId" @click="showGenerate = true">
              自动生成
            </t-button>
            <t-button size="small" theme="primary" :disabled="!activeLibId" @click="showAddCase = true">
              添加
            </t-button>
          </div>
        </div>
        <div class="side-scroll">
          <div v-if="!activeLibId" class="case-empty">先选择一个库</div>
          <ul v-else class="case-list">
            <li v-for="c in cases" :key="c.id_case" class="case-item">
              <div class="case-q">{{ c.question }}</div>
              <div class="case-meta">
                <span class="case-badge" :class="c.source === 'auto' ? 'is-auto' : 'is-manual'">
                  {{ c.source === 'auto' ? '自动' : '手建' }}
                </span>
                <span v-if="c.category" class="case-cat">{{ c.category }}</span>
                <span v-if="!c.ground_truth" class="case-cat">无参考答案</span>
                <span class="case-del" title="删除案例" @click="onDeleteCase(c)">×</span>
              </div>
            </li>
            <li v-if="!cases.length" class="case-empty">暂无案例，可「自动生成」或「添加」</li>
          </ul>
        </div>
      </div>
    </aside>

    <!-- 右栏：运行与结果 -->
    <div class="content-column">
      <div class="run-bar">
        <t-select v-model="runMode" size="small" style="width: 130px">
          <t-option value="hybrid" label="混合召回" />
          <t-option value="dense" label="语义召回" />
          <t-option value="sparse" label="关键字召回" />
        </t-select>
        <t-input-number v-model="runTopK" :min="1" :max="20" size="small" theme="normal" style="width: 110px">
          <template #prefix>top_k</template>
        </t-input-number>
        <t-button
          theme="primary"
          size="small"
          :loading="starting"
          :disabled="!activeLibId || !cases.length"
          @click="onStartRun"
        >
          运行评估
        </t-button>
        <div class="run-history">
          <span class="run-history-label">历史：</span>
          <t-select
            v-model="activeRunId"
            placeholder="选择一次运行"
            size="small"
            style="width: 240px"
          >
            <t-option
              v-for="r in runs"
              :key="r.id_run"
              :value="r.id_run"
              :label="`${new Date(r.created_at).toLocaleString()} · ${r.status === 'running' ? '运行中' : r.status === 'done' ? `总分 ${pct(r.summary?.total)}` : '失败'}`"
            />
          </t-select>
        </div>
      </div>

      <div v-if="!runDetail" class="content-empty">
        {{ cases.length ? '点击「运行评估」开始打分，或从历史中选择一次运行' : '先在左侧准备评估案例集' }}
      </div>

      <template v-else>
        <!-- 汇总卡片 -->
        <div class="summary-row">
          <div class="summary-card is-total">
            <span class="summary-label">综合得分</span>
            <span class="summary-value" :class="scoreCls(summary.total)">
              {{ runDetail.status === 'running' ? '运行中…' : pct(summary.total) }}
            </span>
            <span v-if="summary.case_count" class="summary-sub">
              {{ summary.case_count }} 条案例<template v-if="summary.error_count">，{{ summary.error_count }} 条异常</template>
            </span>
          </div>
          <div v-for="key in METRIC_KEYS" :key="key" class="summary-card">
            <span class="summary-label">{{ METRIC_LABELS[key] }}</span>
            <span class="summary-value" :class="scoreCls(summary.metrics?.[key])">
              {{ pct(summary.metrics?.[key]) }}
            </span>
          </div>
        </div>

        <!-- 逐案例明细 -->
        <div class="result-list">
          <div v-for="r in runDetail.results" :key="r.id_result" class="result-card">
            <div class="result-head" @click="expanded[r.id_result] = !expanded[r.id_result]">
              <span class="result-expand">{{ expanded[r.id_result] ? '▾' : '▸' }}</span>
              <span class="result-q">{{ r.question }}</span>
              <span class="result-scores">
                <span
                  v-for="key in METRIC_KEYS"
                  :key="key"
                  class="mini-score"
                  :class="scoreCls(r.scores?.[key])"
                  :title="METRIC_LABELS[key]"
                >
                  {{ METRIC_LABELS[key].slice(0, 2) }} {{ pct(r.scores?.[key]) }}
                </span>
                <span class="total-score" :class="scoreCls(r.total_score)">
                  {{ r.error_message ? '异常' : pct(r.total_score) }}
                </span>
              </span>
            </div>
            <div v-if="expanded[r.id_result]" class="result-body">
              <p v-if="r.error_message" class="result-error">评估失败：{{ r.error_message }}</p>
              <template v-else>
                <div class="kv">
                  <span class="kv-label">模型回答</span>
                  <p class="kv-text">{{ r.answer }}</p>
                </div>
                <div v-if="r.ground_truth" class="kv">
                  <span class="kv-label">参考答案</span>
                  <p class="kv-text">{{ r.ground_truth }}</p>
                </div>
                <div class="kv">
                  <span class="kv-label">召回知识（{{ r.retrieved?.length || 0 }}）</span>
                  <ul class="retrieved-list">
                    <li
                      v-for="(hit, i) in r.retrieved"
                      :key="hit.chunk_id || i"
                      class="hit-item"
                      @click="openChunk(hit)"
                    >
                      <span class="hit-rank">#{{ i + 1 }}</span>
                      <span class="hit-file">{{ hit.file_name }}</span>
                      <span class="hit-score">{{ pct(hit.score) }}</span>
                      <div class="hit-preview" v-html="getPreview(hit.content || hit.snippet).html"></div>
                      <span v-if="getPreview(hit.content || hit.snippet).hasMore" class="hit-more">
                        点击展开完整内容
                      </span>
                    </li>
                    <li v-if="!r.retrieved?.length" class="hit-empty">无召回结果</li>
                  </ul>
                </div>
              </template>
            </div>
          </div>
          <div v-if="runDetail.status === 'running' && !runDetail.results.length" class="content-empty">
            正在逐条打分（召回 → LLM 作答 → ragas 指标），请稍候…
          </div>
        </div>
      </template>
    </div>

    <!-- 知识块详情 -->
    <t-dialog
      v-model:visible="showChunkModal"
      :header="modalTitle"
      width="92vw"
      :footer="false"
      class="chunk-dialog"
    >
      <div class="chunk-modal-body md-body" v-html="modalContent"></div>
    </t-dialog>

    <!-- 添加案例 -->
    <t-dialog v-model:visible="showAddCase" header="添加评估案例" :on-confirm="onAddCase" width="520px">
      <div class="case-form">
        <t-textarea v-model="caseForm.question" placeholder="问题（必填）" :autosize="{ minRows: 2 }" />
        <t-textarea
          v-model="caseForm.ground_truth"
          placeholder="参考答案（选填，填写后可计算上下文召回率）"
          :autosize="{ minRows: 3 }"
        />
        <t-input v-model="caseForm.category" placeholder="分类（选填）" />
      </div>
    </t-dialog>

    <!-- 自动生成 -->
    <t-dialog
      v-model:visible="showGenerate"
      header="自动生成评估案例"
      :confirm-btn="{ loading: generating, content: '生成' }"
      :on-confirm="onGenerate"
      width="420px"
    >
      <p class="gen-tip">从库内分块随机采样，由 LLM 生成「问题 + 标准答案」案例。</p>
      <t-input-number v-model="generateCount" :min="1" :max="20" theme="normal" />
    </t-dialog>
  </div>
</template>

<style scoped>
.eval-panel {
  display: flex; gap: 12px; height: 100%; min-height: 0;
  padding: 14px; box-sizing: border-box;
}
.side-column { flex: 0 0 300px; display: flex; flex-direction: column; gap: 10px; min-height: 0; }
.side-section {
  display: flex; flex-direction: column; gap: 8px; min-height: 0;
  padding: 12px; border: 1px solid #e7ebf2; border-radius: 10px; background: #fff;
}
.case-section { flex: 1 1 auto; }
.side-scroll { flex: 1; min-height: 0; overflow-y: auto; }
.col-head {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 13px; font-weight: 600; color: #1d2939;
}
.case-head-op { display: flex; gap: 6px; }
.case-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.case-item {
  padding: 8px 10px; border: 1px solid #eef1f6; border-radius: 8px;
  background: #fafbfe; font-size: 12px;
}
.case-q { color: #1d2939; line-height: 1.5; word-break: break-all; }
.case-meta { display: flex; align-items: center; gap: 6px; margin-top: 5px; }
.case-badge { font-size: 10px; padding: 1px 6px; border-radius: 8px; }
.case-badge.is-auto { background: #e0f5ec; color: #0a7d53; }
.case-badge.is-manual { background: #e0eaff; color: #0052d9; }
.case-cat { font-size: 10px; color: #98a2b3; }
.case-del { margin-left: auto; color: #c0c6d4; cursor: pointer; font-size: 14px; }
.case-del:hover { color: #d92d20; }
.case-empty { font-size: 12px; color: #c0c6d4; padding: 6px 2px; }

.content-column {
  flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 10px;
  padding: 12px; border: 1px solid #e7ebf2; border-radius: 10px; background: #fff;
  overflow-y: auto;
}
.run-bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.run-history { display: flex; align-items: center; gap: 6px; margin-left: auto; }
.run-history-label { font-size: 12px; color: #98a2b3; }
.content-empty {
  flex: 1; display: flex; align-items: center; justify-content: center;
  color: #98a2b3; font-size: 13px; min-height: 120px;
}

.summary-row { display: flex; gap: 8px; flex-wrap: wrap; }
.summary-card {
  flex: 1 1 120px; display: flex; flex-direction: column; gap: 2px;
  padding: 10px 12px; border: 1px solid #eef1f6; border-radius: 9px; background: #fafbfe;
}
.summary-card.is-total { background: #f0f5ff; border-color: #d6e2ff; }
.summary-label { font-size: 11px; color: #98a2b3; }
.summary-value { font-size: 20px; font-weight: 700; }
.summary-sub { font-size: 10px; color: #98a2b3; }

.is-good { color: #0a7d53; }
.is-mid { color: #d97706; }
.is-bad { color: #d92d20; }
.is-na { color: #c0c6d4; }

.result-list { display: flex; flex-direction: column; gap: 6px; }
.result-card { border: 1px solid #eef1f6; border-radius: 8px; background: #fff; }
.result-head {
  display: flex; align-items: center; gap: 8px; padding: 9px 10px; cursor: pointer;
  font-size: 13px;
}
.result-head:hover { background: #f8faff; }
.result-expand { color: #98a2b3; font-size: 11px; flex: 0 0 12px; }
.result-q { flex: 1; min-width: 0; color: #1d2939; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.result-scores { display: flex; align-items: center; gap: 6px; flex: 0 0 auto; }
.mini-score {
  font-size: 10px; padding: 1px 6px; border-radius: 8px; background: #f6f8fc; color: #667085;
}
.total-score { font-size: 12px; font-weight: 700; padding: 1px 8px; border-radius: 8px; background: #f6f8fc; }
.result-body {
  padding: 10px 12px 12px 30px; border-top: 1px dashed #eef1f6;
  display: flex; flex-direction: column; gap: 8px; font-size: 12px;
}
.result-error { color: #d92d20; }
.kv { display: flex; flex-direction: column; gap: 3px; }
.kv-label { font-size: 11px; color: #98a2b3; }
.kv-text { margin: 0; color: #344054; line-height: 1.6; white-space: pre-wrap; }
.retrieved-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.retrieved-list li { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px; padding: 6px 8px; background: #fafbfe; border-radius: 6px; }
.hit-rank { font-size: 11px; color: #2f5bff; font-weight: 600; }
.hit-file { font-size: 11px; color: #344054; }
.hit-score { font-size: 10px; color: #98a2b3; }
.hit-snippet { flex-basis: 100%; margin: 2px 0 0; color: #667085; line-height: 1.5; }
.hit-item {
  cursor: pointer; transition: background 0.15s;
}
.hit-item:hover { background: #f0f4ff !important; }
.hit-preview {
  flex-basis: 100%; margin: 2px 0 0; color: #667085; line-height: 1.5;
  font-size: 12px; overflow: hidden; max-height: 240px;
}
.hit-preview :deep(table) {
  border-collapse: collapse; font-size: 11px; margin: 4px 0;
}
.hit-preview :deep(th), .hit-preview :deep(td) {
  border: 1px solid #e7ebf2; padding: 3px 6px;
}
.hit-preview :deep(th) { background: #f6f8fc; font-weight: 600; }
.hit-preview :deep(p) { margin: 2px 0; }
.hit-more {
  flex-basis: 100%; font-size: 11px; color: #2f5bff; margin-top: 2px;
}
.chunk-modal-body {
  max-height: 75vh; overflow: auto; font-size: 13px; line-height: 1.6;
}
.md-body :deep(table) {
  border-collapse: collapse; margin: 8px 0; font-size: 12px;
  white-space: nowrap;
}
.md-body :deep(th), .md-body :deep(td) {
  border: 1px solid #e7ebf2; padding: 6px 10px; text-align: left;
}
.md-body :deep(th) { background: #f6f8fc; font-weight: 600; white-space: nowrap; }
.md-body :deep(p) { margin: 6px 0; }
.md-body :deep(h1), .md-body :deep(h2), .md-body :deep(h3) { margin: 12px 0 6px; }
.hit-empty { font-size: 11px; color: #c0c6d4; }
.case-form { display: flex; flex-direction: column; gap: 10px; padding: 4px 0; }
.gen-tip { margin: 0 0 10px; font-size: 12px; color: #667085; }
</style>
