<template>
  <div class="connect-page">
    <header class="page-top-header">
      <div class="header-titles">
        <span class="sub-category">LIVE STREAM CONNECTION</span>
        <h1>连接直播间</h1>
        <p>输入抖音直播间链接或房间号，连接后即可在直播控制台与游戏窗口中实时接收弹幕、点赞与礼物。</p>
      </div>

      <div class="connection-quick-badge" :class="liveState.connection">
        <span class="badge-dot"></span>
        <span>{{ simulationState.active ? '模拟直播运行中' : liveState.connectionLabel }}</span>
      </div>
    </header>

    <p v-if="configError" class="config-error-banner" role="alert">
      {{ configError }}
    </p>

    <!-- 分区导航 -->
    <nav class="desktop-tabs-nav" aria-label="运行配置分区">
      <button 
        type="button" 
        class="tab-btn"
        :class="{ active: activeTab === 'room' }" 
        @click="activeTab = 'room'"
      >
        <Radio :size="15" />
        <span>直播间连接</span>
      </button>

      <button 
        type="button" 
        class="tab-btn"
        :class="{ active: activeTab === 'session' }" 
        @click="activeTab = 'session'"
      >
        <KeyRound :size="15" />
        <span>抖音登录凭证 (SessionId)</span>
      </button>

      <button 
        type="button" 
        class="tab-btn"
        :class="{ active: activeTab === 'relay' }" 
        @click="activeTab = 'relay'"
      >
        <Share2 :size="15" />
        <span>WebSocket 弹幕转发</span>
      </button>

      <button 
        type="button" 
        class="tab-btn"
        :class="{ active: activeTab === 'behavior' }" 
        @click="activeTab = 'behavior'"
      >
        <Sliders :size="15" />
        <span>运行与自动化行为</span>
      </button>
    </nav>

    <!-- 直播连接 -->
    <section v-if="activeTab === 'room'" class="tab-content-card">
      <div class="pane-header">
        <div class="pane-title-wrap">
          <Radio :size="18" class="icon-brand" />
          <h2>抖音直播间连接</h2>
        </div>
        <span class="pane-desc">支持直接输入房间号或粘贴完整直播间网址，系统自动解析</span>
      </div>

      <div class="form-body">
        <div class="input-action-group">
          <label for="room-id">房间号 / 直播间网址</label>
          <div class="input-with-button">
            <input 
              id="room-id" 
              v-model.trim="config.roomId" 
              placeholder="请输入房间号或如 https://live.douyin.com/7128392182" 
              :disabled="liveState.connection === 'live' || liveState.connection === 'connecting'"
              @input="handleRoomInput"
            />
            <button 
              class="connect-action-btn" 
              :class="{ disconnect: liveState.connection === 'live' }" 
              :disabled="simulationState.active || !configReady || !config.roomId" 
              @click="toggleRoom"
            >
              {{ simulationState.active ? '模拟中' : liveState.connection === 'live' ? '断开连接' : liveState.connection === 'connecting' ? '正在连接…' : '立即连接' }}
            </button>
          </div>
        </div>

        <div class="status-summary-bar" :class="liveState.connection">
          <span class="state-dot"></span>
          <span class="state-text">
            {{ simulationState.active ? '本地模拟直播进行中；真实房间连接已锁定' : liveState.connectionLabel }}
          </span>
          <span v-if="liveState.error && liveState.connection === 'error'" class="state-error-text">
            原因：{{ liveState.error }}
          </span>
          <span v-if="liveState.liveInfo?.nickname" class="anchor-name">
            主播：{{ liveState.liveInfo.nickname }}
          </span>
        </div>

        <!-- 帮助提示 -->
        <div class="connection-tips-box">
          <h4>💡 连接小提示：</h4>
          <ul>
            <li>进入任意抖音直播间，复制浏览器地址栏中的链接粘贴到上方，即可自动截取真实房间号。</li>
            <li>无需下载额外抓包工具，DouAi 已内置长连接协议解析引擎。</li>
            <li>若要获取包含更高准确度的礼物消息，请切换到「抖音登录凭证」页面配置 sessionid。</li>
          </ul>
        </div>
      </div>
    </section>

    <!-- 登录凭证 (SessionId) -->
    <section v-else-if="activeTab === 'session'" class="tab-content-card">
      <div class="pane-header">
        <div class="pane-title-wrap">
          <KeyRound :size="18" class="icon-brand" />
          <h2>抖音登录凭证 (SessionId)</h2>
        </div>
        <span class="pane-desc">获取完整高频直播间数据与粉丝团消息需要登录态，仅需填写 sessionid 即可</span>
      </div>

      <div class="form-body">
        <div class="input-action-group">
          <label for="session-id">sessionid 凭证值</label>
          <div class="input-with-button">
            <input 
              id="session-id" 
              v-model="sessionId" 
              type="password" 
              autocomplete="off" 
              placeholder="粘贴 Cookie 中 sessionid 的值" 
              :disabled="sessionBusy || sessionStatus === 'valid'" 
            />
            <button 
              class="connect-action-btn" 
              :disabled="sessionBusy || !sessionId.trim()" 
              @click="saveSession"
            >
              {{ sessionBusy ? '验证中…' : '验证并保存' }}
            </button>
          </div>
        </div>

        <div class="session-state-bar" :class="sessionStatus">
          <span class="state-dot"></span>
          <span class="session-msg">{{ sessionMessage }}</span>
          <strong v-if="sessionNickname" class="session-nick">账号：{{ sessionNickname }}</strong>
          <button v-if="sessionStatus === 'valid'" class="logout-btn" @click="clearSession">退出登录</button>
        </div>

        <details class="cookie-help-accordion">
          <summary>如何快速获取 sessionid？（点击展开操作教程）</summary>
          <ol>
            <li>在电脑浏览器打开 <a href="https://live.douyin.com/" target="_blank" rel="noreferrer">抖音直播官网</a> 并登录你的抖音账号。</li>
            <li>键盘按下 <code>F12</code> 打开开发者工具，切换到 <strong>Application</strong>（应用程序）→ <strong>Cookies</strong> → <strong>live.douyin.com</strong>。</li>
            <li>在列表中找到名为 <code>sessionid</code> 的项，双击并复制它的 <strong>Value</strong>。</li>
            <li>粘贴到上方输入框，点击「验证并保存」即可。凭证只安全存储于本地浏览器/客户端，不会外泄。</li>
          </ol>
        </details>
      </div>
    </section>

    <!-- 弹幕转发 -->
    <section v-else-if="activeTab === 'relay'" class="tab-content-card">
      <div class="pane-header">
        <div class="pane-title-wrap">
          <Share2 :size="18" class="icon-brand" />
          <h2>WebSocket 弹幕实时转发</h2>
        </div>
        <span class="pane-desc">将解析后的弹幕、礼物、点赞数据通过 WebSocket 实时广播给第三方程序或自建大屏</span>
      </div>

      <div class="form-body">
        <div class="input-action-group">
          <label for="relay-url">WebSocket 接收端地址</label>
          <div class="input-with-button">
            <input 
              id="relay-url" 
              v-model.trim="config.relayUrl" 
              type="text" 
              placeholder="如 ws://127.0.0.1:8765 或 wss://..." 
              :disabled="liveState.relayStatus === 'live' || liveState.relayStatus === 'connecting'" 
            />
            <button 
              class="connect-action-btn" 
              :class="{ disconnect: liveState.relayStatus === 'live' }" 
              :disabled="!configReady || !config.relayUrl" 
              @click="toggleRelay"
            >
              {{ liveState.relayStatus === 'live' ? '停止转发' : liveState.relayStatus === 'connecting' ? '连接中…' : '开启转发' }}
            </button>
          </div>
        </div>

        <div class="status-summary-bar" :class="liveState.relayStatus">
          <span class="state-dot"></span>
          <span>转发服务状态：{{ relayLabel }}</span>
        </div>
      </div>
    </section>

    <!-- 运行行为 -->
    <section v-else class="tab-content-card">
      <div class="pane-header">
        <div class="pane-title-wrap">
          <Sliders :size="18" class="icon-brand" />
          <h2>运行与自动化策略</h2>
        </div>
        <span class="pane-desc">设置连接状态改变时的自动化联动逻辑，配置自动保存到本地 SQLite</span>
      </div>

      <div class="form-body">
        <div class="behavior-toggle-list">
          <label class="behavior-row">
            <div class="behavior-meta">
              <strong>直播间连接成功后自动启动默认游戏</strong>
              <small>连接抖音房间后，自动开启「知识问答」并开始抽题</small>
            </div>
            <input v-model="config.autoStart" type="checkbox" :disabled="!configReady" @change="persist" />
          </label>

          <label class="behavior-row">
            <div class="behavior-meta">
              <strong>直播断开时自动暂停游戏</strong>
              <small>网络波动或下播时暂停游戏计时，重新连接后可无缝继续</small>
            </div>
            <input v-model="config.pauseOnDisconnect" type="checkbox" :disabled="!configReady" @change="persist" />
          </label>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { Radio, KeyRound, Share2, Sliders } from '@lucide/vue';
