<template>
  <section class="page">
    <header class="page-heading">
      <div><span class="eyebrow">运行设置</span><h1>运行配置</h1><p>填写房间号并管理直播弹幕与 WS 转发连接。</p></div>
    </header>
    <p v-if="configError" class="config-error" role="alert">{{ configError }}</p>
    <nav class="config-tabs" aria-label="运行配置分区">
      <button type="button" :class="{ active: activeTab === 'room' }" @click="activeTab = 'room'">直播连接</button>
      <button type="button" :class="{ active: activeTab === 'session' }" @click="activeTab = 'session'">登录凭证</button>
      <button type="button" :class="{ active: activeTab === 'relay' }" @click="activeTab = 'relay'">弹幕转发</button>
      <button type="button" :class="{ active: activeTab === 'behavior' }" @click="activeTab = 'behavior'">运行行为</button>
    </nav>

    <section v-if="activeTab === 'room'" class="settings-pane">
      <header class="pane-heading"><h2>直播间连接</h2><p>输入抖音直播间房间号，连接后可在直播控制台查看实时数据。</p></header>
      <div class="modal-form">
        <label for="room-id">抖音房间号</label><div class="action-row"><input id="room-id" v-model.trim="config.roomId" placeholder="请输入抖音直播间房间号" :disabled="liveState.connection === 'live' || liveState.connection === 'connecting'" /><button class="action-btn" :class="{ stop: liveState.connection === 'live' }" :disabled="simulationState.active || !configReady" @click="toggleRoom">{{ simulationState.active ? '模拟中' : liveState.connection === 'live' ? '断开' : liveState.connection === 'connecting' ? '连接中…' : '连接' }}</button></div>
        <div class="status-line"><span class="status-dot" :class="simulationState.active ? 'connecting' : liveState.connection"></span>{{ simulationState.active ? '模拟直播进行中；真实房间连接已锁定' : liveState.connectionLabel }}<span v-if="liveState.error && liveState.connection === 'error'" class="error">{{ liveState.error }}</span></div>
      </div>
    </section>
    <section v-else-if="activeTab === 'session'" class="settings-pane">
      <header class="pane-heading"><h2>抖音登录凭证</h2><p>获取完整直播间消息需要登录态，只需填写 sessionid，不要粘贴整段 Cookie。</p></header>
      <div class="modal-form"><label for="session-id">sessionid</label><div class="session-row"><input id="session-id" v-model="sessionId" type="password" autocomplete="off" placeholder="粘贴 Cookie 中 sessionid 的值" :disabled="sessionBusy || sessionStatus === 'valid'" /><button class="action-btn" :disabled="sessionBusy || !sessionId.trim()" @click="saveSession">{{ sessionBusy ? '验证中…' : '验证并保存' }}</button></div>
        <div class="session-state" :class="sessionStatus"><span class="status-dot" :class="sessionStatus === 'valid' ? 'live' : sessionStatus === 'checking' ? 'connecting' : sessionStatus === 'invalid' ? 'error' : ''"></span><span>{{ sessionMessage }}</span><strong v-if="sessionNickname">{{ sessionNickname }}</strong><button v-if="sessionStatus === 'valid'" class="text-action" @click="clearSession">退出登录</button></div>
        <details class="cookie-help"><summary>如何快速获取 sessionid</summary><ol><li>在浏览器打开 <a href="https://live.douyin.com/" target="_blank" rel="noreferrer">抖音直播</a> 并登录。</li><li>按 F12，在 Application → Cookies → live.douyin.com 中找到 sessionid。</li><li>只复制 Value，粘贴到上方并验证。</li></ol><small>凭证保存在当前浏览器 Cookie 中，不会写入 SQLite。修改后请断开并重新连接直播间。</small></details>
      </div>
    </section>
    <section v-else-if="activeTab === 'relay'" class="settings-pane">
      <header class="pane-heading"><h2>弹幕转发</h2><p>将解析后的直播间消息通过 WebSocket 转发到指定地址。</p></header>
      <div class="modal-form"><label for="relay-url">WebSocket 地址</label><div class="action-row"><input id="relay-url" v-model.trim="config.relayUrl" type="text" inputmode="url" autocomplete="url" placeholder="ws:// 或 wss://" :disabled="liveState.relayStatus === 'live' || liveState.relayStatus === 'connecting'" /><button class="action-btn" :class="{ stop: liveState.relayStatus === 'live' }" :disabled="!configReady" @click="toggleRelay">{{ liveState.relayStatus === 'live' ? '停止' : liveState.relayStatus === 'connecting' ? '连接中…' : '转发' }}</button></div><div class="status-line"><span class="status-dot" :class="liveState.relayStatus"></span>{{ relayLabel }}</div></div>
    </section>
    <section v-else class="settings-pane">
      <header class="pane-heading"><h2>运行行为</h2><p>自动化策略会保存到本地 SQLite 配置库。</p></header>
      <div class="modal-form"><label class="check-row"><span><strong>直播连接成功后自动启动默认游戏</strong><small>当前默认游戏：知识问答</small></span><input v-model="config.autoStart" type="checkbox" :disabled="!configReady" @change="persist" /></label><label class="check-row"><span><strong>直播断开时暂停游戏</strong><small>重新连接后可从控制台继续操作</small></span><input v-model="config.pauseOnDisconnect" type="checkbox" :disabled="!configReady" @change="persist" /></label></div>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
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
const sessionMessage = ref('未设置登录凭证；不填时评论等公开消息仍可正常接收');
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
  live: '转发中',
  connecting: '正在连接转发服务',
  error: '转发连接异常',
  offline: '未转发'
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
.page{max-width:960px;margin:0 auto;padding:34px clamp(20px,4vw,48px) 60px}.page-heading{padding-bottom:22px;border-bottom:1px solid var(--line);margin-bottom:18px}.eyebrow{font-size:11px;color:var(--accent-2);font-weight:700}h1{margin:7px 0 5px;font-size:27px;letter-spacing:0}p{margin:0;color:var(--muted);font-size:12px;line-height:1.6}.config-tabs{display:flex;gap:3px;overflow-x:auto;margin-bottom:20px;border-bottom:1px solid var(--line)}.config-tabs button{flex:none;padding:10px 13px;border:0;border-bottom:2px solid transparent;color:var(--muted);background:transparent;font-size:11px;white-space:nowrap}.config-tabs button.active{border-bottom-color:var(--accent);color:var(--ink)}.settings-pane{max-width:780px;min-height:230px;padding:4px 0}.pane-heading{margin-bottom:22px}.pane-heading h2{margin:0 0 6px;font-size:16px}.pane-heading p{color:var(--muted);font-size:11px}.modal-form>label:not(.check-row){display:block;margin-bottom:8px;color:var(--muted);font-size:11px}.action-row{display:grid;grid-template-columns:minmax(0,1fr) 96px;gap:9px;align-items:center}.action-row input,.session-row input{width:100%;min-width:0;height:38px;padding:0 11px;border:1px solid var(--line);border-radius:5px;outline:none;color:var(--ink);background:#111917;font-size:12px}.action-row input:focus,.session-row input:focus{border-color:var(--accent-2)}.action-row input:disabled,.session-row input:disabled{opacity:.6}.action-btn{height:38px;padding:0 12px;border:1px solid var(--accent);border-radius:5px;background:var(--accent);color:#172016;font-size:12px;font-weight:700}.action-btn.stop{border-color:#a85e52;color:#e6a194;background:rgba(168,94,82,.12)}.status-line{display:flex;align-items:center;gap:8px;padding-top:11px;color:var(--muted);font-size:11px;flex-wrap:wrap}.status-dot{width:7px;height:7px;border-radius:50%;background:var(--faint)}.status-dot.live{background:var(--accent-2)}.status-dot.connecting{background:#e1b968}.status-dot.error{background:#df796b}.error,.config-error{color:#df9589}.config-error{margin:0 0 12px;font-size:12px}.check-row{display:flex;justify-content:space-between;align-items:center;gap:15px;padding:14px 0;border-bottom:1px solid rgba(191,220,204,.08)}.check-row:first-child{padding-top:0}.check-row strong,.check-row small{display:block}.check-row strong{font-size:12px;font-weight:550}.check-row small{margin-top:4px;color:var(--muted);font-size:11px}.check-row input{flex:0 0 auto;width:16px;height:16px;accent-color:var(--accent-2)}.session-row{display:grid;grid-template-columns:minmax(0,1fr) 120px;gap:9px}.action-btn:disabled{opacity:.5;cursor:not-allowed}.session-state{display:flex;align-items:center;gap:8px;padding-top:12px;color:var(--muted);font-size:11px;flex-wrap:wrap}.session-state.valid{color:var(--accent)}.session-state.invalid{color:#df9589}.session-state strong{font-weight:600}.text-action{margin-left:auto;border:0;color:var(--muted);background:none;font-size:11px;text-decoration:underline;text-underline-offset:3px}.cookie-help{margin-top:17px;color:var(--muted);font-size:11px}.cookie-help summary{width:max-content;cursor:pointer;color:var(--accent-2)}.cookie-help ol{display:grid;gap:5px;padding-left:20px;line-height:1.6}.cookie-help a{color:var(--accent)}.cookie-help small{display:block;line-height:1.6;color:var(--faint)}@media(max-width:620px){.page{padding:24px 16px}.config-tabs button{padding:10px 9px}.action-row{grid-template-columns:minmax(0,1fr) 86px}}
</style>
