import type { Component } from 'vue';

export type AgentOption = {
  id: string;
  backendAgentId: string;
  title: string;
  desc: string;
  badge: string;
  icon: Component;
  tone: string;
  examples: string[];
};

export type TodoStep = {
  id: string;
  text: string;
  status: 'completed' | 'in_progress' | 'pending' | 'blocked';
};

export type OutlineItem = {
  page: string;
  type: string;
  title: string;
  subtitle?: string;
  bullets?: string[];
  visual?: string;
};

export type SelectionOption = {
  id: string;
  title: string;
  description: string;
  icon: string;
  features: string[];
};

export type MaterialCard = {
  kind: 'selection' | 'redirect' | 'outline' | 'ppt_preview' | 'word_preview' | 'docgen_word_editor' | 'download';
  toolName: string;
  data: any;
};

/** Research Loop 过程摘要卡（frontend_digest display_type=research_trace）。 */
export type ResearchTrace = {
  id: number;
  toolName: string;
  /** 研究轮次（collect 批次号），前端按此分组展示「第 N 轮」。 */
  turn: number;
  /** 阶段：plan / collect / evaluate / finalize。 */
  phase: string;
  title: string;
  content: string;
};

export type ChatMessage = {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  todoCard?: any;
  a2uiCards?: any[];
  materialCards?: MaterialCard[];
  researchTraces?: ResearchTrace[];
  isStreaming?: boolean;
  elapsed?: number;
  agentTitle?: string;
  createdAt?: string;
};

/** SSE 事件分类（用于运行日志的结构化展示与着色）。 */
export type SseLogCategory =
  | 'lifecycle'
  | 'tool'
  | 'text'
  | 'step'
  | 'digest'
  | 'snapshot'
  | 'error'
  | 'other';

/** 一条 SSE 事件的结构化日志条目。 */
export type SseLogEntry = {
  id: number;
  seq: number;
  type: string;
  category: SseLogCategory;
  ts: string;
  summary: string;
  detail?: string;
  raw: any;
};

export type ScopeGroup = {
  id: 'public' | 'owner' | 'personal';
  title: string;
  libraries: ScopeLibrary[];
};

export type ScopeLibrary = {
  id: string;
  name: string;
  tags: Array<{ id: string; name: string; children?: Array<{ id: string; name: string }> }>;
  files: Array<{ id: string; name: string; tagId?: string }>;
};

export type ScopeBadge = {
  key: string;
  text: string;
  libraryId: string;
  kind: 'library' | 'file';
  fileId?: string;
};
