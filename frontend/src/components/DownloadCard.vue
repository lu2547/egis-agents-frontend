<script setup lang="ts">
import { DownloadIcon, FileIcon } from 'tdesign-icons-vue-next';

defineProps<{
  fileName: string;
  fileSize?: string;
  downloadUrl: string;
  fileType?: string;
}>();

const formatSize = (size?: string) => {
  if (!size) return '';
  return size;
};
</script>

<template>
  <div class="download-card">
    <div class="download-body">
      <div class="file-icon" :class="fileType || 'default'">
        <FileIcon />
      </div>
      <div class="file-info">
        <strong>{{ fileName }}</strong>
        <em v-if="fileSize">{{ formatSize(fileSize) }}</em>
      </div>
    </div>
    <a class="download-button" :href="downloadUrl" :download="fileName" target="_blank" rel="noopener noreferrer">
      <DownloadIcon />
      下载文件
    </a>
  </div>
</template>

<style scoped>
.download-card {
  padding: 16px;
  border-radius: 10px;
  background: #ffffff;
  border: 1px solid #e4e9f2;
  box-shadow: 0 6px 16px rgba(20, 34, 70, 0.05);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.download-body {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.file-icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
}

.file-icon.ppt,
.file-icon.pptx {
  background: linear-gradient(135deg, #ff9b40, #ff5c86);
  color: #ffffff;
}

.file-icon.doc,
.file-icon.docx,
.file-icon.word {
  background: linear-gradient(135deg, #2b7d4f, #40aa68);
  color: #ffffff;
}

.file-icon.pdf {
  background: linear-gradient(135deg, #e74c3c, #ff6b6b);
  color: #ffffff;
}

.file-icon.default {
  background: linear-gradient(135deg, #3f7cff, #8c5cff);
  color: #ffffff;
}

.file-icon svg {
  width: 22px;
  height: 22px;
}

.file-info {
  min-width: 0;
}

.file-info strong {
  display: block;
  color: #1e2432;
  font-size: 14px;
  font-weight: 900;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-info em {
  display: block;
  color: #7b8493;
  font-size: 12px;
  font-style: normal;
  margin-top: 2px;
}

.download-button {
  flex: 0 0 auto;
  height: 40px;
  padding: 0 20px;
  border: 0;
  border-radius: 8px;
  color: #ffffff;
  background: linear-gradient(135deg, #3f7cff, #7158ff);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 800;
  text-decoration: none;
  box-shadow: 0 6px 14px rgba(63, 124, 255, 0.24);
  transition: all 0.2s ease;
}

.download-button:hover {
  filter: brightness(1.05);
  box-shadow: 0 8px 18px rgba(63, 124, 255, 0.32);
  transform: translateY(-1px);
}

.download-button svg {
  width: 16px;
  height: 16px;
}
</style>