import { getMeInfo } from '@/core/request';
import { loadConfig, saveConfig } from '@/services/configApi';
import { createDycastSessionManager } from '@/services/dycastSession';
import { connectRoom, disconnectRoom, liveState, simulationState, startRelay, stopRelay } from '@/stores/liveStore';
import { hasCookie, removeCookie, setCookie } from '@/utils/cookieUtil';
import { normalizeQuizTheme, type QuizThemeId } from '@/game/quiz/quizThemes';

const sessionManager = createDycastSessionManager({ hasCookie, removeCookie, setCookie, getMeInfo });
const activeTab = ref<'room' | 'session' | 'relay' | 'behavior'>('room');
const sessionId = ref('');
const sessionStatus = ref<'empty' | 'checking' | 'valid' | 'invalid'>('empty');
const sessionMessage = ref('未设置登录凭证；不填时公开弹幕仍可正常接收');
const sessionNickname = ref('');
const sessionBusy = ref(false);
const configError = ref('');
const configReady = ref(false);

const config = reactive({
  roomId: '',
  relayUrl: '',
  autoStart: false,
  pauseOnDisconnect: true,
  simulationConfig: { durationMinutes: 5, audience: 120, eventIntervalSeconds: 3 },
  quizConfig: {
    theme: 'arena' as QuizThemeId, bank: '基础知识题库', count: 3, answerTime: 30, interval: 5,
    countdown: 5, revealTime: 5, voice: true, autoNext: true, likes: true,
    gameDurationMinutes: 60,
    likeRules: [
      { threshold: 500, effect: 'eliminate' as const, amount: 1 },
      { threshold: 1000, effect: 'extend-time' as const, amount: 10 }
    ],
    giftRules: [
      { minimumCoins: 1, effect: 'answer' as const },
      { minimumCoins: 11, effect: 'win' as const }
    ],
    customBanks: {},
    customQuestions: []
  },
  voiceEnabled: true,
  voiceVolume: 0.85,
  voiceRate: 1,
  voicePrefix: '',
  aiConfig: { baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-4o-mini' }
});

const relayLabel = computed(() => ({
  live: '正在实时转发',
  connecting: '正在连接转发服务…',
  error: '转发连接异常',
  offline: '未开启转发'
})[liveState.relayStatus]);

onMounted(async () => {
  try {
    const saved = await loadConfig();
    Object.assign(config, saved);
    config.quizConfig.theme = normalizeQuizTheme(saved.quizConfig.theme);
    liveState.roomId = config.roomId;
    liveState.relayUrl = config.relayUrl;
    configReady.value = true;
    if (sessionManager.hasSession()) await verifySavedSession();
  } catch (error) {
    configError.value = error instanceof Error ? error.message : 'SQLite 配置读取失败';
  }
});

// 自动从完整链接提取纯房间号
function handleRoomInput() {
  if (!config.roomId) return;
  const match = config.roomId.match(/live\.douyin\.com\/([0-9a-zA-Z_]+)/);
  if (match && match[1]) {
    config.roomId = match[1];
  }
}

async function verifySavedSession() {
  sessionBusy.value = true;
  sessionStatus.value = 'checking';
  sessionMessage.value = '正在验证已保存的登录凭证…';
  const result = await sessionManager.verify();
  sessionStatus.value = result.ok ? 'valid' : 'invalid';
  sessionMessage.value = result.message;
  sessionNickname.value = result.nickname || '';
  sessionBusy.value = false;
}

async function saveSession() {
  sessionBusy.value = true;
  sessionStatus.value = 'checking';
  sessionMessage.value = '正在验证 sessionid…';
  const result = await sessionManager.save(sessionId.value);
  sessionStatus.value = result.ok ? 'valid' : 'invalid';
  sessionMessage.value = result.message;
  sessionNickname.value = result.nickname || '';
  if (result.ok) sessionId.value = '';
  sessionBusy.value = false;
}

function clearSession() {
  sessionManager.clear();
  sessionStatus.value = 'empty';
  sessionMessage.value = '已退出登录；礼物消息需要重新设置 sessionid';
  sessionNickname.value = '';
}

async function persist() {
  if (!configReady.value) return false;
  try {
    await saveConfig(config);
    liveState.roomId = config.roomId;
    liveState.relayUrl = config.relayUrl;
    configError.value = '';
    return true;
  } catch (error) {
    configError.value = error instanceof Error ? error.message : 'SQLite 配置保存失败';
    return false;
  }
}

async function toggleRoom() {
  if (liveState.connection === 'live' || liveState.connection === 'connecting') {
    disconnectRoom();
    return;
  }
  if (!await persist()) return;
  connectRoom(config.roomId);
}

async function toggleRelay() {
  if (liveState.relayStatus === 'live' || liveState.relayStatus === 'connecting') {
    stopRelay();
    return;
  }
  if (!await persist()) return;
  startRelay(config.relayUrl);
}
</script>

<style scoped>
.connect-page {
  padding: 20px 24px 36px;
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-top-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--line);
  gap: 20px;
  flex-wrap: wrap;
}

