<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { quizRuntimeSettings, quizState } from '@/game/quiz/quizStore';
import { normalizeQuizTheme, readQuizTheme } from '@/game/quiz/quizThemes';
import { loadConfig } from '@/services/configApi';
import { liveState, simulationState } from '@/stores/liveStore';
import QuizBroadcastCanvas from './QuizBroadcastCanvas.vue';

const isOutput = new URLSearchParams(location.search).get('output') === '1';
const previewFrame = ref<HTMLElement>();
const scale = ref(0.4);
const copied = ref(false);
const outputUrl = computed(() => `${location.origin}${location.pathname}?page=obs&output=1`);
const showQuizOutput = computed(() => quizState.running && (simulationState.active || liveState.connection === 'live'));
let observer: ResizeObserver | undefined;

onMounted(async () => {
  const currentTheme = readQuizTheme();
  if (currentTheme) quizRuntimeSettings.theme = currentTheme;
  else {
    try {
      const saved = await loadConfig();
      quizRuntimeSettings.theme = normalizeQuizTheme(saved.quizConfig.theme);
    } catch {
      // The browser source can still render with its built-in default theme.
    }
  }
  if (!isOutput && previewFrame.value) {
    observer = new ResizeObserver(([entry]) => {
      scale.value = entry.contentRect.width / 1080;
    });
    observer.observe(previewFrame.value);
  }
});
onBeforeUnmount(() => observer?.disconnect());

async function copyOutputUrl() {
  await navigator.clipboard.writeText(outputUrl.value);
  copied.value = true;
  window.setTimeout(() => { copied.value = false; }, 1800);
}
</script>

<template>
  <main v-if="isOutput" class="output-page">
    <QuizBroadcastCanvas v-if="showQuizOutput" :output-only="true" />
    <div v-else class="output-idle"><span>DOUAI · LIVE</span><strong>{{ liveState.connection === 'live' ? '等待游戏启动' : '等待开播' }}</strong></div>
  </main>
  <section v-else class="obs-preview-page">
    <header class="page-heading">
      <div><span class="eyebrow">OBS BROADCAST PREVIEW</span><h1>直播画面预览</h1><p>此处为实际直播画面的缩放预览；OBS 浏览器来源使用独立竖屏输出。</p></div>
      <span class="resolution">9:16 <b>1080 × 1920</b></span>
    </header>
    <div class="preview-layout">
      <div class="preview-column">
        <div ref="previewFrame" class="preview-frame">
          <div class="canvas-scaled" :style="{ transform: `scale(${scale})` }">
            <QuizBroadcastCanvas />
          </div>
        </div>
      </div>
      <aside class="source-panel">
        <span class="panel-kicker">OBS BROWSER SOURCE</span>
        <h2>浏览器来源地址</h2>
        <p>在 OBS 中添加“浏览器”来源，使用此地址并设置宽 1080、高 1920。该输出不含软件侧边栏和控制项。</p>
        <div class="url-field"><code>{{ outputUrl }}</code><button aria-label="复制 OBS 输出地址" title="复制地址" @click="copyOutputUrl">{{ copied ? '已复制' : '复制' }}</button></div>
        <div class="source-meta"><span>宽度 <b>1080</b></span><span>高度 <b>1920</b></span><span>比例 <b>9:16</b></span></div>
        <a class="open-output" :href="outputUrl" target="_blank" rel="noreferrer">单独打开竖屏输出 ↗</a>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.output-page{width:1080px;height:1920px;overflow:hidden;background:#121a18}.output-idle{display:grid;place-content:center;justify-items:center;gap:14px;width:1080px;height:1920px;color:#e8eeea;background:#121a18;font-family:'Douyin Sans','Microsoft YaHei',sans-serif}.output-idle span{color:#89cfbd;font:20px ui-monospace,monospace;letter-spacing:.12em}.output-idle strong{font-size:42px}.obs-preview-page{max-width:1180px;margin:0 auto;padding:34px clamp(20px,4vw,54px) 48px;color:var(--ink)}.page-heading{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;padding-bottom:18px;border-bottom:1px solid var(--line)}.eyebrow,.panel-kicker{color:var(--accent-2);font-size:10px;font-weight:750;letter-spacing:.12em}.page-heading h1{margin:8px 0 5px;font-size:26px}.page-heading p{margin:0;color:var(--muted);font-size:12px}.resolution{display:grid;gap:4px;text-align:right;color:var(--accent);font:11px ui-monospace,monospace}.resolution b{color:var(--muted);font-weight:400}.preview-layout{display:grid;grid-template-columns:minmax(0,1fr) 300px;align-items:start;gap:28px;padding-top:24px}.preview-column{display:flex;justify-content:center;padding:0 8px}.preview-frame{position:relative;width:min(100%,432px);aspect-ratio:9/16;overflow:hidden;border:1px solid rgba(220,231,222,.16);border-radius:7px;background:#121a18;box-shadow:0 14px 40px rgba(0,0,0,.24)}.canvas-scaled{position:absolute;top:0;left:0;width:1080px;height:1920px;transform-origin:top left}.source-panel{position:sticky;top:22px;padding:17px 0;border-top:2px solid var(--accent);border-bottom:1px solid var(--line)}.source-panel h2{margin:9px 0;font-size:16px}.source-panel p{margin:0;color:var(--muted);font-size:11px;line-height:1.7}.url-field{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;margin-top:16px;padding:6px;border:1px solid var(--line);border-radius:5px;background:#111917}.url-field code{align-self:center;overflow-wrap:anywhere;color:#c5d2c9;font-size:10px}.url-field button{padding:7px 9px;border:1px solid var(--accent);border-radius:4px;color:#122019;background:var(--accent);font-size:10px}.source-meta{display:flex;justify-content:space-between;gap:7px;margin-top:13px;color:var(--muted);font-size:10px}.source-meta b{color:var(--ink);font-weight:600}.open-output{display:inline-block;margin-top:18px;color:var(--accent);font-size:11px;text-decoration:none}.output-page :deep(.broadcast){width:1080px;height:1920px}@media(max-width:840px){.preview-layout{grid-template-columns:minmax(0,1fr) 240px;gap:16px}.preview-column{padding:0}.source-panel{position:static}}@media(max-width:620px){.page-heading{align-items:flex-start;flex-direction:column}.resolution{text-align:left}.preview-layout{grid-template-columns:1fr}.preview-frame{width:min(100%,360px)}.source-panel{padding:15px 0}}
</style>
