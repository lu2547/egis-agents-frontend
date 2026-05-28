import type { Ref } from 'vue';
import type { ChatMessage } from './types';
import { finalizeTodoCard } from './todo';

type StreamHandlers = {
  agentSessionId: Ref<string>;
  onScroll: () => void;
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

export const handleSseEvent = (data: any, assistant: ChatMessage, startTime: number, handlers: StreamHandlers) => {
  const eventType = data.type || data.event || data.data?.type || '';
  if (data.session_id && !handlers.agentSessionId.value) handlers.agentSessionId.value = data.session_id;

  const digestPayload = normalizeFrontendDigest(data);

  if (digestPayload?.tool_name === 'todo_write') {
    assistant.todoCard = digestPayload;
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