.sub-category {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: #0b8f69;
}

.header-titles h1 {
  margin: 4px 0 2px;
  font-size: 24px;
  font-weight: 800;
  color: var(--text-main);
}

.header-titles p {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
}

.connection-quick-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  color: #64748b;
}

.badge-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #94a3b8;
}

.connection-quick-badge.live {
  background: #e7f5ef;
  border-color: #b8e3d0;
  color: #065f46;
}
.connection-quick-badge.live .badge-dot {
  background: #0b8f69;
  box-shadow: 0 0 6px rgba(11, 143, 105, 0.6);
}

.connection-quick-badge.connecting {
  background: #fffbeb;
  border-color: #fde68a;
  color: #92400e;
}
.connection-quick-badge.connecting .badge-dot {
  background: #f59e0b;
}

.config-error-banner {
  padding: 10px 14px;
  border-radius: 8px;
  background: #fef2f2;
  border: 1px solid #fca5a5;
  color: #991b1b;
  font-size: 13px;
  margin: 0;
}

.desktop-tabs-nav {
  display: flex;
  gap: 6px;
  background: #ffffff;
  padding: 4px;
  border-radius: 10px;
  border: 1px solid var(--line);
  box-shadow: var(--card-shadow);
  width: fit-content;
}

.tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-muted);
  transition: all 0.15s;
}

