import { createRouter, createWebHistory } from 'vue-router';
import HomeView from './views/HomeView.vue';
import ChatView from './views/ChatView.vue';
import KnowledgeView from './views/KnowledgeView.vue';
import LearningView from './views/LearningView.vue';
import PlaygroundView from './views/PlaygroundView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/chat', name: 'chat', component: ChatView },
    { path: '/knowledge', name: 'knowledge', component: KnowledgeView },
    { path: '/learning', name: 'learning', component: LearningView },
    { path: '/playground', name: 'playground', component: PlaygroundView }
  ]
});
