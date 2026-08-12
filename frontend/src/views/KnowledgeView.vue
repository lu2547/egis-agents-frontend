<script setup lang="ts">
import { ref } from 'vue';
import { FolderOpenIcon, SearchIcon, ChartAnalyticsIcon } from 'tdesign-icons-vue-next';
import KnowledgeManage from './knowledge/KnowledgeManage.vue';
import KnowledgeQuery from './knowledge/KnowledgeQuery.vue';
import KnowledgeEval from './knowledge/KnowledgeEval.vue';

type FeatureId = 'manage' | 'query' | 'eval';

const features: Array<{ id: FeatureId; label: string; desc: string; icon: any }> = [
  { id: 'manage', label: '知识管理', desc: '库管理 + 文档上传维护', icon: FolderOpenIcon },
  { id: 'query', label: '知识查询', desc: '关键字 + 语义混合召回', icon: SearchIcon },
  { id: 'eval', label: '知识评估', desc: 'ragas 召回质量评估', icon: ChartAnalyticsIcon }
];

const active = ref<FeatureId>('manage');
</script>

<template>
  <section class="kb-shell">
    <aside class="kb-sidebar">
      <div class="kb-sidebar-title">
        <span class="eyebrow blue">知识库</span>
        <p>企业养老险知识中台</p>
      </div>
      <button
        v-for="item in features"
        :key="item.id"
        type="button"
        class="kb-feature-item"
        :class="{ active: active === item.id }"
        @click="active = item.id"
      >
        <span class="kb-feature-icon">
          <component :is="item.icon" />
        </span>
        <span class="kb-feature-text">
          <strong>{{ item.label }}</strong>
          <em>{{ item.desc }}</em>
        </span>
      </button>
    </aside>

    <div class="kb-content">
      <KnowledgeManage v-if="active === 'manage'" />
      <KnowledgeQuery v-else-if="active === 'query'" />
      <KnowledgeEval v-else />
    </div>
  </section>
</template>

<style scoped>
.kb-shell {
  display: flex;
  gap: 14px;
  height: calc(100vh - 50px);
  padding: clamp(10px, 1.2vw, 16px);
  box-sizing: border-box;
}

.kb-sidebar {
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

.kb-sidebar-title p {
  margin-top: 2px;
  color: #667085;
  font-size: 13px;
}

.kb-feature-item {
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

.kb-feature-item:hover {
  background: #eef3ff;
}

.kb-feature-item.active {
  border-color: #b9cdff;
  background: linear-gradient(90deg, rgba(224, 236, 255, 0.9), rgba(242, 248, 255, 0.95));
  box-shadow: 0 8px 18px rgba(46, 99, 245, 0.12);
}

.kb-feature-icon {
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

.kb-feature-icon svg {
  width: 20px;
  height: 20px;
}

.kb-feature-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.kb-feature-text strong {
  color: #1f2733;
  font-size: 14px;
}

.kb-feature-text em {
  font-style: normal;
  color: #7b8495;
  font-size: 12px;
  line-height: 1.4;
}

.kb-content {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.kb-content > * {
  flex: 1 1 auto;
  min-height: 0;
}
</style>