.tab-btn:hover {
  color: var(--text-main);
  background: #f8fafc;
}

.tab-btn.active {
  background: #e7f5ef;
  color: #087a5a;
  font-weight: 700;
}

.tab-content-card {
  background: #ffffff;
  border-radius: var(--radius-md);
  border: 1px solid var(--line);
  padding: 24px;
  box-shadow: var(--card-shadow);
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.pane-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-bottom: 14px;
  border-bottom: 1px solid #f1f5f9;
}

.pane-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-brand {
  color: #0b8f69;
}

.pane-title-wrap h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-main);
}

.pane-desc {
  font-size: 12px;
  color: var(--text-muted);
}

.form-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.input-action-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.input-action-group label {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
}

.input-with-button {
  display: flex;
  gap: 10px;
}

.input-with-button input {
  flex: 1;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  font-size: 13px;
  color: var(--text-main);
  outline: none;
  transition: all 0.15s;
}

.input-with-button input:focus {
  border-color: #0b8f69;
  background: #ffffff;
  box-shadow: 0 0 0 2px rgba(11, 143, 105, 0.15);
}

.connect-action-btn {
  padding: 0 22px;
  background: #0b8f69;
  color: #ffffff;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(11, 143, 105, 0.25);
  white-space: nowrap;
  transition: all 0.15s;
}

