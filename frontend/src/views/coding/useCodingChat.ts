/** Coding Agent 状态机 — SSE 消费 / 会话管理 / 权限应答 / abort。

与 chat/useChat.ts 的差异（为什么不复用）：
- 事件模型是 BareAGUIFormatter 的 AG-UI 原生帧（`data.type`），custom 帧
  按 custom_type 分流（sse.ts），而非企业信封；
- assistant 消息携带 toolCards / pendingPermissions / todos / subagentTasks
  四个流式聚合区，按 tool_call_id / scope_id 去重更新；
- 权限应答是闭环的一部分：permission_request 卡片 → respond →
  permission_resolved 落定；SSE 断线时靠 pending 轮询兜底。
*/

import { nextTick, onUnmounted, reactive, ref } from 'vue';
import {
    abortChat as apiAbortChat,
    deleteSession as apiDeleteSession,
    getAgents,
    getWorkspaceBinding,
    getWorkspaceDefault,
    listCommands,
    listSessions,
    loadSessionMessages,
    pendingPermissions,
    respondPermission as apiRespondPermission
} from './api';
import { CODING_MODES, CODING_USER_ID } from './constants';
import { appendTextPart, handleCustomEvent, upsertToolCard } from './sse';
import type {
    AgentModeInfo,
    CommandInfo,
    CodingMessage,
    CodingMode,
    PermissionAction,
    ProjectStatus,
    SessionMeta,
    ToolCard
} from './types';

const SESSIONS_REFRESH_INTERVAL_MS = 30_000;
const PENDING_FALLBACK_INTERVAL_MS = 3_000;

