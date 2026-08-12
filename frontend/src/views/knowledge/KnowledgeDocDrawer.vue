<script setup lang="ts">
/** 文档切片抽屉（原文 ↔ 切片对照）：左=原文件(pdf.js 逐页+框选高亮)，右=切片列表。
 *  切片卡片 = 蓝色摘要前缀 + 完整 Markdown 渲染正文。
 *  点击切片 → 原文翻页并按 bbox 框选对应区域。 */
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { MessagePlugin } from 'tdesign-vue-next';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { KnowledgeChunk, KnowledgeDocument } from './api';
import { docAssetUrl, docFileUrl, fetchDocument, listChunks, retryDocument } from './api';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

interface ContentItem {
  bbox?: number[];
  page_idx?: number;
  plain: string;
}
interface OverlayBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

const props = defineProps<{ doc: KnowledgeDocument | null }>();
const visible = defineModel<boolean>('visible', { default: false });

const chunks = ref<KnowledgeChunk[]>([]);
const contentItems = ref<ContentItem[]>([]);
const loading = ref(false);
const activeChunk = ref(-1);

// ── 原文件 pdf（shallowRef：避免 reactive Proxy 破坏私有字段 brand 检查）──
const pdfDoc = shallowRef<PDFDocumentProxy | null>(null);
let loadingTask: PDFDocumentLoadingTask | null = null;
const pageNum = ref(1);
const pageCount = ref(0);
const zoom = ref(1.1);
const canvasRef = ref<HTMLCanvasElement>();
const overlayBoxes = ref<OverlayBox[]>([]);
const pdfError = ref('');
const activeBoxesRaw = ref<{ page: number; bbox: number[] }[]>([]);
let lastViewport: { width: number; height: number } | null = null;
let renderTask: { cancel: () => void; promise: Promise<unknown> } | null = null;

/** 切片内容拆分：摘要前缀（蓝色高亮）+ 切片正文。 */
function splitSummary(content: string): { summary: string; body: string } {
  if (content.startsWith('【文档摘要】')) {
    const idx = content.indexOf('\n\n');
    if (idx > 0) return { summary: content.slice(0, idx), body: content.slice(idx + 2) };
  }
  return { summary: '', body: content };
}

const chunkViews = computed(() =>
  chunks.value.map((c) => splitSummary(c.content))
);

// ── 切片搜索：按关键字过滤（找表格可搜表头文字或 table）──
const searchKey = ref('');
const displayList = computed(() => {
  const key = searchKey.value.trim().toLowerCase();
  return chunks.value
    .map((c, i) => ({ cv: chunkViews.value[i], idx: i, raw: c.content }))
    .filter((x) => !key || x.raw.toLowerCase().includes(key));
});

// ── md 文本 → 纯文本（去符号，供匹配）──
function plainify(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/```+/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#*|>`_~\-]+/g, ' ')
    .replace(/\s+/g, '');
}

function renderBlock(text: string): string {
  const docId = props.doc?.id_document || '';
  const rewritten = text.replace(
    /\]\(images\//g,
    `](${docAssetUrl(docId, 'images/')}`
  );
  return DOMPurify.sanitize(marked.parse(rewritten) as string);
}

// ── 文本重叠度：a 的 24 字滑窗在 b 中的命中率 ──
function overlapScore(a: string, b: string): number {
  if (!a || !b) return 0;
  const win = 24;
  let hits = 0;
  let total = 0;
  for (let i = 0; i + win <= a.length; i += win) {
    total++;
    if (b.includes(a.slice(i, i + win))) hits++;
  }
  return total ? hits / total : 0;
}

