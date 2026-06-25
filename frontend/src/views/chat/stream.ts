import type { Ref } from 'vue';
import type { ChatMessage, MaterialCard } from './types';
import { finalizeTodoCard } from './todo';

type StreamHandlers = {
  agentSessionId: Ref<string>;
  onScroll: () => void;
};

/** tool_name → MaterialCard.kind 映射 */
const MATERIAL_TOOL_MAP: Record<string, MaterialCard['kind']> = {
  select_method: 'selection',
  std_redirect: 'redirect',
  outline_card: 'outline',
  ppt_preview: 'ppt_preview',
  word_preview: 'word_preview',
  create_download_url: 'download',
  download_card: 'download',
};

const normalizeFrontendDigest = (data: any) => {
  if (data.type === 'response.ui.component' && data.ui_component) return data.ui_component;
  if (data.custom_type === 'frontend_digest') return data.custom_data || data.payload || data.ui_data || null;
  if (data.type === 'custom' && data.custom_type === 'frontend_digest') return data.custom_data || data.payload || null;
  if (data.type === 'frontend_digest') return data.ui_data || data.custom_data || data.payload || data;
  if (data.data?.type === 'frontend_digest' || data.data?.custom_type === 'frontend_digest') {
    return data.data.ui_data || data.data.custom_data || data.data.payload || null;
  }
  return null;
};

/** 将 material 相关的 frontend_digest 推入 assistant.materialCards */
const pushMaterialCard = (assistant: ChatMessage, digest: any) => {
  const toolName = digest?.tool_name || '';
  const kind = toolName === 'docgen_pension_intro_flow' && digest?.action === 'show_docx'
    ? 'docgen_word_editor'
    : MATERIAL_TOOL_MAP[toolName];
  if (!kind) return false;

  if (!assistant.materialCards) assistant.materialCards = [];
  assistant.materialCards.push({ kind, toolName, data: digest });
  return true;
};

const extractDocgenEditorFromA2UI = (payload: any) => {
  if (!payload || !Array.isArray(payload.components)) return null;
  for (const item of payload.components) {
    const editor = item?.component?.DocgenEditor;
    if (editor?.docx_url) return editor;
  }
  return null;
};

export const handleSseEvent = (data: any, assistant: ChatMessage, startTime: number, handlers: StreamHandlers) => {
  const eventType = data.type || data.event || data.data?.type || '';
  if (data.session_id && !handlers.agentSessionId.value) handlers.agentSessionId.value = data.session_id;

  const digestPayload = normalizeFrontendDigest(data);

  if (digestPayload?.tool_name === 'todo_write') {
    assistant.todoCard = digestPayload;
    handlers.onScroll();
    return;
  }

  /* ── 材料制作卡片 ─────────────────────────── */
  if (digestPayload && pushMaterialCard(assistant, digestPayload)) {
    handlers.onScroll();
    return;
  }

  /* ── A2UI 卡片事件（必须在 text_message_content 之前）── */
  if (eventType === 'text_message_content' && data.content_kind === 'a2ui' && data.custom_data) {
    const docgenEditor = extractDocgenEditorFromA2UI(data.custom_data);
    if (docgenEditor) {
      if (!assistant.materialCards) assistant.materialCards = [];
      assistant.materialCards.push({
        kind: 'docgen_word_editor',
        toolName: 'docgen_word_standard_open_editor',
        data: {
          docx_url: docgenEditor.docx_url,
          title: docgenEditor.title,
          project_id: docgenEditor.project_id
        }
      });
      handlers.onScroll();
      return;
    }

    if (!assistant.a2uiCards) assistant.a2uiCards = [];
    assistant.a2uiCards.push(data.custom_data);
    handlers.onScroll();
    return;
  }

  if (eventType === 'text_message_content' || eventType === 'response.content.delta') {
    const delta = typeof data.delta === 'string' ? data.delta : '';
    if (delta) assistant.reasoning = `${assistant.reasoning || ''}${delta}`;
    handlers.onScroll();
    return;
  }

  if (eventType === 'run_finished' || eventType === 'response.completed') {
    assistant.content = data.message || data.content || assistant.content || '';
    assistant.elapsed = Math.max(1, Math.round((Date.now() - startTime) / 1000));
    assistant.isStreaming = false;
    finalizeTodoCard(assistant);
    handlers.onScroll();
    return;
  }

  if (eventType === 'run_error') {
    assistant.content = `${assistant.content || ''}\n\n发送失败：${data.error_message || data.message || '未知错误'}`;
    assistant.isStreaming = false;
    handlers.onScroll();
  }
};
