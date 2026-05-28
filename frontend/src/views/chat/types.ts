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

export type ChatMessage = {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  todoCard?: any;
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
