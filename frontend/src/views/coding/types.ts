/** Coding Agent 前端模型 — 与 egis-opencode 后端契约一一对应。 */

/** 模式标识：值由后端 agents/<agent>/agent.json 驱动（build / plan / wiki…）。 */
export type CodingMode = string;

/** GET /api/coding/agents 的 mode 条目（agent.json modes + available 实时状态）。 */
export type AgentModeInfo = {
    mode: CodingMode;
    agent_id: string;
    name: string;
    description: string;
    /** 只读模式（如 plan）：不落盘、无写审批 */
    readonly?: boolean;
    /** 该 agent 是否已在后端 registry 注册（false 时 chat 会拒绝） */
    available?: boolean;
};

/** tool_digest.status — 工具执行状态 */
export type ToolCardStatus = 'pending' | 'running' | 'success' | 'error' | 'denied';

/** tool_digest.display_type — 前端卡片形态 */
export type ToolDisplayType = 'tool_progress' | 'file_edit' | 'bash' | 'search' | 'task';

/** 工具过程卡片（tool_digest 事件按 tool_call_id 聚合更新） */
export type ToolCard = {
    tool_call_id: string;
    tool_name: string;
    display_type: ToolDisplayType;
    status: ToolCardStatus;
    title: string;
    /** file_edit */
    path?: string | null;
    diff?: string | null;
    /** bash */
    command?: string | null;
    exit_code?: number | null;
    stdout_tail?: string | null;
    /** search */
    pattern?: string | null;
    result_count?: number | null;
    /** 结果预览（glob 文件名 / read 内容行 / list 目录项 / grep 命中行） */
    results_preview?: string[] | null;
    /** read 完整内容（对齐 opencode metadata.display：卡片可展示模型读到的全部内容） */
    file_text?: string | null;
    line_start?: number | null;
    line_end?: number | null;
    total_lines?: number | null;
    content_truncated?: boolean | null;
    /** 通用备注 */
    note?: string | null;
};

/** 权限应答动作 */
export type PermissionAction = 'once' | 'always' | 'reject';

/** 权限审批请求（permission_request 事件 / pending 轮询） */
export type PermissionRequest = {
    request_id: string;
    session_id: string;
    permission: string;
    pattern: string;
    /** 待审批的 pattern 全集（bash 复合命令 → 每条子命令文本，同 opencode patterns） */
    patterns?: string[];
    /** "总是允许" 记忆的 pattern（bash → 命令前缀 + " *"，如 git checkout *） */
    always_patterns?: string[];
    tool_name: string;
    tool_call_id: string;
    tool_args: Record<string, unknown>;
    /** 落定态（permission_resolved 事件或本地应答后标记） */
    resolved?: PermissionAction | 'timeout';
};

/** todo_update.todos 条目 */
export type TodoItem = {
    id: string;
    content: string;
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    activeForm: string;
};

/** subagent_progress 条目（scope_id 聚合） */
export type SubagentTask = {
    scope_id: string;
    label: string;
    status: 'started' | 'finished' | 'failed';
    summary: string;
};

/** 消息块：text/tool 按到达时序交织（对齐 opencode parts 渲染语义） */
export type MessagePart =
    | { kind: 'text'; text: string }
    | { kind: 'tool'; card: ToolCard };

/**
 * 会话消息。parts 为渲染真相源（正文与工具卡按时序穿插）；
 * content/toolCards 作为聚合镜像保留（耗时提示、兼容判断用）。
 */
export type CodingMessage = {
    id: number;
    role: 'user' | 'assistant';
    content: string;
    reasoning?: string;
    parts: MessagePart[];
    toolCards: ToolCard[];
    pendingPermissions: PermissionRequest[];
    todos: TodoItem[];
    subagentTasks: SubagentTask[];
    isStreaming?: boolean;
    elapsed?: number;
};

/** GET /api/coding/sessions 条目 */
export type SessionMeta = {
    session_id: string;
    title: string;
    updated_at: string;
    model?: string;
    total_tokens?: number;
};

/** GET /api/coding/sessions/{id}/messages 条目（后端渲染的回放结构） */
export type HistoryMessage = {
    role: string;
    content: string;
    tool_calls?: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
    tool_results?: Array<{
        tool_call_id: string;
        content: string;
        is_error: boolean;
        llm_digest: string;
    }>;
    thinking?: string;
};

/** GET /api/coding/workspaces 条目 */
export type ProjectStatus = {
    name: string;
    path: string;
    is_git_repo: boolean;
    branch: string;
    head_short: string;
    dirty_files: number;
    untracked_files: number;
};

/** 工作目录绑定（bind/binding/default 端点响应）*/
export type WorkspaceBinding = {
    /** "" = 多租户模式；"local:<绝对路径>" = 本地目录锁定 */
    workspace_root: string;
    status: ProjectStatus | null;
    /** 当前 root 是否服务端 .env 默认（非用户显式绑定）：
     * 默认目录仅展示，chat 不携带 workspace_root，后端每轮解析 */
    is_default?: boolean;
};

/** GET /api/coding/commands 条目（slash 命令） */
export type CommandInfo = {
    name: string;
    description: string;
};

/** 文件树节点（path 相对工作目录根；目录 children=null 表示未加载） */
export type FileNode = {
    name: string;
    path: string;
    type: 'dir' | 'file';
    size?: number;
    children?: FileNode[] | null;
};

/** GET /api/coding/workspaces/tree 响应 */
export type FileTreeResponse = {
    nodes: FileNode[];
    truncated: boolean;
};

/** GET /api/coding/workspaces/file 响应（预览；binary=二进制占位） */
export type FileContentResponse = {
    path: string;
    content: string;
    size: number;
    truncated: boolean;
    binary?: boolean;
};
