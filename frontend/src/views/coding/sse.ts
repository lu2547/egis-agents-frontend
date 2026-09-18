/** SSE custom 事件分发器 — BareAGUIFormatter 的 `type=custom` 帧按 custom_type 分流。

custom_type 契约（对齐 egis-opencode events.py）：
- permission_request / permission_resolved — 权限审批闭环
- tool_digest — 工具过程卡片（tool_call_id 聚合更新）
- todo_update — Todo 看板整体替换
- subagent_progress — 子 agent 任务（scope_id 聚合）
- title_generated — 会话标题就绪（侧栏刷新）
*/

import type { CodingMessage, MessagePart, PermissionAction, ToolCard, ToolDisplayType } from './types';

export type CustomEventContext = {
    /** 当前流式 assistant 消息（须为 reactive 对象） */
    message: CodingMessage;
    /** session_id 首次出现时回调（记录会话） */
    onSessionId?: (sessionId: string) => void;
    /** title_generated：本地 patch 会话标题 */
    onTitleGenerated?: (sessionId: string, title: string) => void;
    /** 写盘类工具成功落定（文件树实时刷新的信号源） */
    onFileMutated?: (toolName: string) => void;
};

/** 会改动文件系统的工具（其余 read/grep/glob/list 只读免刷）。 */
const FILE_MUTATING_TOOLS = new Set(['write', 'edit', 'bash']);

/**
 * 正文增量：content 镜像追加 + parts 尾部 text part 续写
 * （尾部非 text 则新开一块，保住与工具卡的时序交织）。
 */
export const appendTextPart = (message: CodingMessage, text: string) => {
    if (!text) return;
    message.content = `${message.content || ''}${text}`;
    const last = message.parts[message.parts.length - 1];
    if (last && last.kind === 'text') {
        last.text += text;
        return;
    }
    message.parts.push({ kind: 'text', text });
};

/**
 * 工具卡 upsert：toolCards 聚合 + parts 同步（tool part 持 card 同引用，
 * 后续 Object.assign 更新自动反映到渲染）。新卡 push 到 parts 尾部。
 */
export const upsertToolCard = (
    message: CodingMessage,
    card: Partial<ToolCard> & { tool_call_id: string }
) => {
    // 剔除 undefined 值：digest 事件序列（running → 终态）中未携带的
    // 字段不应抹掉先前已写入的值（如 bash 卡的 command/stdout_tail）
    const patch = Object.fromEntries(
        Object.entries(card).filter(([, value]) => value !== undefined)
    ) as Partial<ToolCard> & { tool_call_id: string };
    const existing = message.toolCards.find((item) => item.tool_call_id === patch.tool_call_id);
    if (existing) {
        Object.assign(existing, patch);
        return;
    }
    const created: ToolCard = {
        display_type: 'tool_progress',
        status: 'running',
        tool_name: '',
        title: '',
        ...patch
    };
    message.toolCards.push(created);
    message.parts.push({ kind: 'tool', card: created } satisfies MessagePart);
};

const upsertPermission = (message: CodingMessage, payload: Record<string, unknown>) => {
    const request = {
        request_id: String(payload.request_id || ''),
        session_id: String(payload.session_id || ''),
        permission: String(payload.permission || ''),
        pattern: String(payload.pattern || '*'),
        patterns: (payload.patterns as string[] | undefined)?.filter(Boolean) ?? [],
        always_patterns: (payload.always_patterns as string[] | undefined)?.filter(Boolean) ?? [],
        tool_name: String(payload.tool_name || ''),
        tool_call_id: String(payload.tool_call_id || ''),
        tool_args: (payload.tool_args as Record<string, unknown>) || {}
    };
    if (!request.request_id) return;
    if (message.pendingPermissions.some((item) => item.request_id === request.request_id)) return;
    message.pendingPermissions.push(request);
};

export const handleCustomEvent = (
    customType: string | null | undefined,
    customData: Record<string, unknown> | null | undefined,
    ctx: CustomEventContext
) => {
    if (!customType || !customData) return;
    const message = ctx.message;

    switch (customType) {
        case 'permission_request': {
            if (customData.session_id) ctx.onSessionId?.(String(customData.session_id));
            upsertPermission(message, customData);
            break;
        }
        case 'permission_resolved': {
            const requestId = String(customData.request_id || '');
            const action = String(customData.action || '') as PermissionAction;
            const pending = message.pendingPermissions.find((item) => item.request_id === requestId);
            if (pending) pending.resolved = action;
            break;
        }
        case 'tool_digest': {
            const status = (customData.status as ToolCard['status']) || undefined;
            const toolName = customData.tool_name ? String(customData.tool_name) : undefined;
            // 写盘类工具成功：文件系统已变动，通知宿主刷新文件树
            // （run 进行中的实时信号；run 结束另有一轮兜底刷新）
            if (status === 'success' && toolName && FILE_MUTATING_TOOLS.has(toolName)) {
                ctx.onFileMutated?.(toolName);
            }
            upsertToolCard(message, {
                tool_call_id: String(customData.tool_call_id || ''),
                tool_name: toolName || undefined,
                display_type: customData.display_type as ToolDisplayType | undefined,
                status: (customData.status as ToolCard['status']) || undefined,
                title: customData.title ? String(customData.title) : undefined,
                path: (customData.path as string | undefined) ?? undefined,
                diff: (customData.diff as string | undefined) ?? undefined,
                command: (customData.command as string | undefined) ?? undefined,
                exit_code: (customData.exit_code as number | undefined) ?? undefined,
                stdout_tail: (customData.stdout_tail as string | undefined) ?? undefined,
                pattern: (customData.pattern as string | undefined) ?? undefined,
                result_count: (customData.result_count as number | undefined) ?? undefined,
                results_preview: (customData.results_preview as string[] | undefined) ?? undefined,
                file_text: (customData.file_text as string | undefined) ?? undefined,
                line_start: (customData.line_start as number | undefined) ?? undefined,
                line_end: (customData.line_end as number | undefined) ?? undefined,
                total_lines: (customData.total_lines as number | undefined) ?? undefined,
                content_truncated: (customData.content_truncated as boolean | undefined) ?? undefined,
                note: (customData.note as string | undefined) ?? undefined
            });
            break;
        }
        case 'todo_update': {
            const todos = customData.todos as CodingMessage['todos'] | undefined;
            if (Array.isArray(todos)) message.todos = todos;
            break;
        }
        case 'subagent_progress': {
            const scopeId = String(customData.scope_id || '');
            if (!scopeId) break;
            const task = {
                scope_id: scopeId,
                label: String(customData.label || '子任务'),
                status: (customData.status as CodingMessage['subagentTasks'][number]['status']) || 'started',
                summary: String(customData.summary || '')
            };
            const existing = message.subagentTasks.find((item) => item.scope_id === scopeId);
            if (existing) Object.assign(existing, task);
            else message.subagentTasks.push(task);
            break;
        }
        case 'title_generated': {
            const sessionId = String(customData.session_id || '');
            const title = String(customData.title || '');
            if (sessionId && title) ctx.onTitleGenerated?.(sessionId, title);
            break;
        }
        default:
            break;
    }
};