.connect-action-btn:hover:not(:disabled) {
  background: #087a5a;
}

.connect-action-btn.disconnect {
  background: #fee2e2;
  border: 1px solid #fca5a5;
  color: #b91c1c;
  box-shadow: none;
}
.connect-action-btn.disconnect:hover {
  background: #fecaca;
}

.connect-action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.status-summary-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 12px;
  color: #64748b;
}

.state-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #94a3b8;
}

.status-summary-bar.live .state-dot {
  background: #0b8f69;
}

.status-summary-bar.connecting .state-dot {
  background: #f59e0b;
}

.state-error-text {
  color: #ef4444;
  margin-left: 6px;
}

.anchor-name {
  margin-left: auto;
  font-weight: 700;
  color: var(--text-main);
}

.connection-tips-box {
  background: #f0fdf4;
  border: 1px solid #b8e3d0;
  border-radius: 10px;
  padding: 14px 18px;
}

.connection-tips-box h4 {
  margin: 0 0 8px;
  font-size: 13px;
  color: #166534;
}

.connection-tips-box ul {
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
  color: #15803d;
  line-height: 1.6;
}

.session-state-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 8px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  font-size: 12px;
}

.session-state-bar.valid {
  background: #e7f5ef;
  border-color: #b8e3d0;
  color: #065f46;
}
.session-state-bar.valid .state-dot {
  background: #0b8f69;
}

.session-nick {
  margin-left: auto;
  color: #065f46;
}

.logout-btn {
  font-size: 12px;
  color: #ef4444;
  text-decoration: underline;
  padding: 0 4px;
}

.cookie-help-accordion {
  font-size: 12px;
  color: var(--text-muted);
}

.cookie-help-accordion summary {
  color: #0b8f69;
  font-weight: 600;
  cursor: pointer;
  margin-bottom: 8px;
}

.cookie-help-accordion ol {
  margin: 0;
  padding-left: 20px;
  line-height: 1.7;
}

.behavior-toggle-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.behavior-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-radius: 10px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  cursor: pointer;
  transition: all 0.15s;
}

.behavior-row:hover {
  background: #ffffff;
  border-color: #cbd5e1;
}

.behavior-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.behavior-meta strong {
  font-size: 13px;
  color: var(--text-main);
}

.behavior-meta small {
  font-size: 12px;
  color: var(--text-muted);
}

.behavior-row input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: #0b8f69;
  cursor: pointer;
}

/* Strata page treatment */
.connect-page { background:#f3f4f2; }
.connect-page .connect-card, .connect-page .connection-panel, .connect-page .settings-card { border:1px solid #e3e5e1; border-radius:12px; box-shadow:0 1px 2px rgba(17,24,23,.04); }
.connect-page .primary-btn, .connect-page .connect-btn { background:#0b8f69; border-color:#0b8f69; box-shadow:none; }
.connect-page .primary-btn:hover, .connect-page .connect-btn:hover { background:#087a5a; }
</style>