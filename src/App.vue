<template>
  <div class="app-shell" :class="{ 'obs-shell': isObsOutput }">
    <aside v-if="!isObsOutput" class="sidebar">
      <div class="brand"><span class="brand-mark">D</span><div><strong>DouAi</strong><small>LIVE SYSTEM</small></div></div>
      <div class="sidebar-label">工作台</div>
      <nav aria-label="工作台">
        <button :class="{ active: activePage === 'console' }" aria-label="直播控制台" title="直播控制台" @click="go('console')"><span class="nav-icon">播</span><span class="nav-label">直播控制台</span></button>
        <button :class="{ active: activePage === 'config' }" aria-label="运行配置" title="运行配置" @click="go('config')"><span class="nav-icon">配</span><span class="nav-label">运行配置</span></button>
        <button :class="{ active: activePage === 'games' || activePage === 'quiz' }" aria-label="游戏列表" title="游戏列表" @click="go('games')"><span class="nav-icon">游</span><span class="nav-label">游戏列表</span></button>
      </nav>
      <div class="sidebar-label">系统</div>
      <nav aria-label="系统">
        <button :class="{ active: activePage === 'voice' }" aria-label="语音配置" title="语音配置" @click="go('voice')"><span class="nav-icon">声</span><span class="nav-label">语音配置</span></button>
      </nav>
      <div class="sidebar-bottom"><span class="state-dot"></span><div><strong>本地运行</strong><small>DouAi 直播服务已就绪</small></div></div>
    </aside>
    <main class="app-main">
      <div v-if="voiceInitError && !isObsOutput" class="voice-init-error" role="alert"><span>语音未启用：{{ voiceInitError }}</span><button :disabled="voiceInitBusy" @click="loadVoice">{{ voiceInitBusy ? '重试中…' : '重新加载' }}</button></div>
      <ObsLiveView v-if="isObsOutput" />
      <LiveConsoleView v-else-if="activePage === 'console'" />
      <RunConfigView v-else-if="activePage === 'config'" />
      <GameListView v-else-if="activePage === 'games'" @open-quiz="go('quiz')" />
      <QuizConfigView v-else-if="activePage === 'quiz'" @back="go('games')" />
      <VoiceConfigView v-else-if="activePage === 'voice'" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import LiveConsoleView from './views/LiveConsoleView.vue';
import RunConfigView from './views/RunConfigView.vue';
import GameListView from './views/GameListView.vue';
import QuizConfigView from './views/QuizConfigView.vue';
import VoiceConfigView from './views/VoiceConfigView.vue';
import ObsLiveView from './views/ObsLiveView.vue';
import { printInfo } from './utils/logUtil';
import { ensureVoiceInitialized } from './voice/voiceInitialization';
import { voiceManager } from './voice/voiceManager';
import { onUnmounted } from 'vue';

type Page = 'console' | 'config' | 'games' | 'quiz' | 'voice';
const pages: Page[] = ['console', 'config', 'games', 'quiz', 'voice'];
const requestedPage = new URLSearchParams(location.search).get('page');
const isObsOutput = new URLSearchParams(location.search).get('output') === '1';
const activePage = ref<Page>(pages.includes(requestedPage as Page) ? (requestedPage as Page) : 'console');
const voiceInitError = ref('');
const voiceInitBusy = ref(false);
async function loadVoice() {
  voiceInitBusy.value = true;
  try { await ensureVoiceInitialized(); voiceInitError.value = ''; }
  catch (error) { voiceInitError.value = error instanceof Error ? error.message : '语音配置加载失败'; }
  finally { voiceInitBusy.value = false; }
}
const unsubscribeVoice = voiceManager.subscribe(state => { if (state.ready) voiceInitError.value = ''; });
onUnmounted(() => unsubscribeVoice());
if (!isObsOutput) void loadVoice();

function go(page: Page) {
  activePage.value = page;
  history.pushState({ page }, '', page === 'console' ? location.pathname : `${location.pathname}?page=${page}`);
}

window.addEventListener('popstate', () => {
  const page = new URLSearchParams(location.search).get('page') as Page;
  activePage.value = pages.includes(page) ? page : 'console';
});
setTimeout(() => { console?.clear(); printInfo(); }, 1500);
</script>