export const useCodingChat = () => {
    const mode = ref<CodingMode>('build');
    /** 模式列表（GET /agents 动态拉取，agent.json 驱动；失败时保持 fallback） */
    const modes = ref<AgentModeInfo[]>(CODING_MODES);
    const inputValue = ref('');
    const messages = ref<CodingMessage[]>([]);
    const isLoading = ref(false);
    const chatBodyRef = ref<HTMLElement | null>(null);

    const sessionId = ref('');
    const sessions = ref<SessionMeta[]>([]);
    const backendError = ref('');
    const abortController = ref<AbortController | null>(null);

    /* ── 工作目录（服务端反显；前端无目录配置能力）────── */
    /** "" = 多租户沙箱；"local:<绝对路径>" = 锚定目录（后端解析结果）。
     * 目录完全由服务端决定（.env CODING_DEFAULT_WORKSPACE_* 或会话
     * 显式绑定），前端仅查询反显 —— chat 请求永不携带 workspace_root */
    const workspaceRoot = ref('');
    /** 当前工作目录的状态（名称/git 分支等） */
    const workspaceStatus = ref<ProjectStatus | null>(null);
    /** 当前工作目录下的 slash 命令（/ 面板） */
    const commands = ref<CommandInfo[]>([]);
    /** 会话列表定时刷新（title 变化等） */
    let sessionsTimer: ReturnType<typeof setInterval> | null = null;
    /** 断线兑底轮询句柄（仅 run 进行中启动） */
    let pendingTimer: ReturnType<typeof setInterval> | null = null;
    let messageSeed = 1;

    /** 当前模式元数据（chat agent_id / 命令面板 / placeholder 共用）。 */
    const currentMode = (): AgentModeInfo =>
        modes.value.find((item) => item.mode === mode.value) || {
            mode: mode.value,
            agent_id: mode.value,
            name: mode.value,
            description: ''
        };

    /* ── 文件变动信号（写盘工具成功即 ++；文件树实时刷新的驱动源）── */
    const fileMutationCount = ref(0);

    /* ── 滚动跟随 ───────────────────────────── */

    /** 距底阈值：小于该距离视为“在底部”，跟随最新 */
    const NEAR_BOTTOM_PX = 80;

    /** "回到底部"悬浮按钮可见性（滚动位置驱动） */
    const showJumpBottom = ref(false);

    /**
     * 跟随开关：仅由用户滚动事件驱动（滚到底部附近=true，上翻=false）。
     * 不能在 scrollToBottom 里实时算距底距离 —— 流式内容追加会使
     * scrollHeight 增大而 scrollTop 不变，首帧新增内容即把自己顶出
     * “近底部”，导致永远不跟随。内容追加不触发 scroll 事件，
     * 故 stick 状态不会被流式增长误关。
     */
    const stickToBottom = ref(true);

    /**
     * 滚动到底部。流式增量（工具卡片/正文）仅在跟随状态下滚动；
     * force 用于用户主动动作（发消息 / 切会话 / 点回到底部按钮）。
     */
    const scrollToBottom = async (force = false) => {
        await nextTick();
        const el = chatBodyRef.value;
        if (!el) return;
        if (!force && !stickToBottom.value) return;
        // force（发消息/切会话/点回底按钮）重夺跟随权；短内容不满一屏时
        // scrollTop 赋值不触发 scroll 事件，需在此显式重置
        stickToBottom.value = true;
        el.scrollTop = el.scrollHeight;
        showJumpBottom.value = false;
    };

    /** coding-body 滚动事件：更新跟随开关与回底按钮（上翻显示，拉回底部消失） */
    const onBodyScroll = () => {
        const el = chatBodyRef.value;
        if (!el) return;
        const near =
            el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
        stickToBottom.value = near;
        showJumpBottom.value = !near;
    };

    /* ── 会话管理 ─────────────────────────────── */

    const refreshSessions = async () => {
        try {
            sessions.value = await listSessions(CODING_USER_ID);
            backendError.value = '';
        } catch (err: any) {
            backendError.value = err?.message || '无法连接 egis-opencode 后端';
        }
    };

    const startSessionPolling = () => {
        if (sessionsTimer) clearInterval(sessionsTimer);
        sessionsTimer = setInterval(refreshSessions, SESSIONS_REFRESH_INTERVAL_MS);
    };

    const newSession = () => {
        if (isLoading.value) return;
        sessionId.value = '';
        messages.value = [];
        // 新会话无绑定：反显服务端默认工作目录（会话切回时再按
        // 会话已存绑定刷新）
        refreshDefaultWorkspace();
    };

    const selectSession = async (targetId: string) => {
        if (isLoading.value || targetId === sessionId.value) return;
        sessionId.value = targetId;
        messages.value = [];
        await syncBindingFromSession(targetId);
        try {
            const history = await loadSessionMessages(targetId, CODING_USER_ID);
            messages.value = renderHistory(history);
            scrollToBottom(true);
        } catch (err: any) {
            messages.value = [
                {
                    id: messageSeed++,
                    role: 'assistant',
                    content: `历史加载失败：${err?.message || '未知错误'}`,
                    parts: [],
                    toolCards: [],
                    pendingPermissions: [],
                    todos: [],
                    subagentTasks: []
                }
            ];
        }
    };

    const removeSession = async (targetId: string) => {
        try {
            await apiDeleteSession(targetId, CODING_USER_ID);
            if (targetId === sessionId.value) newSession();
            await refreshSessions();
        } catch (err: any) {
            backendError.value = err?.message || '删除会话失败';
        }
    };

    /** 历史消息 → 可回放 UI 消息（tool_results 合并进前一条 assistant 的工具卡）。 */
    const renderHistory = (history: HistoryEntry[]): CodingMessage[] => renderHistoryRaw(history);

    /* ── 工作目录反显（服务端决定，前端只查询展示）────── */

    const refreshCommands = async () => {
        try {
            commands.value = await listCommands(
                CODING_USER_ID,
                workspaceRoot.value,
                currentMode().agent_id
            );
        } catch {
            commands.value = [];
        }
    };

    /** 拉取 agent 模式列表（后端 agent.json 聚合；新 agent 无需前端改动）。 */
    const refreshModes = async () => {
        try {
            const result = await getAgents();
            if (result.modes.length) modes.value = result.modes;
        } catch {
            /* 拉取失败保持 fallback（后端不可达时侧栏已有 backendError） */
        }
    };

    /** 应用反显结果（本地状态 + 命令面板）。 */
    const applyBinding = async (root: string, status: ProjectStatus | null) => {
        workspaceRoot.value = root;
        workspaceStatus.value = status;
        await refreshCommands();
    };

    /** 反显服务端默认工作目录（新会话/无会话时的展示值）。 */
    const refreshDefaultWorkspace = async () => {
        try {
            const result = await getWorkspaceDefault();
            await applyBinding(result.workspace_root, result.status);
        } catch {
            /* 查询失败保持当前展示（后端不可达时侧栏已有 backendError） */
        }
    };

    /** 切换会话时反显服务端已存的绑定（显式绑定 > .env 默认）。 */
    const syncBindingFromSession = async (targetId: string) => {
        try {
            const result = await getWorkspaceBinding(targetId);
            await applyBinding(result.workspace_root, result.status);
        } catch {
            /* 查询失败保持当前展示（目录解析仍由后端在 chat 时兜底） */
        }
    };

    /* ── 权限应答 ─────────────────────────────── */

    const respondToPermission = async (requestId: string, action: PermissionAction) => {
        try {
            await apiRespondPermission(requestId, action);
        } catch {
            // 已被应答/超时：以后端 permission_resolved 事件为准
        }
        for (const message of messages.value) {
            const pending = message.pendingPermissions.find((item) => item.request_id === requestId);
            if (pending) pending.resolved = action;
        }
    };

    /* ── 发送与 SSE 消费 ──────────────────────── */

    /**
     * 子任务兜底收尾：终态事件丢失（SSE 断线 / 取消竞态）时
     * started 状态会永久转圈 —— run 终止的各出口统一收口。
     */
    const finalizeSubagentTasks = (
        message: CodingMessage,
        status: 'finished' | 'failed',
        summary: string
    ) => {
        for (const task of message.subagentTasks) {
            if (task.status !== 'started') continue;
            task.status = status;
            if (!task.summary) task.summary = summary;
        }
    };

    const stopPendingPolling = () => {
        if (pendingTimer) {
            clearInterval(pendingTimer);
            pendingTimer = null;
        }
    };

    const startPendingFallback = () => {
        stopPendingPolling();
        pendingTimer = setInterval(mergePendingPermissions, PENDING_FALLBACK_INTERVAL_MS);
    };

    const mergePendingPermissions = async () => {
        if (!sessionId.value) return;
        try {
            const pendings = await pendingPermissions(sessionId.value);
            const latest = messages.value[messages.value.length - 1];
            if (!latest || latest.role !== 'assistant') return;
            for (const item of pendings) {
                if (!latest.pendingPermissions.some((p) => p.request_id === item.request_id)) {
                    latest.pendingPermissions.push(item);
                }
            }
        } catch {
            /* 断线兜底尽力而为 */
        }
    };

    const sendMessage = async () => {
        const query = inputValue.value.trim();
        if (!query || isLoading.value) return;

        inputValue.value = '';
        messages.value.push({
            id: messageSeed++,
            role: 'user',
            content: query,
            parts: [],
            toolCards: [],
            pendingPermissions: [],
            todos: [],
            subagentTasks: []
        });

        const assistant: CodingMessage = reactive({
            id: messageSeed++,
            role: 'assistant',
            content: '',
            reasoning: '',
            parts: [],
            toolCards: [],
            pendingPermissions: [],
            todos: [],
            subagentTasks: [],
            isStreaming: true
        });
        messages.value.push(assistant);
        isLoading.value = true;
        startPendingFallback();
        await scrollToBottom(true);

        const startTime = Date.now();
        try {
            abortController.value = new AbortController();
            const response = await fetch('/api/coding/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agent_id: currentMode().agent_id,
                    message: query,
                    session_id: sessionId.value || undefined,
                    stream: true,
                    protocol: 'agui',
                    user_id: CODING_USER_ID
                    // 不携带 workspace_root：目录完全由服务端解析
                    // （会话显式绑定 > .env 默认 CODING_DEFAULT_WORKSPACE_*）
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
                    if (!line.startsWith('data:')) continue;
                    try {
                        handleSseFrame(JSON.parse(line.slice(5).trim()), assistant, startTime, {
                            onSessionId: (sid) => {
                                if (!sessionId.value) sessionId.value = sid;
                            },
                            onTitleGenerated: (sid, title) => {
                                const session = sessions.value.find((item) => item.session_id === sid);
                                if (session) session.title = title;
                            }
                        });
                    } catch (err) {
                        console.warn('SSE parse failed:', err, line);
                    }
                }
            }

            assistant.isStreaming = false;
            assistant.elapsed =
                assistant.elapsed || Math.max(1, Math.round((Date.now() - startTime) / 1000));
            // 流关闭但未收到 run_finished（断流/崩溃）：乐观按完成收尾
            finalizeSubagentTasks(assistant, 'finished', '连接结束（未收到完成事件）');
        } catch (err: any) {
            if (err?.name !== 'AbortError') {
                appendTextPart(
                    assistant,
                    `\n\n发送失败：${err?.message || '请确认 egis-opencode 后端已启动（:38083）'}`
                );
                assistant.isStreaming = false;
                finalizeSubagentTasks(assistant, 'failed', '连接失败，子任务未完成');
            }
        } finally {
            isLoading.value = false;
            abortController.value = null;
            stopPendingPolling();
            refreshSessions();
            scrollToBottom();
        }
    };

    /** 单帧处理：AG-UI 原生事件 + custom 分流。 */
    const handleSseFrame = (
        data: any,
        assistant: CodingMessage,
        startTime: number,
        hooks: { onSessionId: (sid: string) => void; onTitleGenerated: (sid: string, title: string) => void }
    ) => {
        const eventType: string = data?.type || '';
        if (data?.session_id && !sessionId.value) {
            sessionId.value = data.session_id;
            hooks.onSessionId(data.session_id);
        }

        switch (eventType) {
            case 'custom': {
                handleCustomEvent(data.custom_type, data.custom_data, {
                    message: assistant,
                    onSessionId: hooks.onSessionId,
                    onTitleGenerated: hooks.onTitleGenerated,
                    // run 中 write/edit/bash 落盘：文件系统已变动信号
                    onFileMutated: () => { fileMutationCount.value++; }
                });
                scrollToBottom();
                break;
            }
            case 'text_message_content': {
                if (typeof data.delta === 'string' && data.delta) {
                    if (data.content_kind === 'text' || !data.content_kind) {
                        appendTextPart(assistant, data.delta);
                    } else {
                        assistant.reasoning = `${assistant.reasoning || ''}${data.delta}`;
                    }
                }
                break;
            }
            case 'tool_call_start': {
                // executor 帧：先立 running 卡，tool_digest 到达后按 tool_call_id 细化
                if (data.tool_call_id) {
                    upsertToolCard(assistant, {
                        tool_call_id: String(data.tool_call_id),
                        tool_name: String(data.tool_name || ''),
                        title: String(data.tool_name || '工具')
                    });
                    scrollToBottom();
                }
                break;
            }
            case 'tool_call_result': {
                // executor 帧：digest 缺席时兜底标记结果状态
                if (data.tool_call_id) {
                    const card = assistant.toolCards.find((item) => item.tool_call_id === data.tool_call_id);
                    if (card && card.status === 'running') card.status = 'success';
                }
                break;
            }
            case 'run_finished': {
                if (typeof data.message === 'string' && data.message && !assistant.content) {
                    appendTextPart(assistant, data.message);
                }
                // 运行上限截断：轮次预算或单次输出长度（ark 两者共用该 outcome）
                if (data.outcome === 'stopped_by_limit') {
                    appendTextPart(
                        assistant,
                        '\n\n---\n已达单次运行上限（轮次预算或单次输出长度），任务被截断。发送“继续”可从中断处接着执行；若反复被截断，建议让模型分块、分文件处理。'
                    );
                }
                assistant.elapsed = Math.max(1, Math.round((Date.now() - startTime) / 1000));
                assistant.isStreaming = false;
                for (const card of assistant.toolCards) {
                    if (card.status === 'running' || card.status === 'pending') card.status = 'success';
                }
                // 子任务兜底：终态事件丢失时避免永久转圈（后端正常会
                // 逐个发 finished/failed，此处仅覆盖事件缺席的极端情况）
                finalizeSubagentTasks(assistant, 'finished', '运行结束（未收到显式完成事件）');
                scrollToBottom();
                break;
            }
            case 'run_error': {
                appendTextPart(assistant, `\n\n执行失败：${data.error_message || '未知错误'}`);
                assistant.isStreaming = false;
                finalizeSubagentTasks(assistant, 'failed', '运行中断，子任务未完成');
                scrollToBottom();
                break;
            }
            default:
                break;
        }
    };

    const stop = async () => {
        abortController.value?.abort();
        if (sessionId.value) {
            try {
                await apiAbortChat(sessionId.value);
            } catch {
                /* run 可能已结束 */
            }
        }
        isLoading.value = false;
        const latest = messages.value[messages.value.length - 1];
        if (latest?.isStreaming) {
            latest.isStreaming = false;
            finalizeSubagentTasks(latest, 'failed', '已中断');
        }
    };

    const switchMode = (next: CodingMode) => {
        if (isLoading.value || next === mode.value) return;
        mode.value = next;
        newSession();
    };

    startSessionPolling();
    refreshSessions();
    refreshModes();
    // 目录由服务端决定：启动即反显 .env 默认工作目录（无默认时空串
    // = 多租户沙箱）；选中会话时再按会话已存绑定刷新反显
    refreshDefaultWorkspace();
    onUnmounted(() => {
        if (sessionsTimer) clearInterval(sessionsTimer);
        stopPendingPolling();
    });

    return {
        mode,
        modes,
        currentMode,
        inputValue,
        messages,
        isLoading,
        chatBodyRef,
        showJumpBottom,
        onBodyScroll,
        scrollToBottom,
        sessionId,
        sessions,
        backendError,
        workspaceRoot,
        workspaceStatus,
        commands,
        fileMutationCount,
        newSession,
        selectSession,
        removeSession,
        respondToPermission,
        sendMessage,
        stop,
        switchMode,
        refreshSessions
    };
};