// ── 原文定位：纯文本 → content_list 命中块（bbox + page_idx）──
function locateItems(plain: string): { page: number; bbox: number[] }[] {
  const out: { page: number; bbox: number[] }[] = [];
  for (const item of contentItems.value) {
    if (!item.bbox || item.page_idx === undefined || !item.plain) continue;
    // 双向取大：小文本块被切片包含 / 切片是大表格的一部分
    if (
      Math.max(overlapScore(item.plain, plain), overlapScore(plain, item.plain)) >
      0.6
    ) {
      out.push({ page: item.page_idx, bbox: item.bbox });
    }
  }
  return out;
}

function drawOverlay() {
  if (!lastViewport) return;
  overlayBoxes.value = activeBoxesRaw.value
    .filter((b) => b.page === pageNum.value - 1)
    .map((b) => ({
      left: (b.bbox[0] / 1000) * lastViewport!.width,
      top: (b.bbox[1] / 1000) * lastViewport!.height,
      width: ((b.bbox[2] - b.bbox[0]) / 1000) * lastViewport!.width,
      height: ((b.bbox[3] - b.bbox[1]) / 1000) * lastViewport!.height,
    }));
}

async function renderPage() {
  const doc = pdfDoc.value;
  const canvas = canvasRef.value;
  if (!doc || !canvas) return;
  try {
    const page = await doc.getPage(pageNum.value);
    const viewport = page.getViewport({ scale: zoom.value });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    lastViewport = { width: viewport.width, height: viewport.height };
    renderTask?.cancel();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const task = page.render({ canvasContext: ctx, viewport });
    renderTask = task as any;
    await task.promise;
    drawOverlay();
  } catch (e) {
    /* render 被 cancel 时忽略，其余报错打日志 */
    console.error('[pdf render] ' + String((e as any)?.name || '') + ': ' + String((e as any)?.message || e));
  }
}

async function focusPdf(plain: string) {
  if (!pdfDoc.value) return;
  const boxes = locateItems(plain);
  activeBoxesRaw.value = boxes;
  if (boxes.length && boxes[0].page + 1 !== pageNum.value) {
    pageNum.value = boxes[0].page + 1;
    await renderPage();
  } else {
    drawOverlay();
  }
}

function onPrevPage() {
  if (pageNum.value > 1) {
    pageNum.value--;
    renderPage();
  }
}
function onNextPage() {
  if (pageNum.value < pageCount.value) {
    pageNum.value++;
    renderPage();
  }
}
function onZoom(delta: number) {
  zoom.value = Math.min(3, Math.max(0.6, Math.round((zoom.value + delta) * 10) / 10));
  renderPage();
}

function onChunkClick(i: number) {
  activeChunk.value = i;
  focusPdf(plainify(chunkViews.value[i].body).slice(0, 800));
}

// ── 重切：表格切不切开关（不切=整块保留可超块长；切=按行切重复表头）──
const splitTables = ref<'keep' | 'split'>('keep');
const rechunking = ref(false);
const TABLE_MODES = [
  { label: '表格：整块保留（可超块长）', value: 'keep' },
  { label: '表格：按行切·重复表头', value: 'split' }
];

async function onRechunk() {
  const doc = props.doc;
  if (!doc || rechunking.value) return;
  rechunking.value = true;
  try {
    await retryDocument(doc.id_document, {
      split_tables: splitTables.value === 'split',
      rechunk: true // 复用已解析的 parsed.md，跳过 MinerU 重解析
    });
    for (let i = 0; i < 240; i++) {
      await new Promise((r) => setTimeout(r, 2500));
      const d = await fetchDocument(doc.id_document);
      if (d.parse_status === 'done') break;
      if (d.parse_status === 'error') throw new Error(d.error_message || '重切失败');
    }
    chunks.value = await listChunks(doc.id_document);
    activeChunk.value = -1;
    overlayBoxes.value = [];
    MessagePlugin.success(`重切完成，共 ${chunks.value.length} 片`);
  } catch (e: any) {
    MessagePlugin.error(e?.message || '重切失败');
  } finally {
    rechunking.value = false;
  }
}

