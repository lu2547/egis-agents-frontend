import type { ChatMessage, TodoStep } from './types';

export const todoTitle = (msg: ChatMessage) =>
  msg.todoCard?.view?.title || msg.todoCard?.full?.minimal?.title || '正在规划执行路径';

export const todoSummary = (msg: ChatMessage) =>
  msg.todoCard?.view?.summary || msg.todoCard?.full?.minimal?.summary || '正在执行中';

export const getTodoSections = (msg: ChatMessage) => {
  const card = msg.todoCard;
  if (Array.isArray(card?.sections)) return card.sections;
  if (Array.isArray(card?.detailed?.sections)) return card.detailed.sections;
  if (Array.isArray(card?.full?.detailed?.sections)) return card.full.detailed.sections;
  return [];
};

const normalizeStatus = (status: string): TodoStep['status'] => {
  if (status === 'completed' || status === 'in_progress' || status === 'blocked') return status;
  return 'pending';
};

export const todoSteps = (msg: ChatMessage): TodoStep[] => {
  const sections = getTodoSections(msg);
  if (!sections.length) return [];
  const checklist = sections.find((section: any) => section.content_type === 'checklist');
  if (!Array.isArray(checklist?.data)) return [];
  return checklist.data.map((step: any, index: number) => ({
    id: String(step.id ?? index),
    text: String(step.text ?? step.description ?? step.title ?? '执行步骤'),
    status: normalizeStatus(step.status)
  }));
};

export const completedCount = (msg: ChatMessage) => todoSteps(msg).filter((step) => step.status === 'completed').length;

export const displayTodoSteps = (msg: ChatMessage): TodoStep[] => {
  const steps = todoSteps(msg);
  if (steps.length) return steps;
  if (msg.isStreaming) {
    return [{ id: 'planning', text: '正在生成执行计划', status: 'in_progress' }];
  }
  return [];
};

export const activeStepId = (msg: ChatMessage) => {
  const steps = displayTodoSteps(msg);
  for (let index = steps.length - 1; index >= 0; index -= 1) {
    if (steps[index].status === 'in_progress') return steps[index].id;
  }
  for (let index = steps.length - 1; index >= 0; index -= 1) {
    if (steps[index].status === 'completed') return steps[index].id;
  }
  return steps.at(-1)?.id || '';
};

export const finalizeTodoCard = (msg: ChatMessage) => {
  const sections = getTodoSections(msg);
  if (!sections.length) return;
  const checklist = sections.find((section: any) => section.content_type === 'checklist');
  if (!Array.isArray(checklist?.data)) return;
  const hasUnfinished = checklist.data.some((step: any) => step.status === 'blocked' || step.status === 'pending');
  if (hasUnfinished) return;
  let changed = false;
  checklist.data.forEach((step: any) => {
    if (step.status === 'in_progress') {
      step.status = 'completed';
      changed = true;
    }
  });
  if (!changed) return;
  const total = checklist.data.length;
  const completed = checklist.data.filter((step: any) => step.status === 'completed').length;
  if (msg.todoCard?.view) {
    msg.todoCard.view.summary = completed >= total ? `全部 ${total} 个步骤已完成` : `${completed}/${total} 个步骤已完成`;
    msg.todoCard.view.status = completed >= total ? 'success' : 'in_progress';
  }
};
