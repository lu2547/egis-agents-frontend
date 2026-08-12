/**
 * Playground 配置 / 资产 API 封装。
 *
 * 后端路由（egis-training-agent，端口 48081，经 vite 代理 /api/playground）：
 * - GET  /api/playground/config  当前配置（含各 MCP server 运行状态）
 * - PUT  /api/playground/config  整体更新配置并立即热更新到 agent
 * - GET  /api/playground/assets  工具池 / 技能 / MCP server 清单
 */

export type MCPTransport = 'streamable_http';

/** MCP server 远端工具信息（后端 status()/assets 返回的对象结构）。 */
export interface MCPToolInfo {
    name: string;
    description: string;
    /** JSON Schema（含 properties/required），用于展开参数详情。 */
    input_schema?: Record<string, any>;
}

/** PUT 时提交的 MCP server 声明。 */
export interface MCPServerSpec {
    id: string;
    url: string;
    transport: MCPTransport;
    enabled: boolean;
}

/** GET 返回的 MCP server 运行时视图（含连接状态与远端工具）。 */
export interface MCPServerView extends MCPServerSpec {
    status: 'connected' | 'error' | 'pending' | 'disabled';
    error?: string | null;
    tools: MCPToolInfo[];
}

export interface ToolAsset {
    name: string;
    description: string;
    group: string;
    source: 'local' | 'mcp';
    enabled: boolean;
}

export interface SkillAsset {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
}

/** 技能目录树（GET /skills/{id}/detail）。 */
export interface SkillDetail {
    id: string;
    name: string;
    description: string;
    root: string;
    files: { path: string; size: number }[];
}

/** 技能内文件内容（GET /skills/{id}/file）。 */
export interface SkillFile {
    path: string;
    size: number;
    content: string;
    truncated: boolean;
}

/** data/files/ 下的已上传文件（GET /files）。 */
export interface UploadedFile {
    name: string;
    size: number;
    mtime: number;
    abs_path: string;
}

export interface PlaygroundAssets {
    tools: ToolAsset[];
    skills: SkillAsset[];
    mcp_servers: MCPServerView[];
}

/** 知识库资料范围（与 egis-knowledge 真实库/标签/文档对齐）。 */
export interface KnowledgeScope {
    enabled: boolean;
    library_ids: string[];
    tag_ids: string[];
    document_ids: string[];
}

/** PUT /config 的请求体。enabled_tools / enabled_skills 为 null 表示全部放行。 */
export interface PlaygroundConfigPayload {
    system_prompt: string;
    enabled_tools: string[] | null;
    enabled_skills: string[] | null;
    mcp_servers: MCPServerSpec[];
    knowledge: KnowledgeScope;
    research_enabled: boolean;
}

/** GET /config 的返回体。 */
export interface PlaygroundConfig extends PlaygroundConfigPayload {
    mcp_servers: MCPServerView[];
}

const json = async <T>(resp: Response): Promise<T> => {
    if (!resp.ok) {
        let detail = `HTTP ${resp.status}`;
        try {
            const body = await resp.json();
            detail = body?.detail || detail;
        } catch {
            /* ignore */
        }
        throw new Error(detail);
    }
    return resp.json() as Promise<T>;
};

export const fetchPlaygroundConfig = (): Promise<PlaygroundConfig> =>
    fetch('/api/playground/config').then((r) => json<PlaygroundConfig>(r));

export const fetchPlaygroundAssets = (): Promise<PlaygroundAssets> =>
    fetch('/api/playground/assets').then((r) => json<PlaygroundAssets>(r));

export const putPlaygroundConfig = (payload: PlaygroundConfigPayload): Promise<PlaygroundConfig> =>
    fetch('/api/playground/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }).then((r) => json<PlaygroundConfig>(r));

export const fetchSkillDetail = (skillId: string): Promise<SkillDetail> =>
    fetch(`/api/playground/skills/${encodeURIComponent(skillId)}/detail`).then((r) => json<SkillDetail>(r));

export const fetchSkillFile = (skillId: string, path: string): Promise<SkillFile> =>
    fetch(
        `/api/playground/skills/${encodeURIComponent(skillId)}/file?path=${encodeURIComponent(path)}`
    ).then((r) => json<SkillFile>(r));

export const fetchUploadedFiles = (): Promise<{ files: UploadedFile[] }> =>
    fetch('/api/playground/files').then((r) => json<{ files: UploadedFile[] }>(r));

export const uploadPlaygroundFile = async (file: File): Promise<UploadedFile> => {
    const form = new FormData();
    form.append('file', file);
    const resp = await fetch('/api/playground/files', { method: 'POST', body: form });
    return json<UploadedFile>(resp);
};

export const deleteUploadedFile = async (name: string): Promise<void> => {
    const resp = await fetch(`/api/playground/files/${encodeURIComponent(name)}`, { method: 'DELETE' });
    await json<{ deleted: string }>(resp);
};