async function loadPdf(doc: KnowledgeDocument) {
  pdfError.value = '';
  try {
    const resp = await fetch(docFileUrl(doc.id_document));
    if (!resp.ok) throw new Error(String(resp.status));
    const data = await resp.arrayBuffer();
    loadingTask?.destroy();
    loadingTask = pdfjsLib.getDocument({
      data,
      cMapUrl: '/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: '/standard_fonts/',
    });
    pdfDoc.value = await loadingTask.promise;
    pageCount.value = pdfDoc.value.numPages;
    pageNum.value = 1;
    await nextTick();
    await renderPage();
  } catch (e) {
    console.error('[pdf load] ' + String((e as any)?.name || '') + ': ' + String((e as any)?.message || e));
    pdfError.value = '原文加载失败';
  }
}

watch(
  () => props.doc,
  async (doc) => {
    loadingTask?.destroy();
    loadingTask = null;
    pdfDoc.value = null;
    pageCount.value = 0;
    overlayBoxes.value = [];
    activeBoxesRaw.value = [];
    lastViewport = null;
    if (!doc) return;
    splitTables.value = doc.metadata?.chunking_config?.split_tables ? 'split' : 'keep';
    loading.value = true;
    chunks.value = [];
    contentItems.value = [];
    activeChunk.value = -1;
    try {
      chunks.value = await listChunks(doc.id_document);
    } catch {
      chunks.value = [];
    }
    try {
      const resp = await fetch(docAssetUrl(doc.id_document, 'content_list.json'));
      if (resp.ok) {
        const arr = (await resp.json()) as any[];
        contentItems.value = arr
          .map((it) => ({
            bbox: it.bbox,
            page_idx: it.page_idx,
            plain: plainify(String(it.text || it.table_body || '')),
          }))
          .filter((it) => it.plain.length > 8);
      }
    } catch {
      contentItems.value = [];
    }
    if (doc.file_type === 'pdf') await loadPdf(doc);
    loading.value = false;
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  loadingTask?.destroy();
});
</script>

<template>
  <t-drawer
    v-model:visible="visible"
    :header="doc?.file_name || '文档切片'"
    size="90%"
    :footer="false"
  >
    <div class="drawer-body">
      <!-- 左：原文件 -->
      <div class="source-pane">
        <div class="pane-head source-bar">
          <span>原文件</span>
          <span v-if="pdfDoc" class="pdf-tools">
            <t-button size="small" variant="text" :disabled="pageNum <= 1" @click="onPrevPage">◀</t-button>
            <span class="page-no">{{ pageNum }} / {{ pageCount }}</span>
            <t-button size="small" variant="text" :disabled="pageNum >= pageCount" @click="onNextPage">▶</t-button>
            <t-button size="small" variant="text" @click="onZoom(-0.2)">−</t-button>
            <span class="page-no">{{ Math.round(zoom * 100) }}%</span>
            <t-button size="small" variant="text" @click="onZoom(0.2)">＋</t-button>
          </span>
        </div>
        <div v-if="doc?.file_type === 'pdf'" class="pdf-scroll">
          <div v-if="pdfError" class="empty">{{ pdfError }}</div>
          <div v-show="!pdfError" class="pdf-wrap">
            <canvas ref="canvasRef" class="pdf-canvas" />
            <div
              v-for="(b, k) in overlayBoxes"
              :key="k"
              class="overlay-box"
              :style="{
                left: `${b.left}px`,
                top: `${b.top}px`,
                width: `${b.width}px`,
                height: `${b.height}px`
              }"
            />
          </div>
        </div>
        <div v-else class="empty">
          {{ doc?.file_type }} 原文暂不支持浏览器内预览，
          <br />
          右侧为切片内容。
        </div>
      </div>

      <!-- 右：切片（蓝色摘要 + 完整 Markdown 正文） -->
      <div class="chunk-pane">
        <div class="pane-head">
          <span>
            切片
            {{ searchKey.trim() ? `${displayList.length}/${chunks.length}` : chunks.length || '' }}
          </span>
          <span class="chunk-tools">
            <t-input
              v-model="searchKey"
              size="small"
              placeholder="搜索切片"
              clearable
              style="width: 150px"
            />
            <t-select
              v-model="splitTables"
              size="small"
              style="width: 190px"
              :options="TABLE_MODES"
              :disabled="rechunking"
            />
            <t-button
              size="small"
              variant="outline"
              :loading="rechunking"
              @click="onRechunk"
            >
              重新切分
            </t-button>
          </span>
        </div>
        <div v-if="loading" class="empty">加载中…</div>
        <div v-else class="chunk-list">
          <div
            v-for="item in displayList"
            :key="item.idx"
            class="chunk-card"
            :class="{ active: item.idx === activeChunk }"
            @click="onChunkClick(item.idx)"
          >
            <span class="chunk-idx">#{{ item.idx + 1 }}</span>
            <p v-if="item.cv.summary" class="chunk-summary">{{ item.cv.summary }}</p>
            <div class="chunk-md" v-html="renderBlock(item.cv.body)" />
          </div>
          <div v-if="!displayList.length" class="empty">
            {{ chunks.length ? '无匹配切片' : '暂无切片' }}
          </div>
        </div>
      </div>
    </div>
  </t-drawer>
