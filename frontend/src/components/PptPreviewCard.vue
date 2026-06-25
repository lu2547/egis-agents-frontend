<script setup lang="ts">
import { ref, computed } from 'vue';
import { ChevronLeftIcon, ChevronRightIcon } from 'tdesign-icons-vue-next';

export type PptSlide = {
  page: number;
  title: string;
  svgContent?: string;
  thumbnailUrl?: string;
};

const props = defineProps<{
  slides: PptSlide[];
  title?: string;
}>();

const currentIndex = ref(0);
const slideCount = computed(() => props.slides.length);

const currentSlide = computed(() => props.slides[currentIndex.value]);

const goTo = (index: number) => {
  if (index >= 0 && index < slideCount.value) {
    currentIndex.value = index;
  }
};

const goPrev = () => goTo(currentIndex.value - 1);
const goNext = () => goTo(currentIndex.value + 1);

const scrollToThumb = (index: number) => {
  currentIndex.value = index;
  const el = document.getElementById(`thumb-${index}`);
  el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
};
</script>

<template>
  <div class="ppt-preview-card">
    <header class="preview-header">
      <strong>{{ title || 'PPT 生成预览' }}</strong>
      <em>{{ currentIndex + 1 }} / {{ slideCount }}</em>
    </header>

    <!-- 主预览区 -->
    <div class="main-preview">
      <button
        v-if="currentIndex > 0"
        class="nav-btn prev"
        type="button"
        @click="goPrev"
      >
        <ChevronLeftIcon />
      </button>

      <div class="slide-stage">
        <div v-if="currentSlide?.svgContent" class="svg-wrap" v-html="currentSlide.svgContent"></div>
        <div v-else-if="currentSlide?.thumbnailUrl" class="img-wrap">
          <img :src="currentSlide.thumbnailUrl" :alt="currentSlide.title" />
        </div>
        <div v-else class="placeholder-slide">
          <div class="placeholder-page">P{{ currentSlide?.page || currentIndex + 1 }}</div>
          <div class="placeholder-title">{{ currentSlide?.title || '幻灯片' }}</div>
        </div>
        <div class="slide-label">{{ currentSlide?.title || `第 ${currentIndex + 1} 页` }}</div>
      </div>

      <button
        v-if="currentIndex < slideCount - 1"
        class="nav-btn next"
        type="button"
        @click="goNext"
      >
        <ChevronRightIcon />
      </button>
    </div>

    <!-- 缩略图滚动条 -->
    <div class="thumb-strip">
      <button
        v-for="(slide, index) in slides"
        :key="index"
        :id="`thumb-${index}`"
        :class="['thumb-item', { active: index === currentIndex }]"
        type="button"
        @click="scrollToThumb(index)"
      >
        <div class="thumb-inner">
          <div v-if="slide.svgContent" class="thumb-svg" v-html="slide.svgContent"></div>
          <div v-else class="thumb-placeholder">
            <span>P{{ slide.page }}</span>
          </div>
        </div>
        <span class="thumb-label">{{ slide.page }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.ppt-preview-card {
  border-radius: 10px;
  background: #ffffff;
  border: 1px solid #e4e9f2;
  box-shadow: 0 8px 20px rgba(20, 34, 70, 0.06);
  overflow: hidden;
}

.preview-header {
  padding: 12px 16px;
  border-bottom: 1px solid #eef1f6;
  background: linear-gradient(135deg, #f8faff, #f5f2ff);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.preview-header strong {
  color: #1e2432;
  font-size: 15px;
  font-weight: 900;
}

.preview-header em {
  color: #7b8493;
  font-size: 12px;
  font-style: normal;
  font-weight: 800;
}

.main-preview {
  position: relative;
  padding: 16px 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
}

.nav-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 50%;
  color: #7b8493;
  background: #f3f5f8;
  display: grid;
  place-items: center;
  cursor: pointer;
  z-index: 2;
  transition: all 0.18s ease;
}

.nav-btn:hover {
  color: #426cff;
  background: #eef3ff;
}

.nav-btn.prev { left: 8px; }
.nav-btn.next { right: 8px; }

.nav-btn svg {
  width: 18px;
  height: 18px;
}

.slide-stage {
  width: 100%;
  max-width: 520px;
  aspect-ratio: 16 / 9;
  border-radius: 8px;
  border: 1px solid #e4e9f2;
  background: #fafbfe;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.svg-wrap,
.img-wrap {
  flex: 1;
  overflow: hidden;
  display: grid;
  place-items: center;
}

.svg-wrap :deep(svg) {
  width: 100%;
  height: 100%;
}

.img-wrap img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.placeholder-slide {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.placeholder-page {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: linear-gradient(135deg, #3f7cff, #8c5cff);
  color: #ffffff;
  font-size: 14px;
  font-weight: 900;
  display: grid;
  place-items: center;
}

.placeholder-title {
  color: #6d7482;
  font-size: 13px;
}

.slide-label {
  padding: 6px 12px;
  border-top: 1px solid #eef1f6;
  color: #5a6270;
  font-size: 12px;
  text-align: center;
  background: #ffffff;
}

.thumb-strip {
  padding: 8px 12px;
  border-top: 1px solid #eef1f6;
  display: flex;
  gap: 6px;
  overflow-x: auto;
  background: #fafbfe;
}

.thumb-strip::-webkit-scrollbar {
  height: 4px;
}

.thumb-strip::-webkit-scrollbar-thumb {
  border-radius: 4px;
  background: #d4dae6;
}

.thumb-item {
  flex: 0 0 56px;
  border: 1.5px solid #e4e9f2;
  border-radius: 5px;
  background: #ffffff;
  padding: 2px;
  cursor: pointer;
  transition: all 0.18s ease;
}

.thumb-item:hover {
  border-color: #92a5ff;
}

.thumb-item.active {
  border-color: #426cff;
  box-shadow: 0 0 0 2px rgba(66, 108, 255, 0.18);
}

.thumb-inner {
  aspect-ratio: 16 / 9;
  border-radius: 3px;
  overflow: hidden;
  background: #f3f5f8;
}

.thumb-svg {
  width: 100%;
  height: 100%;
}

.thumb-svg :deep(svg) {
  width: 100%;
  height: 100%;
}

.thumb-placeholder {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  color: #9298a4;
  font-size: 10px;
  font-weight: 800;
}

.thumb-label {
  display: block;
  margin-top: 2px;
  color: #7b8493;
  font-size: 9px;
  text-align: center;
}
</style>
