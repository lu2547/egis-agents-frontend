/** egis-opencode REST 封装（/api/coding 前缀，经 vite proxy → :38083）。 */

import type {
    AgentModeInfo,
    CommandInfo,
    FileContentResponse,
    FileTreeResponse,
    HistoryMessage,
    PermissionAction,
    PermissionRequest,
    SessionMeta,
    WorkspaceBinding
} from './types';

const BASE = '/api/coding';

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(`${BASE}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...init
    });
    if (!response.ok) {
        // detail JSON（FastAPI HTTPException）提取干净文案，避免堆原始 JSON
        const raw = await response.text().catch(() => '');
        let detail = raw;
        try {
            detail = JSON.parse(raw)?.detail || raw;
        } catch {
            /* 非 JSON 体原样展示 */
        }
        throw new Error(`HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
    }
    return (await response.json()) as T;
};

/** 会话列表（title 缺省回落首条用户消息截断）。 */
export const listSessions = (userId: string) =>
    request<SessionMeta[]>(`/sessions?user_id=${encodeURIComponent(userId)}`);

/** 会话历史（后端渲染为可回放结构）。 */
export const loadSessionMessages = (sessionId: string, userId: string) =>
    request<HistoryMessage[]>(
        `/sessions/${encodeURIComponent(sessionId)}/messages?user_id=${encodeURIComponent(userId)}`
    );

/** 删除会话（服务端顺带清理标题与挂起权限请求）。 */
export const deleteSession = (sessionId: string, userId: string) =>
    request<{ session_id: string; deleted: boolean }>(
        `/sessions/${encodeURIComponent(sessionId)}?user_id=${encodeURIComponent(userId)}`,
        { method: 'DELETE' }
    );

/** 某会话未落定的权限请求（SSE 断线时的轮询兜底）。 */
export const pendingPermissions = (sessionId: string) =>
    request<PermissionRequest[]>(
        `/permissions/pending?session_id=${encodeURIComponent(sessionId)}`
    );

/** 用户应答：once（允许一次）/ always（本次 run 内总是允许）/ reject。 */
export const respondPermission = (requestId: string, action: PermissionAction) =>
    request<{ action: PermissionAction }>(
        `/permissions/${encodeURIComponent(requestId)}/respond`,
        { method: 'POST', body: JSON.stringify({ action }) }
    );

/** 取消进行中的 run（fetch abort 的服务端对位）。 */
export const abortChat = (sessionId: string) =>
    request<{ session_id: string; aborted: boolean }>('/chat/abort', {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId })
    });

/** 会话当前的工作目录绑定（显式绑定 > .env 默认 > 空串多租户）。 */
export const getWorkspaceBinding = (sessionId: string) =>
    request<WorkspaceBinding>(
        `/workspaces/binding?session_id=${encodeURIComponent(sessionId)}`
    );

/** 服务端默认工作目录（.env CODING_DEFAULT_WORKSPACE_*；空串=未配置）。 */
export const getWorkspaceDefault = () =>
    request<WorkspaceBinding>('/workspaces/default');

/** agent 模式列表（agents/<agent>/agent.json 聚合，后端多 agent 注册即扩充）。 */
export const getAgents = () =>
    request<{ modes: AgentModeInfo[] }>('/agents');

/** slash 命令列表（agent 内置 commands + 工作目录 .opencode/commands）。 */
export const listCommands = (userId: string, workspaceRoot = '', agentId = '') =>
    request<CommandInfo[]>(
        `/commands?user_id=${encodeURIComponent(userId)}` +
        (workspaceRoot ? `&workspace_root=${encodeURIComponent(workspaceRoot)}` : '') +
        (agentId ? `&agent_id=${encodeURIComponent(agentId)}` : '')
    );

/** 工作目录文件树（限深；目录 children=null 懒加载）。 */
export const listWorkspaceTree = (
    userId: string,
    workspaceRoot: string,
    path = '',
    depth = 2
) =>
    request<FileTreeResponse>(
        `/workspaces/tree?user_id=${encodeURIComponent(userId)}` +
        `&workspace_root=${encodeURIComponent(workspaceRoot)}` +
        `&path=${encodeURIComponent(path)}&depth=${depth}`
    );

/** 读工作目录内文件做预览（utf-8；超限截断；二进制拒绝）。 */
export const readWorkspaceFile = (
    userId: string,
    workspaceRoot: string,
    path: string
) =>
    request<FileContentResponse>(
        `/workspaces/file?user_id=${encodeURIComponent(userId)}` +
        `&workspace_root=${encodeURIComponent(workspaceRoot)}` +
        `&path=${encodeURIComponent(path)}`
    );

/** 健康检查（启动横幅 / 连接诊断）。 */
export const checkHealth = () => request<{ status: string }>('/health');
