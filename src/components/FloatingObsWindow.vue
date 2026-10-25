<template>
  <div v-if="props.open" class="theme-preview-backdrop" @click.self="$emit('close')">
    <div class="theme-preview-shell" role="dialog" aria-label="主题预览">
      <!-- 顶部轻量主题切换条 + 关闭按钮 -->
      <div class="preview-top-bar">
        <div class="theme-quick-tabs">
          <button
            v-for="t in quizThemes"
            :key="t.id"
            type="button"
            class="theme-tab-pill"
            :class="{ active: currentThemeId === t.id }"
            @click="selectTheme(t.id)"
          >
            {{ t.name }}
          </button>
        </div>
        <button class="preview-close-btn" type="button" title="关闭预览" @click="$emit('close')">
          <X :size="16" />
        </button>
      </div>

      <!-- 纯净无边框主题预览画布 -->
      <div class="preview-canvas-viewport" ref="viewportRef">
        <div class="preview-canvas-scaled" :style="{ transform: `scale(${scale})` }">
          <QuizBroadcastCanvas :output-only="true" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { X } from '@lucide/vue';
import QuizBroadcastCanvas from '@/views/QuizBroadcastCanvas.vue';
import {
  quizThemes,
  readQuizTheme,
  normalizeQuizTheme,
  publishQuizTheme,
  subscribeQuizTheme,
  type QuizThemeId,
} from '@/game/quiz/quizThemes';
import { quizRuntimeSettings } from '@/game/quiz/quizStore';

const props = defineProps<{
  open: boolean;
}>();

defineEmits<{
  close: [];
}>();

const viewportRef = ref<HTMLElement>();
const scale = ref(0.375);
const currentThemeId = ref<QuizThemeId>(readQuizTheme() ?? normalizeQuizTheme(quizRuntimeSettings.theme));

let resizeObserver: ResizeObserver | undefined;
let stopThemeSub: (() => void) | undefined;

function selectTheme(id: QuizThemeId) {
  currentThemeId.value = id;
  quizRuntimeSettings.theme = id;
  publishQuizTheme(id);
}

function updateScale() {
  if (viewportRef.value) {
    const width = viewportRef.value.clientWidth;
    const height = viewportRef.value.clientHeight;
    if (width > 0 && height > 0) {
      scale.value = Math.min(width / 1080, height / 1920);
    } else if (width > 0) {
      scale.value = width / 1080;
    }
  }
}

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      currentThemeId.value = readQuizTheme() ?? normalizeQuizTheme(quizRuntimeSettings.theme);
      await nextTick();
      updateScale();
      if (viewportRef.value) {
        resizeObserver?.disconnect();
        resizeObserver = new ResizeObserver(() => {
          updateScale();
        });
        resizeObserver.observe(viewportRef.value);
      }
    } else {
      resizeObserver?.disconnect();
    }
  },
  { immediate: true }
);

onMounted(() => {
  stopThemeSub = subscribeQuizTheme((id) => {
    currentThemeId.value = id;
  });
  if (props.open) {
    updateScale();
  }
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  stopThemeSub?.();
});
</script>

<style scoped>
.theme-preview-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(15, 23, 42, 0.65);
  backdrop-filter: blur(6px);
  display: grid;
  place-items: center;
  padding: 16px;
}

.theme-preview-shell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  max-width: 95vw;
  max-height: 95vh;
}

.preview-top-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(15, 23, 42, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.14);
  padding: 6px 8px;
  border-radius: 999px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
}

.theme-quick-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.theme-tab-pill {
  padding: 5px 11px;
  border-radius: 999px;
  border: 0;
  background: transparent;
  color: #cbd5e1;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.theme-tab-pill:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.08);
}

.theme-tab-pill.active {
  background: #10b981;
  color: #ffffff;
  font-weight: 700;
  box-shadow: 0 2px 10px rgba(16, 185, 129, 0.4);
}

.preview-close-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 0;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.1);
  color: #e2e8f0;
  cursor: pointer;
  transition: all 0.15s;
}

.preview-close-btn:hover {
  background: #ef4444;
  color: #ffffff;
}

.preview-canvas-viewport {
  position: relative;
  height: min(85vh, 780px);
  aspect-ratio: 9 / 16;
  width: auto;
  border-radius: 16px;
  overflow: hidden;
  background: #050810;
  box-shadow: 0 25px 60px -12px rgba(0, 0, 0, 0.65);
}

.preview-canvas-scaled {
  position: absolute;
  top: 0;
  left: 0;
  width: 1080px;
  height: 1920px;
  transform-origin: top left;
}
</style>
