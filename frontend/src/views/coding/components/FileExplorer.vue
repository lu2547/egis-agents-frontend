<script setup lang="ts">
/** 工作目录文件浏览器 — 树（懒加载）+ 文件预览（markdown 渲染 / 纯文本）。 */
import { computed, onMounted, provide, reactive, ref, watch } from 'vue';
import {
  ArrowLeftIcon,
  CloseIcon,
  ErrorCircleIcon,
  FileIcon,
  LoadingIcon,
  RefreshIcon
} from 'tdesign-icons-vue-next';
import { listWorkspaceTree, readWorkspaceFile } from '../api';
import { renderMarkdown } from '../../chat/markdown';
import { bindingDisplayPath, CODING_USER_ID } from '../constants';
import type { FileContentResponse, FileNode } from '../types';
import FileTreeNode from './FileTreeNode.vue';

const props = defineProps<{
  /** 工作目录绑定串："" = 多租户沙箱；"local:<绝对路径>" = 本地锁定 */
  workspaceRoot: string;
  /** 变化时刷新树（run 结束/文件系统被 agent 改动后同步） */
  refreshToken: number;
}>();

const emit = defineEmits<{ (e: 'close'): void }>();

const tree = ref<FileNode[]>([]);
const loading = ref(false);
const treeError = ref('');
const truncated = ref(false);
const expanded = ref<Set<string>>(new Set());

const view = ref<'tree' | 'file'>('tree');
const selectedPath = ref('');
const fileContent = ref<FileContentResponse | null>(null);
const fileLoading = ref(false);
const fileError = ref('');

const displayName = computed(
  () => bindingDisplayPath(props.workspaceRoot) || '沙箱工作区'
);

const isMarkdown = (path: string) => /\.(md|markdown)$/i.test(path);

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/** 拆 markdown 开头的 YAML frontmatter（wiki 页必有）：
 * 元数据不再裸渲染成正文（--- 分隔线 + 字段行），折叠为紧凑块。 */
const previewParts = computed(() => {
  const content = fileContent.value;
  if (!content || !isMarkdown(selectedPath.value)) return null;
  const match = content.content.match(FRONTMATTER_RE);
  if (!match) return { meta: null as Array<[string, string]> | null, body: content.content };
  const meta: Array<[string, string]> = [];
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) meta.push([line.slice(0, idx).trim(), line.slice(idx + 1).trim()]);
  }
  return { meta, body: content.content.slice(match[0].length) };
});

const loadRoot = async () => {
  loading.value = true;
  treeError.value = '';
  try {
    const result = await listWorkspaceTree(
      CODING_USER_ID, props.workspaceRoot, '', 2
    );
    tree.value = result.nodes;
    truncated.value = result.truncated;
  } catch (err: any) {
    treeError.value = err?.message || '目录加载失败';
    tree.value = [];
  } finally {
    loading.value = false;
  }
};

/** 展开/收起目录；首次展开懒加载单层。 */
const toggleDir = async (node: FileNode) => {
  const next = new Set(expanded.value);
  if (next.has(node.path)) {
    next.delete(node.path);
    expanded.value = next;
    return;
  }
  if (!node.children) {
    try {
      const result = await listWorkspaceTree(
        CODING_USER_ID, props.workspaceRoot, node.path, 1
      );
      node.children = result.nodes;
    } catch {
      node.children = [];
    }
  }
  next.add(node.path);
  expanded.value = next;
};

/** 打开文件预览。文件不存在（agent 改动过文件系统）时自动刷新树并提示。 */
const openFile = async (node: FileNode) => {
  selectedPath.value = node.path;
  view.value = 'file';
  fileLoading.value = true;
  fileError.value = '';
  fileContent.value = null;
  try {
    fileContent.value = await readWorkspaceFile(
      CODING_USER_ID, props.workspaceRoot, node.path
    );
  } catch (err: any) {
    const message = err?.message || '文件读取失败';
    if (/不存在/.test(message)) {
      // 树是旧快照（agent 移动/删除了文件）：自动刷新并告知
      fileError.value = `${node.path} 已不存在（文件可能被 agent 移动或删除），目录已刷新`;
      refreshTree();
    } else {
      fileError.value = message;
    }
  } finally {
    fileLoading.value = false;
  }
};

/** 递归找节点（刷新时定位已展开目录）。 */
const findNode = (nodes: FileNode[], path: string): FileNode | null => {
  for (const node of nodes) {
    if (node.path === path) return node;
    if (node.children) {
      const hit = findNode(node.children, path);
      if (hit) return hit;
    }
  }
  return null;
};