<style lang="scss">
.voice-init-error{display:flex;gap:12px;justify-content:space-between;align-items:center;padding:12px 22px;background:#352524;color:#efaaa0;font-size:12px;overflow-wrap:anywhere}.voice-init-error button{flex-shrink:0;padding:7px;border:1px solid #74443e;border-radius:4px;background:transparent;color:inherit}
:root{--ink:#e8eeea;--muted:#a1ada6;--faint:#78857e;--line:rgba(203,216,208,.14);--panel:#1a211e;--panel-2:#232c28;--accent:#89cfbd;--accent-2:#d2b16f;--bg:#151a18}
*{box-sizing:border-box}html,body,#app{width:100%;min-height:100%;margin:0}body{font-family:'Douyin Sans','Microsoft YaHei',sans-serif;background:var(--bg)}button,input,select{font:inherit}button{cursor:pointer}
.app-shell{min-height:100vh;background:var(--bg);color:var(--ink)}.app-main{min-height:100vh;margin-left:236px}.obs-shell .app-main{margin-left:0}.sidebar{position:fixed;z-index:10;left:0;top:0;bottom:0;width:236px;display:flex;flex-direction:column;padding:22px 14px;border-right:1px solid var(--line);background:#121715}.brand{display:flex;align-items:center;gap:10px;padding:0 9px 25px}.brand-mark{display:grid;place-items:center;width:32px;height:32px;border-radius:6px;color:#13201d;background:var(--accent);font-size:17px;font-weight:800}.brand strong,.brand small,.sidebar-bottom strong,.sidebar-bottom small{display:block}.brand strong{font-size:14px}.brand small{margin-top:3px;color:var(--faint);font:9px ui-monospace,monospace;letter-spacing:.12em}.sidebar-label{padding:16px 9px 8px;color:var(--faint);font-size:10px;text-transform:uppercase}.sidebar nav{display:grid;gap:2px}.sidebar nav button{display:flex;align-items:center;gap:11px;width:100%;padding:10px 9px;border:0;border-radius:5px;color:var(--muted);background:transparent;text-align:left;font-size:12px;transition:background .15s ease}.sidebar nav button .nav-icon{flex:0 0 19px;width:19px;color:var(--faint);font:10px ui-monospace,monospace;text-align:center}.sidebar nav button:hover,.sidebar nav button.active{color:var(--ink);background:rgba(137,207,189,.11)}.sidebar nav button.active{box-shadow:inset 2px 0 var(--accent)}.sidebar nav button.active .nav-icon{color:var(--accent)}.sidebar-bottom{display:flex;align-items:center;gap:9px;margin-top:auto;padding:12px 9px;border-top:1px solid var(--line)}.sidebar-bottom strong{font-size:11px}.sidebar-bottom small{margin-top:3px;color:var(--faint);font-size:10px}.state-dot{width:7px;height:7px;border-radius:50%;background:var(--accent-2)}@media(max-width:760px){.sidebar{position:sticky;top:0;width:100%;height:auto;padding:10px 12px;flex-direction:column;align-items:stretch;gap:5px;border-right:0;border-bottom:1px solid var(--line)}.brand{padding:0 6px 7px}.sidebar-label,.sidebar-bottom{display:none}.sidebar nav{display:flex;overflow-x:auto}.sidebar nav button{width:auto;white-space:nowrap;padding:8px}.sidebar nav button span{display:none}.app-main{margin-left:0}}
</style>
<style lang="scss">
@media (max-width: 820px) {
  .sidebar {
    position: fixed;
    top: 0;
    bottom: 0;
    width: 62px;
    height: 100vh;
    padding: 16px 7px;
    flex-direction: column;
    align-items: stretch;
    border-right: 1px solid var(--line);
    border-bottom: 0;
  }
  .brand {
    justify-content: center;
    padding: 0 0 22px;
  }
  .brand > div,
  .sidebar-label,
  .sidebar-bottom > div {
    display: none;
  }
  .sidebar nav {
    display: grid;
    gap: 5px;
  }
  .sidebar nav button {
    justify-content: center;
    width: 46px;
    height: 42px;
    padding: 4px;
  }
  .sidebar nav button .nav-label {
    display: none;
  }
  .sidebar nav button .nav-icon {
    display: grid;
    place-items: center;
    flex: 0 0 30px;
    width: 30px;
    height: 30px;
    border-radius: 5px;
    color: var(--muted);
    font-size: 12px;
  }
  .sidebar nav button.active .nav-icon {
    color: var(--ink);
    background: rgba(137, 207, 189, 0.13);
  }
  .sidebar-bottom {
    display: flex;
    justify-content: center;
    padding: 12px 0;
  }
  .app-main {
    margin-left: 62px;
  }
}
</style>
