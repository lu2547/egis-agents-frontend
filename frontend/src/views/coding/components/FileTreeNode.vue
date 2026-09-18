<script setup lang="ts">
/** 文件树递归节点 — 展开态/选中态经 provide/inject 与 FileExplorer 通信。 */
import { inject } from 'vue';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FileIcon,
  FolderIcon,
  FolderOpenIcon
} from 'tdesign-icons-vue-next';
import type { FileNode } from '../types';

defineProps<{
  node: FileNode;
  depth?: number;
}>();

const explorer = inject<{
  isExpanded: (path: string) => boolean;
  toggleDir: (node: FileNode) => void;
  openFile: (node: FileNode) => void;
  selected: string;
}>('explorerApi');

const formatSize = (bytes?: number) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};
</script>

<template>
  <div class="tree-branch">
    <button
      v-if="node.type === 'dir'"
      type="button"
      class="tree-row"
      :style="{ paddingLeft: `${(depth ?? 0) * 14 + 8}px` }"
      @click="explorer?.toggleDir(node)"
    >
      <span
        v-for="i in (depth ?? 0)"
        :key="i"
        class="indent-guide"
        :style="{ left: `${(i - 1) * 14 + 8}px` }"
      ></span>
      <component
        :is="explorer?.isExpanded(node.path) ? ChevronDownIcon : ChevronRightIcon"
        class="chev"
      />
      <component
        :is="explorer?.isExpanded(node.path) ? FolderOpenIcon : FolderIcon"
        class="icon dir-icon"
      />
      <span class="name">{{ node.name }}</span>
    </button>

    <button
      v-else
      type="button"
      class="tree-row"
      :class="{ active: explorer?.selected === node.path }"
      :style="{ paddingLeft: `${(depth ?? 0) * 14 + 8}px` }"
      @click="explorer?.openFile(node)"
    >
      <span
        v-for="i in (depth ?? 0)"
        :key="i"
        class="indent-guide"
        :style="{ left: `${(i - 1) * 14 + 8}px` }"
      ></span>
      <span class="chev spacer"></span>
      <FileIcon class="icon file-icon" />
      <span class="name">{{ node.name }}</span>
      <span class="size">{{ formatSize(node.size) }}</span>
    </button>

    <div v-if="node.type === 'dir' && explorer?.isExpanded(node.path)" class="tree-children">
      <FileTreeNode
        v-for="child in node.children || []"
        :key="child.path"
        :node="child"
        :depth="(depth ?? 0) + 1"
      />
    </div>
  </div>
</template>

<style scoped>
.tree-branch {
  display: flex;
  flex-direction: column;
}

.tree-row {
  height: 28px;
  padding-right: 6px;
  border: 0;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 5px;
  color: #344054;
  background: transparent;
  font-size: 12.5px;
  text-align: left;
  flex: 0 0 auto;
  position: relative;
}

/* 层级缩进参考线：每级一根竖线，父子归属一眼分明 */
.indent-guide {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: #e3e8f2;
  pointer-events: none;
}

.tree-row:hover {
  background: #eef2fb;
}

.tree-row.active {
  color: #2f62f6;
  background: #e7efff;
  font-weight: 700;
}

.chev {
  width: 12px;
  height: 12px;
  color: #98a2b3;
  flex: 0 0 auto;
}

.chev.spacer {
  visibility: hidden;
}

.icon {
  width: 14px;
  height: 14px;
  flex: 0 0 auto;
}

.dir-icon {
  color: #b26300;
}

.file-icon {
  color: #98a2b3;
}

.tree-row.active .file-icon {
  color: #2f62f6;
}

.name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.size {
  color: #b6bfcc;
  font-size: 10.5px;
  flex: 0 0 auto;
}

.tree-children {
  display: flex;
  flex-direction: column;
}
</style>