/**
 * 刷新树并保持展开/选中态：重载根层后，把原本展开的目录逐个重新
 * 懒加载（agent 改动文件系统后，旧快照里的路径可能已失效，跳过）。
 */
const refreshTree = async () => {
  const keepExpanded = new Set(expanded.value);
  const keepSelected = selectedPath.value;
  loading.value = true;
  treeError.value = '';
  try {
    const result = await listWorkspaceTree(
      CODING_USER_ID, props.workspaceRoot, '', 2
    );
    tree.value = result.nodes;
    truncated.value = result.truncated;
    for (const path of keepExpanded) {
      const node = findNode(result.nodes, path);
      if (!node) {
        keepExpanded.delete(path);
        continue;
      }
      try {
        const sub = await listWorkspaceTree(
          CODING_USER_ID, props.workspaceRoot, path, 1
        );
        node.children = sub.nodes;
      } catch {
        keepExpanded.delete(path);
      }
    }
    expanded.value = keepExpanded;
    selectedPath.value = findNode(result.nodes, keepSelected) ? keepSelected : '';
  } catch (err: any) {
    treeError.value = err?.message || '目录加载失败';
    tree.value = [];
  } finally {
    loading.value = false;
  }
};

const backToTree = () => {
  view.value = 'tree';
};

/* 递归节点通信（FileTreeNode inject） */
provide(
  'explorerApi',
  reactive({
    isExpanded: (path: string) => expanded.value.has(path),
    toggleDir,
    openFile,
    get selected() {
      return selectedPath.value;
    }
  })
);

onMounted(loadRoot);

// 切换工作目录（绑定/解绑/切会话）：重置状态重载
watch(
  () => props.workspaceRoot,
  () => {
    expanded.value = new Set();
    selectedPath.value = '';
    fileContent.value = null;
    fileError.value = '';
    view.value = 'tree';
    loadRoot();
  }
);

// run 结束信号（refreshToken 变化）：树同步刷新（agent 可能改动过文件系统）
watch(
  () => props.refreshToken,
  (token) => {
    if (token > 0) refreshTree();
  }
);
</script>

<template>
  <aside class="file-explorer">
    <header class="explorer-head">
      <template v-if="view === 'file'">
        <button type="button" class="head-button" title="返回目录树" @click="backToTree">
          <ArrowLeftIcon />
        </button>
        <span class="head-title" :title="selectedPath">{{ selectedPath }}</span>
      </template>
      <template v-else>
        <span class="head-title" :title="displayName">{{ displayName }}</span>
        <button
          type="button"
          class="head-button"
          title="刷新"
          :disabled="loading"
          @click="loadRoot"
        >
          <RefreshIcon :class="{ spin: loading }" />
        </button>
      </template>
      <button type="button" class="head-button" title="关闭面板" @click="emit('close')">
        <CloseIcon />
      </button>
    </header>

    <!-- 目录树 -->
    <div v-if="view === 'tree'" class="tree-body">
      <div v-if="loading" class="tree-state"><LoadingIcon class="spin" /> 加载中…</div>
      <div v-else-if="treeError" class="tree-state error">
        <ErrorCircleIcon />
        {{ treeError }}
      </div>
      <div v-else-if="!tree.length" class="tree-state">空目录</div>
      <template v-else>
        <FileTreeNode v-for="node in tree" :key="node.path" :node="node" />
        <p v-if="truncated" class="tree-truncated">目录过大，仅显示部分内容</p>
      </template>
    </div>

    <!-- 文件预览 -->
    <div v-else class="file-body">
      <div v-if="fileLoading" class="tree-state"><LoadingIcon class="spin" /> 读取中…</div>
      <div v-else-if="fileError" class="tree-state error">
        <ErrorCircleIcon />
        {{ fileError }}
      </div>
      <template v-else-if="fileContent">
        <div v-if="fileContent.binary" class="binary-state">
          <FileIcon />
          <strong>二进制文件，不支持在线预览</strong>
          <span>{{ formatSize(fileContent.size) }} · 可在对话里让 agent 读取或转换</span>
        </div>
        <template v-else>
          <p v-if="fileContent.truncated" class="file-truncated">
            文件 {{ fileContent.size }} 字节，仅预览前 200KB
          </p>
          <template v-if="isMarkdown(selectedPath) && previewParts">
            <!-- frontmatter 折叠元数据块（wiki 页 title/type/tags 等） -->
            <details v-if="previewParts.meta?.length" class="frontmatter">
              <summary>页面元数据</summary>
              <dl>
                <template v-for="[key, value] in previewParts.meta" :key="key">
                  <dt>{{ key }}</dt>
                  <dd>{{ value }}</dd>
                </template>
              </dl>
            </details>
            <div class="file-markdown" v-html="renderMarkdown(previewParts.body)"></div>
          </template>
          <pre v-else class="file-plain">{{ fileContent.content }}</pre>
        </template>
      </template>
    </div>
  </aside>