/* ── 历史回放渲染（纯函数） ─────────────────── */

type HistoryToolResult = {
    tool_call_id: string;
    content: string;
    is_error: boolean;
    llm_digest: string;
};

type HistoryEntry = {
    role: string;
    content: string;
    tool_calls?: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
    tool_results?: HistoryToolResult[];
    thinking?: string;
};

/** 安全解析 JSON（bash/list 的 content 是 json_result 序列化文本）。 */
const parseJsonContent = (raw: string): Record<string, unknown> | null => {
    try {
        const parsed = JSON.parse(raw);
        return typeof parsed === 'object' && parsed !== null
            ? (parsed as Record<string, unknown>)
            : null;
    } catch {
        return null;
    }
};

/**
 * 按工具名从 tool_call + tool_result 构造回放卡片 —— 与流式 digest 卡片
 * 同构（bash→终端卡、glob/grep/list/read→检索卡、write/edit→文件卡），
 * 历史会话不再退化成“（无详情）”占位卡。
 */
const buildHistoryCard = (
    call: { id: string; name: string; arguments: Record<string, unknown> },
    result?: HistoryToolResult
): ToolCard => {
    const args = call.arguments || {};
    // 无 result（运行中被截断的历史）保持 running；否则按 is_error 落定
    const status: ToolCard['status'] = result
        ? (result.is_error ? 'error' : 'success')
        : 'running';
    // llm_digest 在内容型工具（read/grep/glob/list）不再显式传 —— 后端
    // 序列化 property 会 fallback 成 content 全文，note 只作短备注，
    // 超长收口避免卡片爆炸（完整内容由卡片正文展示）
    const digestText = result?.llm_digest || '';
    const base = {
        tool_call_id: call.id,
        tool_name: call.name,
        status,
        note: digestText.length > 300 ? `${digestText.slice(0, 300)}…` : digestText
    };
    const content = result?.content || '';

    switch (call.name) {
        case 'bash': {
            const payload = parseJsonContent(content);
            const command = String(args.command || '');
            return {
                ...base,
                display_type: 'bash',
                title: command.slice(0, 120) || 'bash',
                command,
                exit_code: typeof payload?.exit_code === 'number' ? payload.exit_code : null,
                stdout_tail:
                    (typeof payload?.stdout === 'string' ? payload.stdout : content).slice(-2000)
            };
        }
        case 'glob': {
            const lines = content.split('\n').filter(Boolean);
            const pattern = String(args.pattern || '');
            const preview = lines.slice(0, 30);
            if (lines.length > 30) preview.push(`… 共 ${lines.length} 条`);
            return {
                ...base,
                display_type: 'search',
                title: `glob ${pattern}`.trim(),
                pattern,
                result_count: lines.length,
                results_preview: preview
            };
        }
        case 'grep': {
            const pattern = String(args.pattern || '');
            // 首行“N 处命中（扫描 M 个文件）”是统计行，预览取后续命中行
            const lines = content.split('\n').filter(Boolean).slice(1);
            // 新版 content 首行“N 处命中”；旧版 digest“命中 N 处”兼容
            const countMatch =
                /(\d+) 处命中/.exec(content) ||
                /命中 (\d+) 处/.exec(result?.llm_digest || '');
            return {
                ...base,
                display_type: 'search',
                title: `grep ${pattern}`.trim(),
                pattern,
                result_count: countMatch ? Number(countMatch[1]) : null,
                results_preview: lines.slice(0, 10)
            };
        }
        case 'list': {
            const payload = parseJsonContent(content);
            const entries = Array.isArray(payload?.entries)
                ? (payload.entries as Array<Record<string, unknown>>)
                : [];
            const directory = String(payload?.directory || args.path || '');
            const all = entries.map((e) =>
                e.type === 'dir' ? `${String(e.name)}/` : String(e.name)
            );
            const preview = all.slice(0, 30);
            if (all.length > 30) preview.push(`… 共 ${all.length} 项`);
            return {
                ...base,
                display_type: 'search',
                title: `list ${directory}`.trim(),
                path: directory,
                result_count: entries.length,
                results_preview: preview
            };
        }
        case 'read': {
            const path = String(args.path || '');
            // 新版 content 契约：<path>/<type>/<content> 标签 + "N: line" 行号 +
            // 尾部行区间提示；解析后与流式卡片同构（完整内容 + 行区间徽标）
            const contentLines: Array<{ no: number; text: string }> = [];
            let totalLines: number | null = null;
            let truncated = false;
            for (const raw of content.split('\n')) {
                const m = /^(\d+): (.*)$/.exec(raw);
                if (m) {
                    contentLines.push({ no: Number(m[1]), text: m[2] });
                    continue;
                }
                const end = /total (\d+) lines/.exec(raw);
                if (end) totalLines = Number(end[1]);
                if (/capped|Showing lines|Use offset=/.test(raw)) truncated = true;
            }
            if (contentLines.length) {
                return {
                    ...base,
                    display_type: 'search',
                    title: `read ${path}`.trim(),
                    path,
                    result_count: contentLines.length,
                    file_text: contentLines.map((l) => l.text).join('\n'),
                    line_start: contentLines[0]?.no ?? null,
                    line_end: contentLines[contentLines.length - 1]?.no ?? null,
                    total_lines: totalLines,
                    content_truncated: truncated
                };
            }
            // 旧版会话（N→line 或无行号）：退回预览列表形态
            const legacyLines = content.split('\n').filter(Boolean);
            return {
                ...base,
                display_type: 'search',
                title: `read ${path}`.trim(),
                path,
                result_count: legacyLines.length,
                results_preview: legacyLines.slice(0, 30)
            };
        }
        case 'write':
        case 'edit': {
            const path = String(args.path || '');
            return {
                ...base,
                display_type: 'file_edit',
                title: `${call.name} ${path}`.trim(),
                path
            };
        }
        default: {
            return {
                ...base,
                display_type: 'tool_progress',
                title: call.name
            };
        }
    }
};

