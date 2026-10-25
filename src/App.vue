<template>
  <!-- OBS 纯画面输出模式 (无标题栏与导航栏) -->
  <div v-if="isObsOutput" class="obs-standalone-shell">
    <ObsLiveView />
  </div>

  <!-- 桌面电脑软件完整布局 (Tauri 友好) -->
  <div v-else class="desktop-app-shell">
    <!-- 桌面专属原生级标题栏 (可拖拽窗口区域) -->
    <DesktopTitleBar 
      :obs-window-visible="showObsFloatingWindow"
      @open-license="showLicenseModal = true"
      @toggle-obs-window="toggleObsWindow"
    />

    <!-- 软件主工作区 (左侧导航 + 右侧主内容) -->
    <div class="desktop-body">
      <!-- 左侧专业导航栏 (控制台置于首位) -->
      <aside class="desktop-sidebar">
        <nav class="sidebar-nav" aria-label="软件功能导航">
          <!-- 1. 直播控制台 (置于最前作为核心主控室) -->
          <button 
            class="nav-item" 
            :class="{ active: activePage === 'console' }" 
            type="button"
            title="直播控制台 (主控室)"
            @click="go('console')"
          >
            <div class="nav-icon-box">
              <Tv :size="17" />
            </div>
            <span class="nav-text">直播控制台</span>
          </button>


          <!-- 3. 连接直播 -->
          <button 
            class="nav-item" 
            :class="{ active: activePage === 'connect' }" 
            type="button"
            title="连接直播间"
            @click="go('connect')"
          >
            <div class="nav-icon-box red">
              <Radio :size="17" />
            </div>
            <span class="nav-text">连接直播</span>
          </button>

          <!-- 4. 游戏大厅 -->
          <button 
            class="nav-item" 
            :class="{ active: activePage === 'games' || activePage === 'quiz' }" 
            type="button"
            title="游戏大厅"
            @click="go('games')"
          >
            <div class="nav-icon-box blue">
              <Gamepad2 :size="17" />
            </div>
            <span class="nav-text">游戏大厅</span>
          </button>

          <!-- 5. 背景音乐 -->
          <button 
            class="nav-item" 
            :class="{ active: activePage === 'bgm' }" 
            type="button"
            title="背景音乐与音效"
            @click="go('bgm')"
          >
            <div class="nav-icon-box pink">
              <Music :size="17" />
            </div>
            <span class="nav-text">背景音乐</span>
          </button>

          <!-- 6. 智能朗读 -->
          <button 
            class="nav-item" 
            :class="{ active: activePage === 'voice' }" 
            type="button"
            title="智能朗读与语音设置"
            @click="go('voice')"
          >
            <div class="nav-icon-box teal">
              <Volume2 :size="17" />
            </div>
            <span class="nav-text">智能朗读</span>
          </button>

          <!-- 8. 卡密激活 -->
          <button 
            class="nav-item" 
            type="button"
            title="卡密激活与会员授权"
            @click="showLicenseModal = true"
          >
            <div class="nav-icon-box purple">
              <Crown :size="17" />
            </div>
            <span class="nav-text">卡密激活</span>
          </button>
        </nav>

        <!-- 底部系统设置与就绪状态 -->
        <div class="sidebar-bottom-area">
          <button 
            class="nav-item settings-item" 
            :class="{ active: activePage === 'settings' }" 
            type="button"
            title="系统设置"
            @click="go('settings')"
          >
            <div class="nav-icon-box">
              <Settings :size="17" />
            </div>
            <span class="nav-text">系统设置</span>
          </button>

          <div class="desktop-health-status">
            <span class="status-pulse-dot"></span>
            <div class="status-texts">
              <strong>系统就绪</strong>
              <small>Tauri 本地服务正常</small>
            </div>
          </div>
        </div>
      </aside>

      <!-- 主视图渲染区 -->
      <main class="desktop-content-viewport">
        <!-- 语音错误提醒条 -->
        <div v-if="voiceInitError" class="voice-init-banner" role="alert">
          <span>⚠️ 语音引擎初始化提示：{{ voiceInitError }}</span>
          <button :disabled="voiceInitBusy" @click="loadVoice">
            {{ voiceInitBusy ? '重试中…' : '重新加载' }}
          </button>
        </div>

        <!-- 核心视图渲染 (默认优先展示直播控制台) -->
        <LiveConsoleView 
          v-if="activePage === 'console'" 
          @navigate="go"
        />

        <HomeDashboardView 
          v-else-if="activePage === 'home'" 
          @navigate="go" 
          @open-license="showLicenseModal = true"
          @toggle-obs-window="toggleObsWindow"
        />

        <RunConfigView 
          v-else-if="activePage === 'connect'" 
        />

        <GameListView 
          v-else-if="activePage === 'games'" 
          @open-quiz="go('quiz')" 
          @launch-obs="toggleObsWindow"
        />

        <QuizConfigView 
          v-else-if="activePage === 'quiz'" 
          @back="go('games')" 
          @launch-obs="toggleObsWindow"
        />

        <BgmMusicView 
          v-else-if="activePage === 'bgm'" 
        />

        <VoiceConfigView 
          v-else-if="activePage === 'voice'" 
        />

        <SystemSettingsView 
          v-else-if="activePage === 'settings'" 
        />
      </main>
    </div>

    <!-- 独立 9:16 OBS 浮动画面窗口 -->
    <FloatingObsWindow 
      :open="showObsFloatingWindow" 
      :game-id="previewGameId"
      @close="showObsFloatingWindow = false" 
    />

    <!-- 卡密激活与会员授权弹窗 -->
    <LicenseModal 
      :open="showLicenseModal" 
      @close="showLicenseModal = false" 
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { 
  Tv, Radio, Gamepad2, Music, Volume2, Crown, 
  Settings 
} from '@lucide/vue';