</template>

<style scoped>
.file-explorer {
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  overflow: hidden;
}

.explorer-head {
  height: 42px;
  padding: 0 8px 0 12px;
  border-bottom: 1px solid #e7ebf2;
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
}

.head-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: #1f2433;
  font-size: 12.5px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.head-button {
  width: 26px;
  height: 26px;
  border: 0;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #667085;
  background: transparent;
  flex: 0 0 auto;
}

.head-button:hover {
  color: #2f62f6;
  background: #eef2fb;
}

.head-button:disabled {
  opacity: 0.5;
}

.head-button svg {
  width: 14px;
  height: 14px;
}

.tree-body,
.file-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 6px;
}

.tree-state {
  padding: 14px 8px;
  display: flex;
  align-items: center;
  gap: 7px;
  color: #98a2b3;
  font-size: 12px;
}

.tree-state.error {
  color: #b42318;
}

.tree-state svg {
  width: 14px;
  height: 14px;
  flex: 0 0 auto;
}

.tree-truncated {
  margin: 8px 8px 0;
  color: #b26300;
  background: #fff1d7;
  border-radius: 6px;
  padding: 5px 8px;
  font-size: 11px;
}

.file-truncated {
  margin: 0 4px 8px;
  color: #b26300;
  background: #fff1d7;
  border-radius: 6px;
  padding: 5px 8px;
  font-size: 11px;
}

/* 二进制占位：docx/图片等不可预览文件的友好提示卡 */
.binary-state {
  margin: 24px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 26px 12px;
  border: 1px dashed #d5dcf5;
  border-radius: 10px;
  color: #667085;
  text-align: center;
}

.binary-state svg {
  width: 28px;
  height: 28px;
  color: #98a2b3;
}

.binary-state strong {
  color: #344054;
  font-size: 13px;
}

.binary-state span {
  font-size: 11.5px;
}

/* markdown 预览（对齐 CodingView 正文风格，缩窄间距） */
/* frontmatter 折叠块：默认收起，展开后小字键值对 */
.frontmatter {
  margin: 0 4px 10px;
  border: 1px solid #e7ebf2;
  border-radius: 8px;
  font-size: 11.5px;
  color: #667085;
}

.frontmatter summary {
  padding: 5px 10px;
  cursor: pointer;
  user-select: none;
  color: #344054;
  font-weight: 600;
}

.frontmatter summary:hover {
  color: #2f62f6;
}

.frontmatter dl {
  margin: 0;
  padding: 4px 10px 8px;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 3px 10px;
}

.frontmatter dt {
  color: #98a2b3;
  white-space: nowrap;
}

.frontmatter dd {
  margin: 0;
  word-break: break-all;
}

.file-markdown {
  padding: 2px 8px;
  color: #1f2433;
  font-size: 12.5px;
  line-height: 1.7;
  word-break: break-word;
}

.file-markdown :deep(p) {
  margin: 0 0 6px;
}

.file-markdown :deep(h1),
.file-markdown :deep(h2),
.file-markdown :deep(h3) {
  margin: 12px 0 6px;
}

.file-markdown :deep(pre) {
  margin: 6px 0;
  padding: 8px 10px;
  border-radius: 6px;
  overflow-x: auto;
  background: #0f1b3d;
  color: #dce4ff;
  font-size: 11.5px;
  line-height: 1.55;
}

.file-markdown :deep(code) {
  font-family: "SFMono-Regular", Consolas, monospace;
}

.file-markdown :deep(:not(pre) > code) {
  padding: 1px 4px;
  border-radius: 4px;
  color: #b26300;
  background: #fff1d7;
  font-size: 11.5px;
}

.file-markdown :deep(a) {
  color: #2f62f6;
}

.file-markdown :deep(ul),
.file-markdown :deep(ol) {
  margin: 0 0 6px;
  padding-left: 20px;
}

.file-markdown :deep(blockquote) {
  margin: 6px 0;
  padding: 2px 10px;
  border-left: 3px solid #d5dcf5;
  color: #667085;
}

.file-markdown :deep(table) {
  border-collapse: collapse;
  font-size: 11.5px;
}

.file-markdown :deep(th),
.file-markdown :deep(td) {
  border: 1px solid #e7ebf2;
  padding: 3px 7px;
}

.file-plain {
  margin: 0;
  padding: 2px 8px;
  color: #1f2433;
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: 11.5px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

svg.spin {
  animation: explorer-spin 1s linear infinite;
}

@keyframes explorer-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
