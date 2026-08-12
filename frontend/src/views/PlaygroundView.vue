<script setup lang="ts">
import { ref } from 'vue';
import { PreciseMonitorIcon, ChatBubbleHelpIcon, ControlPlatformIcon } from 'tdesign-icons-vue-next';
import AgenticAgentPanel from './playground/AgenticAgentPanel.vue';
import MeetingAssistantPanel from './playground/meeting/MeetingAssistantPanel.vue';

type FeatureId = 'agentic-agent' | 'meeting-assistant' | 'skills-creator';

const features: Array<{ id: FeatureId; label: string; desc: string; icon: any }> = [
  { id: 'agentic-agent', label: 'AgenticAgent', desc: '可实时调参的通用调试 Agent', icon: PreciseMonitorIcon },
  { id: 'meeting-assistant', label: 'MeetingAssistant', desc: '智能会议管理 · 预定/查询/取消 + 会议助手', icon: ChatBubbleHelpIcon },
  { id: 'skills-creator', label: 'SkillsCreator', desc: '技能可视化创建（即将上线）', icon: ControlPlatformIcon }
];

const active = ref<FeatureId>('agentic-agent');
</script>

<template>
  <section class="playground-shell">
    <aside class="pg-sidebar">
      <div class="pg-sidebar-title">
        <span class="eyebrow blue">Playground</span>
        <p>选择要使用的功能</p>
      </div>
      <button
        v-for="item in features"
        :key="item.id"
        type="button"
        class="pg-feature-item"
        :class="{ active: active === item.id }"
        @click="active = item.id"
      >
        <span class="pg-feature-icon">
          <component :is="item.icon" />
        </span>
        <span class="pg-feature-text">
          <strong>{{ item.label }}</strong>
          <em>{{ item.desc }}</em>
        </span>
      </button>
    </aside>

    <div class="pg-content">
      <AgenticAgentPanel v-if="active === 'agentic-agent'" />
      <MeetingAssistantPanel v-else-if="active === 'meeting-assistant'" />
      <div v-else class="pg-coming">
        <h2>{{ features.find((f) => f.id === active)?.label }} 即将上线</h2>
        <p>该功能正在开发中，敬请期待。</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.playground-shell {
  display: flex;
  gap: 14px;
  height: calc(100vh - 50px);
  padding: clamp(10px, 1.2vw, 16px);
  box-sizing: border-box;
}

.pg-sidebar {
  flex: 0 0 248px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px 12px;
  border: 1px solid #e7ebf2;
  border-radius: 10px;
  background: #ffffff;
  box-shadow: 0 12px 28px rgba(18, 32, 63, 0.06);
  overflow-y: auto;
}

.pg-sidebar-title p {
  margin-top: 2px;
  color: #667085;
  font-size: 13px;
}

.pg-feature-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  padding: 12px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: #f6f8fc;
  cursor: pointer;
  text-align: left;
  transition: all 0.16s ease;
}

.pg-feature-item:hover {
  background: #eef3ff;
}

.pg-feature-item.active {
  border-color: #b9cdff;
  background: linear-gradient(90deg, rgba(224, 236, 255, 0.9), rgba(242, 248, 255, 0.95));
  box-shadow: 0 8px 18px rgba(46, 99, 245, 0.12);
}

.pg-feature-icon {
  flex: 0 0 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 9px;
  background: #ffffff;
  color: #2e63f5;
}

.pg-feature-icon svg {
  width: 20px;
  height: 20px;
}

.pg-feature-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.pg-feature-text strong {
  color: #1f2733;
  font-size: 14px;
}

.pg-feature-text em {
  font-style: normal;
  color: #7b8495;
  font-size: 12px;
  line-height: 1.4;
}

.pg-content {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.pg-content > * {
  flex: 1 1 auto;
  min-height: 0;
}

.pg-coming {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 100%;
  border: 1px dashed #cdd8ee;
  border-radius: 12px;
  background: linear-gradient(90deg, rgba(224, 236, 255, 0.6), rgba(242, 248, 255, 0.7));
  color: #4a5568;
}

.pg-coming h2 {
  font-size: 20px;
  color: #2e63f5;
}
</style>
