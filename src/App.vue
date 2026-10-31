<template>
  <!-- 独立游戏画面窗口 -->
  <div v-if="isGameDisplayRoute" class="game-display-shell">
    <GameDisplayView />
  </div>

  <!-- 桌面电脑软件完整布局 (Tauri 友好) -->
  <div v-else class="desktop-app-shell">
    <!-- 桌面专属原生级标题栏 (可拖拽窗口区域) -->
    <DesktopTitleBar @open-license="showLicenseModal = true" />

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
            :class="{ active: activePage === 'games' || activePage === 'quiz' || activePage === 'versus' }" 
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
      <main class="desktop-content-viewport" :class="{ 'console-page': activePage === 'console' }">
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
          @navigate="handleNavigate"
        />

        <HomeDashboardView 
          v-else-if="activePage === 'home'" 
          @navigate="handleNavigate" 
          @open-license="showLicenseModal = true"
          @open-game-preview="openGamePreview"
        />

        <RunConfigView 
          v-else-if="activePage === 'connect'" 
        />

        <GameListView 
          v-else-if="activePage === 'games'" 
          @open-quiz="go('quiz')" 
          @open-versus="go('versus')"
          @open-game-preview="openGamePreview"
        />

        <QuizConfigView 
          v-else-if="activePage === 'quiz'" 
          @back="go('games')" 
          @open-game-preview="openGamePreview('quiz')"
        />

        <VersusConfigView 
          v-else-if="activePage === 'versus'" 
          @back="go('games')" 
          @open-game-preview="openGamePreview('versus')"
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

    <!-- 游戏主题预览 -->
    <FloatingGamePreview
      :open="showGamePreview"
      :game-id="previewGameId"
      @close="showGamePreview = false"
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
import FloatingGamePreview from './components/FloatingGamePreview.vue';

import LiveConsoleView from './views/LiveConsoleView.vue';
import HomeDashboardView from './views/HomeDashboardView.vue';
import RunConfigView from './views/RunConfigView.vue';
import GameListView from './views/GameListView.vue';
import QuizConfigView from './views/QuizConfigView.vue';
import VersusConfigView from './views/VersusConfigView.vue';
import BgmMusicView from './views/BgmMusicView.vue';
import VoiceConfigView from './views/VoiceConfigView.vue';
import SystemSettingsView from './views/SystemSettingsView.vue';
import GameDisplayView from './views/GameDisplayView.vue';

import { ensureVoiceInitialized } from './voice/voiceInitialization';
import { voiceManager } from './voice/voiceManager';

type Page = 'console' | 'home' | 'connect' | 'games' | 'quiz' | 'versus' | 'bgm' | 'voice' | 'settings';
const pages: Page[] = ['console', 'home', 'connect', 'games', 'quiz', 'versus', 'bgm', 'voice', 'settings'];

const requestedPage = new URLSearchParams(location.search).get('page');
const isGameDisplayRoute = new URLSearchParams(location.search).get('display') === 'game';

// 页面路由映射兼容 (控制台作为默认第一页)
function resolveInitialPage(): Page {
  if (requestedPage === 'config') return 'connect';
  if (pages.includes(requestedPage as Page)) return requestedPage as Page;
  return 'console';
}

