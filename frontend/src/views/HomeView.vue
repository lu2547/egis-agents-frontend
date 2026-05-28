<script setup lang="ts">
import {
  ChatBubbleHelpIcon,
  ChevronRightIcon,
  EducationIcon,
  FileWordIcon,
  UserSafetyIcon
} from 'tdesign-icons-vue-next';
import type { Component } from 'vue';

type WakeAgent = {
  id: string;
  title: string;
  desc: string;
  badge: string;
  icon: Component;
  tone: string;
};

const wakeCards: WakeAgent[] = [
  {
    id: 'general-qa',
    title: '智能问答',
    desc: '政策制度、产品规则随问随答',
    badge: 'Hot',
    icon: ChatBubbleHelpIcon,
    tone: 'qa'
  },
  {
    id: 'annuity-business',
    title: '年金业务助手',
    desc: '方案、纪要、话术一键成稿',
    badge: 'New',
    icon: FileWordIcon,
    tone: 'doc'
  },
  {
    id: 'it-qa',
    title: 'IT智能问答',
    desc: '课程、测验、课件快速编排',
    badge: 'New',
    icon: EducationIcon,
    tone: 'train'
  },
  {
    id: 'consumer-protection',
    title: '消保智能问答',
    desc: '风险提示、适当性与留痕检查',
    badge: 'New',
    icon: UserSafetyIcon,
    tone: 'safe'
  }
];
</script>

<template>
  <section class="content-grid">
    <div class="main-column">
      <section class="panel wake-panel">
        <div class="section-heading">
          <div>
            <h1>
              一键唤醒
              <span class="agent-title">
                养老险Agent
                <i class="ai-spark" aria-hidden="true"></i>
              </span>
            </h1>
          </div>
          <button class="text-button" type="button">
            更多
            <ChevronRightIcon />
          </button>
        </div>
        <div class="wake-grid">
          <RouterLink
            v-for="card in wakeCards"
            :key="card.title"
            class="wake-card"
            :class="`tone-${card.tone}`"
            :to="{ path: '/chat', query: { agent: card.id } }"
          >
            <div class="card-icon">
              <component :is="card.icon" />
            </div>
            <div>
              <strong>{{ card.title }}</strong>
              <span>{{ card.badge }}</span>
            </div>
            <p>{{ card.desc }}</p>
          </RouterLink>
        </div>
      </section>
    </div>

    <aside class="quick-panel">
      <div class="playground-banner">
        <div class="banner-copy">
          <div class="banner-kicker">
            <span>Playground功能</span>
            <em>平民版Agent开发</em>
          </div>
          <strong>即将上线，尽情期待</strong>
        </div>
      </div>
    </aside>
  </section>
</template>
