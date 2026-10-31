<template>
  <div v-if="props.open" class="theme-preview-backdrop" @click.self="$emit('close')">
    <div class="game-preview-shell" role="dialog" aria-label="游戏画面预览">
      <!-- 顶部轻量主题切换条 + 关闭按钮 -->
      <div class="preview-top-bar">
        <!-- 知识问答主题标签页 -->
        <div v-if="targetGame === 'quiz'" class="theme-quick-tabs">
          <button
            v-for="t in quizThemes"
            :key="t.id"
            type="button"
            class="theme-tab-pill"
            :class="{ active: currentThemeId === t.id }"
            @click="selectQuizTheme(t.id)"
          >
            {{ t.name }}
          </button>
        </div>

        <!-- 阵营对抗主题标签页 -->
        <div v-else class="theme-quick-tabs">
          <button
            v-for="t in versusThemes"
            :key="t.id"
            type="button"
            class="theme-tab-pill versus"
            :class="{ active: currentVersusTheme === t.id }"
            @click="selectVersusTheme(t.id)"
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
          <QuizBroadcastCanvas v-if="targetGame === 'quiz'" :output-only="true" />
          <VersusBroadcastCanvas v-else :output-only="true" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { X } from '@lucide/vue';
import QuizBroadcastCanvas from '@/views/QuizBroadcastCanvas.vue';
import VersusBroadcastCanvas from '@/views/VersusBroadcastCanvas.vue';
import {
  quizThemes,
  readQuizTheme,
  normalizeQuizTheme,
  publishQuizTheme,
  subscribeQuizTheme,
  type QuizThemeId,
} from '@/game/quiz/quizThemes';
import { quizRuntimeSettings, quizState } from '@/game/quiz/quizStore';
import {
  versusThemes,
  versusRuntimeSettings,
  versusState,
  setVersusTheme,
  type VersusThemeId
} from '@/game/versus/versusStore';

const props = defineProps<{
  open: boolean;
  gameId?: 'quiz' | 'versus';
}>();

defineEmits<{
  close: [];
}>();

const targetGame = computed(() => {
  if (props.gameId) return props.gameId;
  if (versusState.running && !quizState.running) return 'versus';
  return 'quiz';
});

const viewportRef = ref<HTMLElement>();
const scale = ref(0.375);
const currentThemeId = ref<QuizThemeId>(readQuizTheme() ?? normalizeQuizTheme(quizRuntimeSettings.theme));
const currentVersusTheme = computed(() => versusRuntimeSettings.theme || 'tug');

let resizeObserver: ResizeObserver | undefined;
let stopThemeSub: (() => void) | undefined;

function selectQuizTheme(id: QuizThemeId) {
  currentThemeId.value = id;
  quizRuntimeSettings.theme = id;
  publishQuizTheme(id);
}

function selectVersusTheme(id: VersusThemeId) {
  setVersusTheme(id);
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
  background: rgba(17, 24, 23, 0.28);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  animation: fadeIn 0.18s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.game-preview-shell {
  display: flex;
  flex-direction: column;
  height: 94vh;
  aspect-ratio: 9 / 16;
  max-width: 95vw;
  background: #ffffff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow:
    0 18px 48px rgba(17, 24, 23, 0.18),
    0 0 0 1px #e3e5e1;
}

.preview-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  background: #ffffff;
  border-bottom: 1px solid #e3e5e1;
  flex-shrink: 0;
  z-index: 10;
}

.theme-quick-tabs {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
}

.theme-quick-tabs::-webkit-scrollbar {
  display: none;
}

.theme-tab-pill {
  padding: 5px 12px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  color: #66716c;
  background: #f3f4f2;
  border: 1px solid transparent;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.18s ease;
}

.theme-tab-pill:hover {
  color: #111817;
  background: #e8ece8;
}

.theme-tab-pill.active {
  color: #ffffff;
  background: #0b8f69;
  box-shadow: none;
}

.theme-tab-pill.versus.active {
  background: #f43f5e;
  box-shadow: 0 0 14px rgba(244, 63, 94, 0.45);
}

.preview-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: #f3f4f2;
  border: none;
  color: #66716c;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.18s ease;
}

.preview-close-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.preview-canvas-viewport {
  flex: 1;
  width: 100%;
  position: relative;
  overflow: hidden;
  background: #111817;
  display: flex;
  align-items: flex-start;
  justify-content: center;
}

.preview-canvas-scaled {
  width: 1080px;
  height: 1920px;
  transform-origin: top center;
  flex-shrink: 0;
}
</style>