import DesktopTitleBar from './components/DesktopTitleBar.vue';
import LicenseModal from './components/LicenseModal.vue';
import FloatingObsWindow from './components/FloatingObsWindow.vue';

import LiveConsoleView from './views/LiveConsoleView.vue';
import HomeDashboardView from './views/HomeDashboardView.vue';
import RunConfigView from './views/RunConfigView.vue';
import GameListView from './views/GameListView.vue';
import QuizConfigView from './views/QuizConfigView.vue';
import BgmMusicView from './views/BgmMusicView.vue';
import VoiceConfigView from './views/VoiceConfigView.vue';
import SystemSettingsView from './views/SystemSettingsView.vue';
import ObsLiveView from './views/ObsLiveView.vue';

import { ensureVoiceInitialized } from './voice/voiceInitialization';
import { voiceManager } from './voice/voiceManager';

type Page = 'console' | 'home' | 'connect' | 'games' | 'quiz' | 'bgm' | 'voice' | 'settings';
const pages: Page[] = ['console', 'home', 'connect', 'games', 'quiz', 'bgm', 'voice', 'settings'];

const requestedPage = new URLSearchParams(location.search).get('page');
const isObsOutput = new URLSearchParams(location.search).get('output') === '1';

// 页面路由映射兼容 (控制台作为默认第一页)
function resolveInitialPage(): Page {
  if (requestedPage === 'config') return 'connect';
  if (pages.includes(requestedPage as Page)) return requestedPage as Page;
  return 'console';
}

const activePage = ref<Page>(resolveInitialPage());
const showObsFloatingWindow = ref(false);
const showLicenseModal = ref(false);

const voiceInitError = ref('');
const voiceInitBusy = ref(false);

async function loadVoice() {
  voiceInitBusy.value = true;
  try {
    await ensureVoiceInitialized();
    voiceInitError.value = '';
  } catch (error) {
    voiceInitError.value = error instanceof Error ? error.message : '语音配置加载失败';
  } finally {
    voiceInitBusy.value = false;
  }
}

const unsubscribeVoice = voiceManager.subscribe(state => {
  if (state.ready) voiceInitError.value = '';
});

onMounted(() => {
  if (!isObsOutput) {
    void loadVoice();
  }
});

onUnmounted(() => {
  unsubscribeVoice();
});

function go(page: Page) {
  activePage.value = page;
  history.pushState(
    { page }, 
    '', 
    page === 'console' ? location.pathname : `${location.pathname}?page=${page}`
  );
}

window.addEventListener('popstate', () => {
  const p = new URLSearchParams(location.search).get('page');
  if (p === 'config') {
    activePage.value = 'connect';
  } else if (pages.includes(p as Page)) {
    activePage.value = p as Page;
  } else {
    activePage.value = 'console';
  }
});

const previewGameId = ref<'quiz' | 'versus'>('quiz');

function toggleObsWindow(gameId?: 'quiz' | 'versus') {
  if (gameId === 'quiz' || gameId === 'versus') {
    previewGameId.value = gameId;
  }
  showObsFloatingWindow.value = !showObsFloatingWindow.value;
}
</script>

<style lang="scss">
:root {
  --ink: #1e293b;
  --muted: #64748b;
  --faint: #94a3b8;
  --line: rgba(226, 232, 240, 0.9);
  --panel: #ffffff;
  --panel-2: #f1f5f9;
  --accent: #10b981;
  --accent-2: #8b5cf6;
  --bg: #f4f6fb;
}

.desktop-app-shell {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  overflow: hidden;
}

.obs-standalone-shell {
  width: 100vw;
  height: 100vh;
  background: #000000;
  overflow: hidden;
}

.desktop-body {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}

/* 左侧专业桌面软件侧边栏 */
.desktop-sidebar {
  width: var(--sidebar-width);
  background: #ffffff;
  border-right: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 12px 10px;
  flex-shrink: 0;
  user-select: none;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 12px;
  border-radius: 10px;
  color: #475569;
  background: transparent;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
  text-align: left;
}

.nav-item:hover {
  background: #f1f5f9;
  color: #1e293b;
}

.nav-item.active {
  background: #10b981;
  color: #ffffff;
  font-weight: 700;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.nav-icon-box {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  color: #64748b;
  transition: all 0.15s;
}

.nav-item.active .nav-icon-box {
  color: #ffffff;
}

.sidebar-bottom-area {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid var(--line);
}

.settings-item.active {
  background: #10b981;
  color: #ffffff;
}

.desktop-health-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #f1f5f9;
}

.status-pulse-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 6px rgba(16, 185, 129, 0.6);
}

.status-texts {
  display: flex;
  flex-direction: column;
}

.status-texts strong {
  font-size: 11px;
  color: var(--text-main);
}

.status-texts small {
  font-size: 10px;
  color: var(--text-muted);
}

/* 主内容视口 */
.desktop-content-viewport {
  flex: 1;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
}

.voice-init-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  background: #fef2f2;
  border-bottom: 1px solid #fca5a5;
  color: #991b1b;
  font-size: 12px;
}

.voice-init-banner button {
  padding: 4px 10px;
  border-radius: 4px;
  background: #ffffff;
  border: 1px solid #fca5a5;
  color: #991b1b;
  font-size: 11px;
}
</style>
