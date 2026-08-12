import { nextTick, reactive, ref } from 'vue';
import { handleSseEvent } from '../chat/stream';
import type { ChatMessage, SseLogEntry, SseLogCategory } from '../chat/types';

/**
 * Playground 聊天 composable：useChat 的精简变体。
 *
 * - 固定 ``agent_id = playground_agent``；
 * - 复用 ``views/chat/stream.ts`` 的 ``handleSseEvent``（todo 卡片 / reasoning /
 *   markdown / run_finished 等 AGUI 事件渲染逻辑）；
 * - 不带检索范围、agent 切换等 ChatView 专属能力。
 */
export const usePlaygroundChat = () => {
    const inputValue = ref('');
    const messages = ref<ChatMessage[]>([]);
    const isLoading = ref(false);
    const chatBodyRef = ref<HTMLElement | null>(null);
    const sessionId = ref('');
    const abortController = ref<AbortController | null>(null);
    /** SSE 运行日志：每条解析成功的 SSE 事件都会结构化入列，供「运行日志」tab 实时展示。 */
    const sseLog = ref<SseLogEntry[]>([]);
    let messageSeed = 1;
    let logSeed = 1;

    /** 将任意值截断为适合日志展示的短字符串。 */
    const truncate = (value: any, max = 200): string => {
        if (value === undefined || value === null) return '';
        const str = typeof value === 'string' ? value : JSON.stringify(value);
        if (!str) return '';
        return str.length > max ? `${str.slice(0, max)}…` : str;
    };

    /** 根据 SSE 事件类型归类并生成一行可读摘要（用于结构化日志）。 */
    const classify = (data: any): { category: SseLogCategory; summary: string; detail?: string } => {
        const type = data.type || data.event || 'unknown';

        // frontend_digest UI 摘要卡片（多种包装格式，custom_type 为确定性标志）。
        if (data.custom_type === 'frontend_digest') {
            const digest = data.custom_data || data.payload || data.ui_data || {};
            if (digest.display_type === 'research_trace') {
                return { category: 'digest', summary: `研究过程 · 第${digest.turn ?? 0}轮 · ${digest.title || ''}`, detail: digest.content };
            }
            return {
                category: 'digest',
                summary: `UI 摘要卡片${digest.tool_name ? ` · ${digest.tool_name}` : ''}`,
                detail: digest.display_type
            };
        }

        switch (type) {
            case 'run_started':
                return { category: 'lifecycle', summary: '运行开始', detail: data.run_content };
            case 'run_finished':
                return { category: 'lifecycle', summary: `运行结束 · ${data.turns ?? '?'} 轮 · ${data.outcome ?? ''}` };
            case 'run_error':
                return { category: 'error', summary: '运行错误', detail: data.error_message || data.message };
            case 'tool_call_start':
                return { category: 'tool', summary: `开始调用工具 ${data.tool_name}` };
            case 'tool_call_args':
                return { category: 'tool', summary: `${data.tool_name} · 入参`, detail: truncate(data.tool_args) };
            case 'tool_call_end':
                return { category: 'tool', summary: `${data.tool_name} · 调用结束` };
            case 'tool_call_result':
                return { category: 'tool', summary: `${data.tool_name} · 返回结果`, detail: truncate(data.tool_result) };
            case 'text_message_start':
                return { category: 'text', summary: '文本消息开始' };
            case 'text_message_content':
                return { category: 'text', summary: '文本增量（推理 / 答案）', detail: truncate(data.delta, 120) };
            case 'text_message_end':
                return { category: 'text', summary: '文本消息结束' };
            case 'step_started':
                return { category: 'step', summary: `步骤开始 · ${data.step_name}` };
            case 'step_finished':
                return { category: 'step', summary: `步骤结束 · ${data.step_name}` };
            case 'messages_snapshot':
                return { category: 'snapshot', summary: '消息快照', detail: data.outcome };
            default:
                return { category: 'other', summary: type };
        }
    };

    /** 将一条 SSE 事件结构化记入运行日志。 */
    const pushLog = (data: any) => {
        const { category, summary, detail } = classify(data);
        const now = new Date();
        sseLog.value.push({
            id: logSeed++,
            seq: typeof data.seq === 'number' ? data.seq : 0,
            type: data.type || data.event || 'unknown',
            category,
            ts: `${now.toLocaleTimeString('zh-CN', { hour12: false })}.${String(now.getMilliseconds()).padStart(3, '0')}`,
            summary,
            detail,
            raw: data
        });
    };

    const clearLog = () => {
        sseLog.value = [];
        logSeed = 1;
    };

    const scrollToBottom = async () => {
        await nextTick();
        const el = chatBodyRef.value;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
    };

    const resetSession = () => {
        sessionId.value = '';
        messages.value = [];
        clearLog();
    };

    const stop = () => {
        abortController.value?.abort();
    };

    const sendMessage = async (attachments: string[] = []) => {
        const query = inputValue.value.trim();
        if (!query || isLoading.value) return;

        // 附件 = 已上传到后端 data/files/ 的绝对路径，拼入消息交给 agent 操作。
        const fullContent = attachments.length
            ? `${query}\n\n附件文件（请直接操作以下路径）：\n${attachments.map((p) => `- ${p}`).join('\n')}`
            : query;

        inputValue.value = '';
        messages.value.push({
            id: messageSeed++,
            role: 'user',
            content: fullContent,
            agentTitle: 'Playground 调试助手'
        });
        // 必须用 reactive 包装：流式期间 handleSseEvent 直接改 assistant，
        // 若持有 raw 对象会绕过 Vue 依赖触发，导致过程卡/答案直到
        // isLoading 翻转才一次性渲染。
        const assistant: ChatMessage = reactive({
            id: messageSeed++,
            role: 'assistant',
            content: '',
            reasoning: '',
            todoCard: null,
            a2uiCards: [],
            materialCards: [],
            isStreaming: true,
            agentTitle: 'Playground 调试助手'
        });
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
                    agent_id: 'playground_agent',
                    message: fullContent,
                    session_id: sessionId.value || undefined,
                    stream: true,
                    protocol: 'agui',
                    user_id: 'playground-user',
                    context: { frontend: 'egis-agent-frontend', surface: 'playground' }
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
                        const parsed = JSON.parse(line.slice(5).trim());
                        pushLog(parsed);
                        handleSseEvent(parsed, assistant, startTime, {
                            agentSessionId: sessionId,
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
                assistant.content = `${assistant.content || ''}\n\n发送失败：${err.message || '请确认 egis-training-agent 后端已启动'}`;
                assistant.isStreaming = false;
            }
        } finally {
            isLoading.value = false;
            abortController.value = null;
            scrollToBottom();
        }
    };

    return {
        inputValue,
        messages,
        isLoading,
        chatBodyRef,
        sessionId,
        sendMessage,
        resetSession,
        stop,
        scrollToBottom,
        sseLog,
        clearLog
    };
};