const renderHistoryRaw = (history: HistoryEntry[]): CodingMessage[] => {
    const rendered: CodingMessage[] = [];
    /** tool_call_id → 原始 call（arguments 供回放卡片构造） */
    const callsById = new Map<
        string,
        { id: string; name: string; arguments: Record<string, unknown> }
    >();
    for (const entry of history) {
        if (entry.role === 'user') {
            rendered.push({
                id: rendered.length + 1,
                role: 'user',
                content: entry.content || '',
                parts: [],
                toolCards: [],
                pendingPermissions: [],
                todos: [],
                subagentTasks: []
            });
            continue;
        }
        if (entry.role === 'assistant') {
            // parts 交织（同 opencode 回放）：正文在前，工具卡随后；
            // 同一 run 内多轮 assistant 会逐条追加，保持轮次时序
            for (const call of entry.tool_calls || []) callsById.set(call.id, call);
            const toolCards = (entry.tool_calls || []).map((call) => buildHistoryCard(call));
            const parts: CodingMessage['parts'] = [];
            if (entry.content) parts.push({ kind: 'text', text: entry.content });
            for (const card of toolCards) parts.push({ kind: 'tool', card });
            rendered.push({
                id: rendered.length + 1,
                role: 'assistant',
                content: entry.content || '',
                reasoning: entry.thinking || '',
                parts,
                toolCards,
                pendingPermissions: [],
                todos: [],
                subagentTasks: []
            });
            continue;
        }
        if (entry.role === 'tool' && entry.tool_results?.length) {
            // 工具结果到达：用完整 call+result 重建卡片（display_type/预览与流式一致）。
            // toolCards 与 parts 里的 tool part 持同一 card 引用，重建后同步可见
            const target = [...rendered].reverse().find((item) => item.role === 'assistant');
            if (!target) continue;
            for (const result of entry.tool_results) {
                const call = callsById.get(result.tool_call_id);
                const rebuilt = buildHistoryCard(
                    call ?? { id: result.tool_call_id, name: '', arguments: {} },
                    result
                );
                const existing = target.toolCards.find(
                    (item) => item.tool_call_id === result.tool_call_id
                );
                if (existing) {
                    Object.assign(existing, rebuilt);
                } else {
                    target.toolCards.push(rebuilt);
                    target.parts.push({ kind: 'tool', card: rebuilt });
                }
            }
        }
    }
    return rendered;
};
