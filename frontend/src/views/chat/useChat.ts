import { computed, nextTick, ref, watch } from 'vue';
import type { Ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { agents, agentMap } from './constants';
import { handleSseEvent } from './stream';
import type { ChatMessage } from './types';

type RetrievalScopeRefs = {
  internetSearchEnabled: Ref<boolean>;
  selectedScopeIds: Ref<string[]>;
  selectedTagIds: Ref<string[]>;
  selectedFileIds: Ref<string[]>;
};

export const useChat = (
  scopeRefs: RetrievalScopeRefs,
  closeScopePanels: () => void
) => {
  const route = useRoute();
  const router = useRouter();
  const selectedAgentId = ref('it-qa');
  const inputValue = ref('');
  const messages = ref<ChatMessage[]>([]);
  const isLoading = ref(false);
  const chatBodyRef = ref<HTMLElement | null>(null);
  const agentSessionId = ref('');
  const abortController = ref<AbortController | null>(null);
  let messageSeed = 1;

  const selectedAgent = computed(() => agentMap[selectedAgentId.value] ?? agents[0]);
  const todayLabel = new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' })
    .format(new Date())
    .replace('/', '-');
  const currentTaskTitle = computed(() => {
    const latestUserMessage = [...messages.value].reverse().find((message) => message.role === 'user');
    return latestUserMessage?.content || `${selectedAgent.value.title} 对话`;
  });
  const recentPrompts = computed(() => selectedAgent.value.examples.concat([
    '基于现有材料生成培训 PPT 大纲',
    '把企业年金知识点整理成新人必学清单'
  ]));
  const commonAgents = computed(() => agents.filter((agent) => ['it-qa', 'consumer-protection'].includes(agent.id)));
  const annuityAgents = computed(() => agents.filter((agent) => agent.id === 'annuity-business'));

  watch(
    () => route.query.agent,
    (agentId) => {
      if (typeof agentId === 'string' && agentMap[agentId]) {
        selectedAgentId.value = agentId;
        agentSessionId.value = '';
      }
    },
    { immediate: true }
  );

  const selectAgent = (id: string) => {
    selectedAgentId.value = id;
    agentSessionId.value = '';
    router.replace({ path: '/chat', query: { agent: id } });
  };

  const fillPrompt = (prompt: string) => {
    inputValue.value = prompt;
  };

  const scrollToBottom = async () => {
    await nextTick();
    const el = chatBodyRef.value;
    if (!el) return;
    if (messages.value.length <= 2) {
      el.scrollTop = 0;
      return;
    }
    el.scrollTop = el.scrollHeight;
  };

  const sendMessage = async () => {
    const query = inputValue.value.trim();
    if (!query || isLoading.value) return;

    const agent = selectedAgent.value;
    inputValue.value = '';
    closeScopePanels();
    messages.value.push({
      id: messageSeed++,
      role: 'user',
      content: query,
      agentTitle: agent.title,
      createdAt: todayLabel
    });
    const assistant: ChatMessage = {
      id: messageSeed++,
      role: 'assistant',
      content: '',
      reasoning: '',
      todoCard: null,
      isStreaming: true,
      agentTitle: agent.title
    };
    messages.value.push(assistant);
    isLoading.value = true;
    await scrollToBottom();

    const startTime = Date.now();
    try {
      abortController.value = new AbortController();
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: agent.backendAgentId,
          message: query,
          session_id: agentSessionId.value || undefined,
          stream: true,
          protocol: 'agui',
          user_id: 'egis-agents-frontend-user',
          context: {
            selected_frontend_agent: agent.id,
            frontend: 'egis-agents-frontend',
            retrieval_scope: {
              internet_search: scopeRefs.internetSearchEnabled.value,
              library_ids: scopeRefs.selectedScopeIds.value,
              tag_ids: scopeRefs.selectedTagIds.value,
              file_ids: scopeRefs.selectedFileIds.value
            }
          }
        }),
        signal: abortController.value.signal
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data:')) continue;
          try {
            handleSseEvent(JSON.parse(line.slice(5).trim()), assistant, startTime, {
              agentSessionId,
              onScroll: scrollToBottom
            });
          } catch (err) {
            console.warn('SSE parse failed:', err, line);
          }
        }
      }

      assistant.isStreaming = false;
      assistant.elapsed = assistant.elapsed || Math.max(1, Math.round((Date.now() - startTime) / 1000));
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        assistant.content = `${assistant.content || ''}\n\n发送失败：${err.message || '请确认 egis-agents 后端已启动'}`;
        assistant.isStreaming = false;
      }
    } finally {
      isLoading.value = false;
      abortController.value = null;
      scrollToBottom();
    }
  };

  return {
    agents,
    selectedAgentId,
    selectedAgent,
    inputValue,
    messages,
    isLoading,
    chatBodyRef,
    currentTaskTitle,
    recentPrompts,
    commonAgents,
    annuityAgents,
    selectAgent,
    fillPrompt,
    sendMessage
  };
};
