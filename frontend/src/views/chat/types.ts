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

export type ChatMessage = {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  todoCard?: any;
  a2uiCards?: any[];
  materialCards?: MaterialCard[];
  isStreaming?: boolean;
  elapsed?: number;
  agentTitle?: string;
  createdAt?: string;
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
