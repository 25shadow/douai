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
.preview-panel{min-width:0;padding:16px;border:1px solid var(--line);border-radius:7px;background:var(--panel)}
.preview-heading{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px}
.panel-kicker{color:var(--accent-2);font-size:9px;font-weight:750;letter-spacing:.12em}
.preview-heading h2{margin:5px 0 0;font-size:16px}
.resolution{display:grid;gap:3px;text-align:right;color:var(--accent);font:10px ui-monospace,monospace}
.resolution b{color:var(--muted);font-size:9px;font-weight:400}
.preview-frame{position:relative;width:min(100%,300px);aspect-ratio:9/16;margin:0 auto;overflow:hidden;border:1px solid rgba(220,231,222,.16);border-radius:5px;background:#121a18}
.canvas-scaled{position:absolute;top:0;left:0;width:1080px;height:1920px;transform-origin:top left}
.preview-idle{display:grid;place-content:center;justify-items:center;gap:14px;width:1080px;height:1920px;color:#e8eeea;background:#121a18;font-family:'Douyin Sans','Microsoft YaHei',sans-serif}
.preview-idle span{color:#89cfbd;font:20px ui-monospace,monospace;letter-spacing:.12em}
.preview-idle strong{font-size:42px}
.source-details{margin-top:17px;padding-top:14px;border-top:1px solid var(--line)}
.source-heading{display:flex;align-items:center;justify-content:space-between;gap:8px}
.source-heading div{display:grid;gap:4px;min-width:0}
.source-heading strong{font-size:12px}
.source-heading span,.source-note{color:var(--muted);font-size:10px}
.source-heading a{display:grid;place-items:center;flex:0 0 28px;width:28px;height:28px;border:1px solid var(--line);border-radius:4px;color:var(--accent);text-decoration:none}
.url-field{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;margin-top:11px;padding:5px;border:1px solid var(--line);border-radius:4px;background:#111917}
.url-field code{align-self:center;overflow-wrap:anywhere;color:#c5d2c9;font-size:9px;line-height:1.4}
.url-field button{padding:6px 8px;border:1px solid var(--accent);border-radius:3px;color:#122019;background:var(--accent);font-size:10px;white-space:nowrap}
.source-note{margin:8px 0 0;line-height:1.5}
</style>