const activePage = ref<Page>(resolveInitialPage());
const showGamePreview = ref(false);
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
  if (!isGameDisplayRoute) {
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

function handleNavigate(page: string) {
  if (pages.includes(page as Page)) {
    go(page as Page);
  }
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

function openGamePreview(gameId?: 'quiz' | 'versus') {
  if (gameId === 'quiz' || gameId === 'versus') {
    previewGameId.value = gameId;
  }
  showGamePreview.value = true;
}
</script>

<style lang="scss">
:root {
  --ink: #111827;
  --muted: #64748b;
  --faint: #94a3b8;
  --line: #e5e7eb;
  --panel: #ffffff;
  --panel-2: #f8fafc;
  --accent: #2563eb;
  --accent-2: #7c3aed;
  --bg: #f5f7fa;
}

.desktop-app-shell {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-app);
  overflow: hidden;
}

.game-display-shell {
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
  background: var(--bg-sidebar);
  border-right: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 14px 10px;
  flex-shrink: 0;
  user-select: none;
  transition: width 0.18s ease, padding 0.18s ease;
}

/* Keep the shell calm and neutral; color belongs to actions and status only. */
.desktop-sidebar {
  background: #f8fafc;
  border-right-color: #e2e8f0;
}

.nav-item {
  color: #64748b;
}

.nav-item:hover {
  background: #eef2f7;
  color: #0f172a;
}

.nav-item.active {
  background: #e8f0ff;
  color: #1d4ed8;
  box-shadow: inset 3px 0 0 #2563eb;
}

.nav-item.active .nav-icon-box {
  color: #2563eb;
}

.nav-icon-box {
  color: #94a3b8;
}

.sidebar-bottom-area {
  border-top-color: #e2e8f0;
}

.settings-item.active {
  background: #e8f0ff;
  color: #1d4ed8;
}

.desktop-health-status {
  background: #ffffff;
  border-color: #e2e8f0;
}

.status-texts strong {
  color: #334155;
}

.status-texts small {
  color: #94a3b8;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 40px;
  padding: 8px 11px;
  border-radius: 6px;
  color: #9ca3af;
  background: transparent;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
  text-align: left;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #f9fafb;
}

.nav-item.active {
  background: #2563eb;
  color: #ffffff;
  font-weight: 700;
  box-shadow: none;
}

.nav-icon-box {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  color: #9ca3af;
  transition: all 0.15s;
}

.nav-item.active .nav-icon-box {
  color: #ffffff;
}

.sidebar-bottom-area {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.settings-item.active {
  background: #10b981;
  color: #ffffff;
}

.desktop-health-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 10px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
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
  color: #f9fafb;
}

.status-texts small {
  font-size: 10px;
  color: #9ca3af;
}

/* 主内容视口 */
.desktop-content-viewport {
  flex: 1;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  overscroll-behavior-x: none;
}

.desktop-content-viewport.console-page {
  overflow: hidden;
}

.voice-init-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  background: #fff7ed;
  border-bottom: 1px solid #fed7aa;
  color: #9a3412;
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

@media (max-width: 980px) {
  .desktop-sidebar {
    width: 176px;
    padding-inline: 8px;
  }

  .nav-item {
    padding-inline: 9px;
  }

  .desktop-content-viewport {
    min-width: 0;
  }
}

@media (max-width: 760px) {
  .desktop-sidebar {
    width: 64px;
    padding-inline: 6px;
  }

  .nav-item {
    justify-content: center;
    padding: 7px 4px;
  }

  .nav-item > span:not(.nav-icon-box),
  .sidebar-bottom-area .desktop-health-status,
  .sidebar-bottom-area .nav-item > span:not(.nav-icon-box) {
    display: none;
  }

  .nav-icon-box {
    width: 32px;
    height: 32px;
  }
}

/* Strata-inspired shell: light rail, calm surfaces, one green action color. */
.desktop-sidebar {
  background: #f3f4f2;
  border-right: 1px solid #e3e5e1;
  padding: 16px 12px;
}

.nav-item {
  min-height: 42px;
  border-radius: 8px;
  color: #66716c;
}

.nav-item:hover {
  background: #e8ece8;
  color: #111817;
}

.nav-item.active,
.settings-item.active {
  background: #0b8f69;
  color: #ffffff;
  box-shadow: none;
}

.nav-item.active .nav-icon-box,
.nav-item:hover .nav-icon-box {
  color: currentColor;
}

.nav-icon-box {
  color: #7d8983;
}

.sidebar-bottom-area {
  border-top-color: #e3e5e1;
}

.desktop-health-status {
  background: #ffffff;
  border-color: #e3e5e1;
}

.status-texts strong {
  color: #111817;
}

.status-texts small {
  color: #7d8983;
}

.desktop-content-viewport {
  background: #f3f4f2;
}
</style>