</template>

<style scoped>
.drawer-body {
  display: flex;
  gap: 12px;
  height: 100%;
  min-height: 0;
}
.pane-head {
  font-size: 13px;
  font-weight: 600;
  color: #1d2939;
  padding-bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.source-pane {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-right: 1px solid #e7ebf2;
  padding-right: 12px;
}
.pdf-tools {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.page-no {
  font-size: 12px;
  color: #667085;
  min-width: 44px;
  text-align: center;
}
.pdf-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  background: #f2f4f7;
  border-radius: 8px;
  padding: 10px;
}
.pdf-wrap {
  position: relative;
  width: max-content;
  margin: 0 auto;
}
.pdf-canvas {
  display: block;
  background: #fff;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.12);
}
.overlay-box {
  position: absolute;
  border: 2px solid #ed7b2f;
  background: rgba(237, 123, 47, 0.12);
  border-radius: 3px;
  pointer-events: none;
}
.chunk-pane {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.chunk-tools {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: normal;
}
.chunk-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-bottom: 8px;
}
.chunk-card {
  border: 1px solid #e7ebf2;
  border-radius: 8px;
  padding: 10px 12px;
  cursor: pointer;
  background: #fff;
}
.chunk-card:hover {
  border-color: #0052d9;
}
.chunk-card.active {
  border-color: #ed7b2f;
  background: #fff7f0;
  box-shadow: 0 0 0 2px rgba(237, 123, 47, 0.2);
}
.chunk-idx {
  font-size: 12px;
  color: #0052d9;
  font-weight: 600;
}
.chunk-summary {
  margin: 6px 0 0;
  padding: 6px 10px;
  border-radius: 6px;
  background: #e8f1ff;
  color: #0052d9;
  font-size: 12px;
  line-height: 1.7;
}
.chunk-md {
  margin-top: 8px;
}
.chunk-md :deep(table) {
  border-collapse: collapse;
  margin: 6px 0;
  font-size: 12px;
  width: 100%;
}
.chunk-md :deep(td),
.chunk-md :deep(th) {
  border: 1px solid #d9dee7;
  padding: 4px 8px;
}
.chunk-md :deep(img) {
  max-width: 100%;
}
.chunk-md :deep(h1),
.chunk-md :deep(h2),
.chunk-md :deep(h3) {
  margin: 8px 0 4px;
  font-size: 14px;
}
.chunk-md :deep(p) {
  margin: 4px 0;
  line-height: 1.7;
  font-size: 13px;
}
.empty {
  color: #999;
  text-align: center;
  padding: 40px 0;
  font-size: 13px;
}
</style>
