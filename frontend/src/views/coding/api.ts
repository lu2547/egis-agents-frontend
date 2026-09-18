/** egis-opencode REST 封装（/api/coding 前缀，经 vite proxy → :38083）。 */

import type {
    CommandInfo,
    FileContentResponse,
    FileTreeResponse,
    HistoryMessage,
    PermissionAction,
    PermissionRequest,
    ProjectStatus,
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

/** 用户 workspace 项目列表（含 git 状态）。 */
export const listProjects = (userId: string) =>
    request<ProjectStatus[]>(`/workspaces?user_id=${encodeURIComponent(userId)}`);

/** 克隆远程仓库到用户 workspace。 */
export const cloneProject = (userId: string, repoUrl: string, branch?: string) =>
    request<ProjectStatus>('/workspaces/clone', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, repo_url: repoUrl, branch })
    });

/** 校验并绑定/解绑会话工作目录（local:<绝对路径>；空串解绑）。 */
export const bindWorkspace = (
    userId: string,
    workspaceRoot: string,
    sessionId?: string
) =>
    request<WorkspaceBinding>('/workspaces/bind', {
        method: 'POST',
        body: JSON.stringify({
            user_id: userId,
            session_id: sessionId || undefined,
            workspace_root: workspaceRoot
        })
    });

/** 会话当前的工作目录绑定（空串 = 多租户模式）。 */
export const getWorkspaceBinding = (sessionId: string) =>
    request<WorkspaceBinding>(
        `/workspaces/binding?session_id=${encodeURIComponent(sessionId)}`
    );

/** slash 命令列表（工作目录下的 .opencode/commands / .claude/commands）。 */
export const listCommands = (userId: string, workspaceRoot = '') =>
    request<CommandInfo[]>(
        `/commands?user_id=${encodeURIComponent(userId)}` +
        (workspaceRoot ? `&workspace_root=${encodeURIComponent(workspaceRoot)}` : '')
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
