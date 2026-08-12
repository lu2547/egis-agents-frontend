/** egis-knowledge 后端 API client（/api/knowledge 前缀，vite proxy → 48082）。 */

const BASE = '/api/knowledge';

export interface Library {
    id_library: string;
    name: string;
    owner_type: 'personal' | 'owner';
    sub_type: 'doc' | 'knowledge' | 'experience';
    owner: string;
    description: string;
    chunking_config: Record<string, any>;
    collection_name: string;
    created_at: string;
}

export interface Tag {
    id_tag: string;
    name: string;
    id_library: string;
    parent_id_tag: string;
    sort: number;
    doc_count?: number;
    doc_count_all?: number;
}

export interface KnowledgeDocument {
    id_document: string;
    id_library: string;
    file_name: string;
    file_type: string;
    file_size: number;
    parse_status: string;
    error_message: string;
    description: string;
    id_tag: string;
    created_at: string;
    metadata?: Record<string, any>;
}

export interface Experience {
    id_experience: string;
    id_library: string;
    category: string;
    question: string;
    reasoning_path: string;
    reference_doc_path: string;
    output_format: string;
    created_at: string;
}

export interface QueryHit {
    chunk_id: string;
    document_id: string;
    file_name: string;
    channel: string;
    score: number;
    chunk_index: number;
    snippet: string;
    block?: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const resp = await fetch(`${BASE}${path}`, init);
    if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.detail ? String(body.detail) : `HTTP ${resp.status}`);
    }
    if (resp.status === 204) return undefined as T;
    return resp.json() as Promise<T>;
}

const json = (body: any) => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
});

// ── 分块方法 ──
export interface ChunkParamSpec {
    name: string;
    label: string;
    type: 'int' | 'select';
    default: any;
    desc: string;
    options: string[];
}

export interface ChunkMethodSpec {
    method: string;
    label: string;
    params: ChunkParamSpec[];
}

export const fetchChunkMethods = () =>
    request<{ methods: ChunkMethodSpec[]; default: string }>('/chunk-methods');

// ── 库 ──
export const listLibraries = (ownerType?: string) =>
    request<Library[]>(`/libraries${ownerType ? `?owner_type=${ownerType}` : ''}`);

export const createLibrary = (body: Partial<Library>) =>
    request<Library>('/libraries', json(body));

export const deleteLibrary = (id: string) =>
    request<void>(`/libraries/${id}`, { method: 'DELETE' });

// ── 目录 ──
export const listTags = (libId: string) => request<Tag[]>(`/libraries/${libId}/tags`);

export const createTag = (libId: string, name: string, parentId = '') =>
    request<Tag>(`/libraries/${libId}/tags`, json({ name, parent_id: parentId }));

export const deleteTag = (tagId: string) =>
    request<void>(`/tags/${tagId}`, { method: 'DELETE' });

// ── 文档 ──
export const listDocuments = (libId: string, tagId?: string) =>
    request<KnowledgeDocument[]>(
        `/libraries/${libId}/documents${tagId ? `?id_tag=${tagId}` : ''}`
    );

export const uploadDocument = (
    libId: string,
    file: File,
    tagId: string,
    chunkingConfig: Record<string, any>
) => {
    const form = new FormData();
    form.append('file', file);
    form.append('id_tag', tagId);
    form.append('chunking_config', JSON.stringify(chunkingConfig));
    return request<KnowledgeDocument>(`/libraries/${libId}/upload`, {
        method: 'POST',
        body: form
    });
};

export interface KnowledgeChunk {
    id_chunk: string;
    id_document: string;
    content: string;
    chunk_index: number;
}

export const listChunks = (docId: string) =>
    request<KnowledgeChunk[]>(`/documents/${docId}/chunks`);

export const fetchDocumentMarkdown = (docId: string) =>
    request<{ markdown: string }>(`/documents/${docId}/markdown`);

export const docFileUrl = (docId: string) => `${BASE}/documents/${docId}/file`;

export const docAssetUrl = (docId: string, rel: string) =>
    `${BASE}/documents/${docId}/assets/${rel}`;

export const deleteDocument = (docId: string) =>
    request<void>(`/documents/${docId}`, { method: 'DELETE' });

export const moveDocument = (docId: string, tagId: string) =>
    request<KnowledgeDocument>(`/documents/${docId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_tag: tagId })
    });

export const retryDocument = (docId: string, chunkingConfig?: Record<string, any>) =>
    request<KnowledgeDocument>(`/documents/${docId}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chunking_config: chunkingConfig || {} })
    });

export const fetchDocument = (docId: string) =>
    request<KnowledgeDocument>(`/documents/${docId}`);

// ── 经验 ──
export const listExperiences = (libId: string, category?: string) =>
    request<Experience[]>(
        `/libraries/${libId}/experiences${category ? `?category=${category}` : ''}`
    );

export const createExperience = (libId: string, body: Partial<Experience>) =>
    request<Experience>(`/libraries/${libId}/experiences`, json(body));

export const deleteExperience = (expId: string) =>
    request<void>(`/experiences/${expId}`, { method: 'DELETE' });

export const importExperiences = (libId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<{ created: number; skipped: number }>(
        `/libraries/${libId}/experiences/import`,
        { method: 'POST', body: form }
    );
};

// ── 查询 ──
export const queryKnowledge = (body: {
    library_ids: string[];
    query: string;
    tag_ids?: string[];
    mode?: string;
    top_k?: number;
}) =>
    request<{ total: number; hits: QueryHit[] }>('/query', json(body));

// ── 评估（ragas）──
export interface EvalCase {
    id_case: string;
    id_library: string;
    question: string;
    ground_truth: string;
    category: string;
    source: 'manual' | 'auto';
    id_document: string;
    created_at: string;
}

export interface EvalRun {
    id_run: string;
    id_library: string;
    status: 'running' | 'done' | 'error';
    mode: string;
    top_k: number;
    summary: Record<string, any>;
    error_message: string;
    created_at: string;
    finished_at: string | null;
}

export interface EvalRetrieved {
    chunk_id: string;
    file_name: string;
    score: number;
    snippet: string;
    content: string;
}

export interface EvalResult {
    id_result: string;
    id_run: string;
    id_case: string;
    question: string;
    ground_truth: string;
    answer: string;
    scores: Record<string, number>;
    total_score: number;
    retrieved: EvalRetrieved[];
    error_message: string;
}

export interface EvalRunDetail extends EvalRun {
    results: EvalResult[];
}

export const listEvalCases = (libId: string) =>
    request<EvalCase[]>(`/libraries/${libId}/eval/cases`);

export const createEvalCase = (
    libId: string,
    body: { question: string; ground_truth?: string; category?: string }
) => request<EvalCase>(`/libraries/${libId}/eval/cases`, json(body));

export const deleteEvalCase = (caseId: string) =>
    request<void>(`/eval/cases/${caseId}`, { method: 'DELETE' });

export const generateEvalCases = (libId: string, count: number) =>
    request<{ created: number; requested: number }>(
        `/libraries/${libId}/eval/cases/generate`,
        json({ count })
    );

export const listEvalRuns = (libId: string) =>
    request<EvalRun[]>(`/libraries/${libId}/eval/runs`);

export const startEvalRun = (libId: string, mode: string, topK: number) =>
    request<EvalRun>(`/libraries/${libId}/eval/runs`, json({ mode, top_k: topK }));

export const getEvalRun = (runId: string) =>
    request<EvalRunDetail>(`/eval/runs/${runId}`);
