import { createRouter, createWebHistory } from 'vue-router';
import HomeView from './views/HomeView.vue';
import CodingView from './views/coding/CodingView.vue';
import KnowledgeView from './views/KnowledgeView.vue';
import LearningView from './views/LearningView.vue';
import PlaygroundView from './views/PlaygroundView.vue';
import LoginView from './views/LoginView.vue';
// ChatView 保留为历史参考（Knowledge/Playground 仍用 chat/useChat.ts），
// /chat 路由已指向 coding/CodingView.vue（egis-opencode 后端）。

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginView, meta: { layout: 'bare' } },
    { path: '/', name: 'home', component: HomeView },
    { path: '/chat', name: 'chat', component: CodingView },
    { path: '/knowledge', name: 'knowledge', component: KnowledgeView },
    { path: '/learning', name: 'learning', component: LearningView },
    { path: '/playground', name: 'playground', component: PlaygroundView }
  ]
});
