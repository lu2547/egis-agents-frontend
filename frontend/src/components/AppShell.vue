<script setup lang="ts">
import {
  AddressBookIcon,
  ChatBubbleSmileIcon,
  EducationIcon,
  ExploreIcon,
  HomeIcon,
  LayersIcon,
  LogoGithubIcon,
  SearchIcon,
  UserCircleIcon
} from 'tdesign-icons-vue-next';
import { useRoute } from 'vue-router';

const route = useRoute();

const navItems = [
  { label: '首页', icon: HomeIcon, to: '/' },
  { label: '对话', icon: ChatBubbleSmileIcon, to: '/chat' },
  { label: '知识库', icon: AddressBookIcon, to: '/knowledge' },
  { label: '学习', icon: EducationIcon, to: '/learning' },
  { label: 'Playground', icon: ExploreIcon, to: '/playground' }
];
</script>

<template>
  <div class="shell">
    <aside class="nav-rail">
      <div class="brand">
        <span class="brand-main">养老险GPT</span>
        <span class="brand-badge">智颐通</span>
      </div>
      <RouterLink
        v-for="item in navItems"
        :key="item.label"
        :to="item.to"
        class="nav-item"
        :class="{ active: route.path === item.to }"
      >
        <component :is="item.icon" />
        <span>{{ item.label }}</span>
      </RouterLink>
    </aside>

    <main class="workspace">
      <header class="topbar">
        <div class="search-box">
          <input value="企业年金培训" aria-label="搜索" />
          <SearchIcon />
        </div>
        <div class="top-actions">
          <button type="button" class="icon-button" aria-label="应用">
            <LayersIcon />
          </button>
          <button type="button" class="icon-button" aria-label="代码仓库">
            <LogoGithubIcon />
          </button>
          <button type="button" class="profile-button">
            <UserCircleIcon />
            <span>路洋</span>
          </button>
        </div>
      </header>

      <RouterView />
    </main>
  </div>
</template>
