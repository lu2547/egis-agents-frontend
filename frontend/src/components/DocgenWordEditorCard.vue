<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { CheckIcon, CloseIcon, DownloadIcon, FileWordIcon, LoadingIcon } from 'tdesign-icons-vue-next';
import { DocxEditor } from '@eigenpal/docx-editor-vue';
import '@eigenpal/docx-editor-vue/styles.css';
import type { DocxEditorRef } from '@eigenpal/docx-editor-vue';

const props = defineProps<{
  title?: string;
  docxUrl: string;
}>();

const isOpen = ref(true);
const isLoading = ref(false);
const errorMessage = ref('');
const documentBuffer = ref<ArrayBuffer | null>(null);
const editorRef = ref<DocxEditorRef | null>(null);

const fileName = computed(() => `${props.title || '材料文档'}.docx`);

const loadDocument = async () => {
  if (!props.docxUrl) {
    errorMessage.value = '缺少 Word 文档地址';
    return;
  }

  isLoading.value = true;
  errorMessage.value = '';
  documentBuffer.value = null;

  try {
    const response = await fetch(props.docxUrl, { credentials: 'include' });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(detail || `HTTP ${response.status}`);
    }
    documentBuffer.value = await response.arrayBuffer();
  } catch (err: any) {
    errorMessage.value = `Word 文档加载失败：${err?.message || '未知错误'}`;
  } finally {
    isLoading.value = false;
  }
};

const downloadBlob = (buffer: ArrayBuffer) => {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.value;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const downloadCurrentDocument = async () => {
  try {
    const saved = await editorRef.value?.save();
    if (saved) {
      downloadBlob(saved);
      return;
    }
  } catch (err) {
    console.warn('DocxEditor save failed, falling back to original buffer:', err);
  }

  if (documentBuffer.value) downloadBlob(documentBuffer.value);
};

onMounted(loadDocument);
watch(() => props.docxUrl, loadDocument);
</script>

<template>
  <div class="docgen-word-card">
    <div class="card-main">
      <div class="file-mark">
        <FileWordIcon />
      </div>
      <div class="file-text">
        <strong>{{ title || 'Word 文档' }}</strong>
        <span>eigenpal/docx-editor</span>
      </div>
      <button type="button" class="open-button" @click="isOpen = true">打开编辑器</button>
    </div>

    <Teleport to="body">
      <div v-if="isOpen" class="drawer-mask">
        <aside class="editor-drawer" role="dialog" aria-modal="true">
          <header class="drawer-header">
            <div class="drawer-title">
              <FileWordIcon />
              <strong>{{ title || 'Word 文档' }}</strong>
            </div>
            <button type="button" class="icon-button" aria-label="关闭" @click="isOpen = false">
              <CloseIcon />
            </button>
          </header>

          <main class="drawer-body">
            <div v-if="isLoading" class="editor-state">
              <LoadingIcon class="spin" />
              <span>正在加载 Word 文档…</span>
            </div>
            <div v-else-if="errorMessage" class="editor-error">
              {{ errorMessage }}
            </div>
            <DocxEditor
              v-else-if="documentBuffer"
              ref="editorRef"
              class="docx-editor"
              :document-buffer="documentBuffer"
              :document-name="fileName"
              mode="editing"
              author="Egis"
              :show-outline="true"
              :show-outline-button="true"
            />
          </main>

          <footer class="drawer-footer">
            <button type="button" class="ghost-button" @click="downloadCurrentDocument">
              <DownloadIcon />
              下载文档
            </button>
            <button type="button" class="primary-button" @click="isOpen = false">
              <CheckIcon />
              确认完成
            </button>
          </footer>
        </aside>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.docgen-word-card {
  margin: 8px 0;
}

.card-main {
  min-height: 72px;
  padding: 14px 16px;
  border: 1px solid #dfe6f2;
  border-radius: 10px;
  background: #ffffff;
  box-shadow: 0 8px 20px rgba(20, 34, 70, 0.06);
  display: flex;
  align-items: center;
  gap: 12px;
}

.file-mark {
  width: 42px;
  height: 42px;
  border-radius: 8px;
  background: #e8f2ff;
  color: #2764d8;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
}

.file-mark svg,
.drawer-title svg {
  width: 22px;
  height: 22px;
}

.file-text {
  min-width: 0;
  flex: 1;
}

.file-text strong {
  display: block;
  color: #1e2432;
  font-size: 15px;
  font-weight: 900;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-text span {
  color: #6d7482;
  font-size: 12px;
}

.open-button,
.ghost-button,
.primary-button,
.icon-button {
  border: 0;
  cursor: pointer;
  font: inherit;
}

.open-button {
  height: 38px;
  padding: 0 16px;
  border-radius: 8px;
  color: #ffffff;
  background: #2d5bd7;
  font-size: 13px;
  font-weight: 800;
}

.drawer-mask {
  position: fixed;
  inset: 0;
  z-index: 4000;
  background: rgba(15, 23, 42, 0.32);
  display: flex;
  justify-content: flex-end;
}

.editor-drawer {
  width: min(1240px, calc(100vw - 72px));
  height: 100vh;
  background: #f6f8fb;
  box-shadow: -16px 0 38px rgba(15, 23, 42, 0.18);
  display: grid;
  grid-template-rows: 64px minmax(0, 1fr) 64px;
}

.drawer-header,
.drawer-footer {
  padding: 0 20px;
  background: #ffffff;
  border-color: #e3e8f2;
  display: flex;
  align-items: center;
}

.drawer-header {
  border-bottom: 1px solid #e3e8f2;
  justify-content: space-between;
}

.drawer-footer {
  border-top: 1px solid #e3e8f2;
  justify-content: flex-end;
  gap: 12px;
}

.drawer-title {
  min-width: 0;
  color: #1e2432;
  display: flex;
  align-items: center;
  gap: 10px;
}

.drawer-title strong {
  font-size: 18px;
  font-weight: 900;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.icon-button {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: transparent;
  color: #202938;
  display: grid;
  place-items: center;
}

.icon-button:hover {
  background: #f0f3f8;
}

.drawer-body {
  min-height: 0;
  padding: 16px;
  overflow: hidden;
}

.docx-editor {
  height: 100%;
  border: 1px solid #dce3ef;
  border-radius: 8px;
  background: #ffffff;
  overflow: hidden;
}

.editor-state,
.editor-error {
  height: 100%;
  border: 1px solid #dce3ef;
  border-radius: 8px;
  background: #ffffff;
  color: #5b6472;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 10px;
  font-size: 14px;
}

.editor-error {
  color: #b42318;
  padding: 24px;
  text-align: center;
}

.spin {
  animation: spin 0.9s linear infinite;
}

.ghost-button,
.primary-button {
  height: 40px;
  padding: 0 18px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 800;
}

.ghost-button {
  color: #1f2a3d;
  background: #eef1f6;
}

.primary-button {
  color: #ffffff;
  background: #2d5bd7;
}

.ghost-button svg,
.primary-button svg {
  width: 18px;
  height: 18px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 720px) {
  .editor-drawer {
    width: 100vw;
  }

  .drawer-body {
    padding: 10px;
  }

  .drawer-title strong {
    font-size: 15px;
  }
}
</style>
