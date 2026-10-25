<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { quizState } from '@/game/quiz/quizStore';
import { liveState, simulationState } from '@/stores/liveStore';
import QuizBroadcastCanvas from './QuizBroadcastCanvas.vue';

const previewFrame = ref<HTMLElement>();
const scale = ref(0.4);
const copied = ref(false);
const outputUrl = computed(() => `${location.origin}${location.pathname}?page=obs&output=1`);
const showQuizOutput = computed(() => quizState.running && (simulationState.active || liveState.connection === 'live'));
let observer: ResizeObserver | undefined;
let copiedTimer: number | undefined;

onMounted(async () => {
  if (previewFrame.value) {
    observer = new ResizeObserver(([entry]) => {
      scale.value = entry.contentRect.width / 1080;
    });
    observer.observe(previewFrame.value);
  }
});

onBeforeUnmount(() => {
  observer?.disconnect();
  if (copiedTimer) window.clearTimeout(copiedTimer);
});

async function copyOutputUrl() {
  await navigator.clipboard.writeText(outputUrl.value);
  copied.value = true;
  if (copiedTimer) window.clearTimeout(copiedTimer);
  copiedTimer = window.setTimeout(() => { copied.value = false; }, 1800);
}
</script>

<template>
  <section class="preview-panel" aria-label="OBS 直播画面预览">
    <header class="preview-heading">
      <div>
        <span class="panel-kicker">OBS PREVIEW</span>
        <h2>直播画面</h2>
      </div>
      <span class="resolution">9:16 <b>1080 × 1920</b></span>
    </header>

    <div ref="previewFrame" class="preview-frame">
      <div class="canvas-scaled" :style="{ transform: `scale(${scale})` }">
        <QuizBroadcastCanvas v-if="showQuizOutput" />
        <div v-else class="preview-idle"><span>DOUAI · LIVE</span><strong>{{ liveState.connection === 'live' ? '等待游戏启动' : '等待开播' }}</strong></div>
      </div>
    </div>

    <div class="source-details">
      <div class="source-heading">
        <div>
          <strong>OBS 浏览器来源</strong>
          <span>复制地址后添加为浏览器来源</span>
        </div>
        <a :href="outputUrl" target="_blank" rel="noreferrer" aria-label="单独打开纯直播画面" title="单独打开">↗</a>
      </div>
      <div class="url-field">
        <code>{{ outputUrl }}</code>
        <button type="button" @click="copyOutputUrl">{{ copied ? '已复制' : '复制' }}</button>
      </div>
      <p class="source-note">来源尺寸：1080 × 1920。输出页不包含侧边栏和控制项。</p>
    </div>
  </section>
</template>

<style scoped>
.preview-panel {
  min-width: 0;
  padding: 18px;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: #ffffff;
  box-shadow: var(--card-shadow);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.preview-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.panel-kicker {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: #10b981;
}

.preview-heading h2 {
  margin: 2px 0 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-main);
}

.resolution {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-size: 11px;
  color: #10b981;
  font-family: ui-monospace, monospace;
}

.resolution b {
  font-size: 10px;
  color: var(--text-muted);
}

.preview-frame {
  position: relative;
  width: 100%;
  max-width: 280px;
  aspect-ratio: 9/16;
  margin: 0 auto;
  overflow: hidden;
  border-radius: 10px;
  border: 1px solid #1e293b;
  background: #090d16;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.canvas-scaled {
  position: absolute;
  top: 0;
  left: 0;
  width: 1080px;
  height: 1920px;
  transform-origin: top left;
}

.preview-idle {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  width: 1080px;
  height: 1920px;
  color: #f8fafc;
  background: #090d16;
  font-family: 'Douyin Sans', -apple-system, sans-serif;
  text-align: center;
}

.preview-idle span {
  font-size: 32px;
  letter-spacing: 0.15em;
  font-weight: 800;
  color: #10b981;
}

.preview-idle strong {
  font-size: 64px;
  font-weight: 800;
}

.source-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid #f1f5f9;
}

.source-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.source-heading strong {
  font-size: 12px;
  color: var(--text-main);
}

.source-heading span {
  font-size: 11px;
  color: var(--text-muted);
}

.source-heading a {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  color: #10b981;
  text-decoration: none;
  font-weight: 700;
}
.source-heading a:hover {
  background: #f1f5f9;
}

.url-field {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #f8fafc;
}

.url-field code {
  flex: 1;
  font-size: 11px;
  color: #475569;
  font-family: ui-monospace, monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.url-field button {
  padding: 4px 10px;
  border-radius: 4px;
  background: #10b981;
  color: #ffffff;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}
.url-field button:hover {
  background: #059669;
}

.source-note {
  margin: 0;
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.5;
}
</style>
