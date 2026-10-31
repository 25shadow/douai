<template>
  <div class="studio-console-page">
    <!-- 演播室顶栏 -->
    <header class="studio-header">
      <div class="studio-meta">
        <div class="live-dot-indicator" :class="simulationState.active ? 'simulation' : liveState.connection">
          <span class="pulsing-core"></span>
          <span class="status-title">{{ simulationState.active ? '模拟直播演练中' : liveState.connectionLabel }}</span>
        </div>
        <div class="room-anchor-tag">
          <strong>{{ liveState.liveInfo?.nickname || '未连接主播' }}</strong>
          <span v-if="liveState.roomId">房间号：{{ liveState.roomId }}</span>
        </div>
      </div>

      <div class="studio-center-stats">
        <span v-if="simulationState.active" class="timer-pill">剩余 {{ remainingLabel }}</span>
      </div>

      <div class="studio-actions">
        <button 
          v-if="simulationState.active" 
          class="action-btn-danger" 
          type="button" 
          @click="stopLiveSimulation"
        >
          结束模拟
        </button>
        <button 
          v-else 
          class="action-btn-primary" 
          type="button"
          :disabled="!canStartSimulation || startingSimulation || !simulationConfigLoaded"
          @click="openSimulationSetup"
        >
          <Sparkles :size="14" />
          <span>模拟直播演示</span>
        </button>

        <button 
          class="action-btn-secondary" 
          type="button" 
          title="在新窗口独立打开 9:16 游戏画面"
          :disabled="openingGameDisplay"
          @click="openGameDisplay"
        >
          <ExternalLink :size="14" />
          <span>{{ openingGameDisplay ? '打开中…' : '游戏画面窗口' }}</span>
        </button>
      </div>
    </header>
    <p v-if="gameDisplayError" class="game-display-error" role="alert">
      {{ gameDisplayError }}
    </p>

    <!-- 模拟直播配置弹窗 -->
    <AppModal 
      :open="showSimulationConfig && !simulationState.active" 
      title="模拟直播设置" 
      description="在本地模拟观众弹幕、点赞与送礼互动，无需连接真实抖音直播间即可测试全流程。" 
      eyebrow="DEMO SETUP" 
      size="medium"
      @close="showSimulationConfig = false"
    >
      <div class="modal-game-selection">
        <label class="modal-section-title">选择互动游戏</label>
        <label
          v-for="gameMod in registeredGames"
          :key="gameMod.id"
          class="game-select-card"
          :class="{ selected: selectedSimulationGame === gameMod.id }"
        >
          <input v-model="selectedSimulationGame" type="radio" :value="gameMod.id" />
          <div class="game-select-info">
            <strong>{{ gameMod.name }}</strong>
            <small>{{ gameMod.description }}</small>
          </div>
          <span class="game-ready-badge">独立模块</span>
        </label>
      </div>

      <div class="modal-form-grid">
        <div class="form-field">
          <label>演练模式</label>
          <select v-model="selectedSimulationMode">
            <option value="demo">演示模式 · 一键播放</option>
            <option value="rehearsal">彩排模式 · 可暂停</option>
            <option value="qa">验收模式 · 单步推进</option>
          </select>
        </div>
        <div class="form-field">
          <label>模拟时长（分钟）</label>
          <input v-model.number="simulationDraft.durationMinutes" type="number" min="1" max="180" />
        </div>
        <div class="form-field">
          <label>虚拟在线观众数</label>
          <input v-model.number="simulationDraft.audience" type="number" min="10" max="99999" step="10" />
        </div>
        <div class="form-field">
          <label>弹幕推送间隔（秒）</label>
          <input v-model.number="simulationDraft.eventIntervalSeconds" type="number" min="1" max="60" />
        </div>
      </div>

      <p class="mode-hint">
        {{ selectedSimulationMode === 'qa'
          ? '验收模式不会自动推进，使用单步执行每个脚本事件。'
          : selectedSimulationMode === 'rehearsal'
            ? '彩排模式按时间轴推进，可随时暂停、继续或跳过。'
            : '演示模式会自动播放预置脚本，适合快速展示完整流程。' }}
      </p>

      <p v-if="configError" class="modal-error-msg" role="alert">{{ configError }}</p>

      <template #footer>
        <small>点击开始后将自动启动游戏并生成真实互动流</small>
        <button 
          class="modal-confirm-btn" 
          type="button" 
          :disabled="!selectedSimulationGame || !canStartSimulation || startingSimulation" 
          @click="startDemo"
        >
          {{ startingSimulation ? '准备中…' : '立即开始模拟' }}
        </button>
      </template>
    </AppModal>

    <section v-if="simulationState.active" class="simulation-transport" aria-label="模拟直播控制">
      <div class="transport-status">
        <span class="transport-dot" :class="simulationState.status"></span>
        <strong>{{ simulationState.mode === 'qa' ? '验收模式' : simulationState.mode === 'rehearsal' ? '彩排模式' : '演示模式' }}</strong>
        <span class="transport-muted">{{ simulationState.status === 'paused' ? '已暂停' : simulationState.status === 'running' ? '播放中' : simulationState.status === 'ready' ? '待开始' : simulationState.status }}</span>
        <span class="transport-progress">{{ simulationState.cursor }} / {{ simulationState.timeline.length }} 个事件</span>
      </div>
      <div class="transport-actions">
        <button v-if="simulationState.status !== 'running'" class="transport-btn primary" type="button" @click="toggleSimulationPause">
          <Play :size="13" /><span>{{ simulationState.status === 'ready' ? '开始' : '继续' }}</span>
        </button>
        <button v-else class="transport-btn" type="button" @click="pauseLiveSimulation">
          <Pause :size="13" /><span>暂停</span>
        </button>
        <button class="transport-btn" type="button" :disabled="simulationState.mode !== 'qa' && simulationState.status !== 'paused'" @click="stepLiveSimulation">
          <SkipForward :size="13" /><span>单步</span>
        </button>
        <button class="transport-btn danger" type="button" @click="stopLiveSimulation()">
          结束演练
        </button>
      </div>
    </section>

    <!-- 演播室三大核心工作区：左侧控制板 | 中间核心直播预览 | 右侧实时弹幕流 -->
    <div class="studio-workbench-layout">
      
      <!-- ================= 1. 左侧面板：直播间数据 & 伴侣推流状态 ================= -->
      <aside class="studio-left-dock">
        <!-- 四项直播间数据 -->
        <div class="dock-section">
          <div class="dock-title-row">
            <Radio :size="14" class="title-icon" />
            <span class="dock-title">实时数据指标</span>
          </div>
          <div class="mini-metrics-grid">
            <div class="mini-metric">
              <span class="m-title">在线观众</span>
              <strong class="m-num">{{ format(liveState.audience) }}</strong>
            </div>
            <div class="mini-metric">
              <span class="m-title">本场点赞</span>
              <strong class="m-num">{{ format(liveState.likes) }}</strong>
            </div>
            <div class="mini-metric">
              <span class="m-title">粉丝关注</span>
              <strong class="m-num">{{ format(liveState.followers) }}</strong>
            </div>
            <div class="mini-metric">
              <span class="m-title">累计观看</span>
              <strong class="m-num">{{ format(liveState.totalUsers) }}</strong>
            </div>
          </div>
        </div>

        <!-- 抖音伴侣推流与连接状态 -->
        <div class="dock-section stream-info-section">
          <div class="dock-title-row">
            <ShieldCheck :size="14" class="title-icon" />
            <span class="dock-title">直播连接</span>
          </div>
          <div class="stream-status-box">
            <div class="status-indicator-row">
              <span class="status-ping-dot" :class="{ live: liveState.connection === 'live' || simulationState.active }"></span>
              <strong>{{ simulationState.active ? '模拟中' : liveState.connectionLabel }}</strong>
            </div>
            <div class="stream-meta-line">
              <span>房间 ID：</span>
              <b>{{ liveState.roomId || '未配置' }}</b>
            </div>
            <div class="stream-meta-line">
              <span>互动模块：</span>
              <b :style="{ color: activeGameModule ? '#0b8f69' : '#64748b' }">
                {{ activeGameModule ? `运行中 · ${activeGameModule.name}` : '未启动 (待机)' }}
              </b>
            </div>
          </div>

          <div v-if="simulationState.active" class="timeline-box">
            <div class="timeline-heading">
              <span>脚本时间线</span>
              <small>{{ simulationState.timeline.filter(item => item.executed).length }} 已执行</small>
            </div>
            <div class="timeline-list">
              <div
                v-for="(item, index) in visibleTimeline"
                :key="item.id"
                class="timeline-item"
                :class="{ executed: item.executed, current: index === simulationState.cursor }"
              >
                <span class="timeline-index">{{ index + 1 }}</span>
                <span class="timeline-label">{{ item.label || item.type }}</span>
                <small>{{ item.atSeconds }}s</small>
              </div>
            </div>
          </div>

          <div class="dock-quick-actions">
            <button
              class="dock-action-btn secondary"
              type="button"
              @click="emit('navigate', 'connect')"
            >
              <Radio :size="14" />
              <span>连接设置</span>
            </button>
          </div>
        </div>
      </aside>

      <!-- ================= 2. 主控工作区：用明确状态和动作替代大面积直播预览 ================= -->
      <main class="studio-control-stage">
        <section class="control-action-panel">
          <div class="panel-heading">
            <h3>游戏控制</h3>
            <span class="status-label" :class="{ good: !!activeGameModule }">{{ activeGameModule ? '运行中' : '待机' }}</span>
          </div>
          <div class="game-control-list">
            <div v-for="game in registeredGames" :key="game.id" class="game-control-row">
              <Gamepad2 :size="18" class="title-icon" />
              <div class="game-control-name">
                <strong>{{ game.name }}</strong>
                <small>{{ game.badge }} · {{ game.isRunning() ? '运行中' : '未启动' }}</small>
              </div>
              <button class="text-action" type="button" @click="emit('navigate', game.id)">配置 <ArrowRight :size="14" /></button>
            </div>
          </div>
          <div v-if="activeGameModule" class="current-game-line">
            <strong>{{ activeGameModule.name }}</strong>
            <span>{{ activeGameModule.getStatusText() }}</span>
          </div>
          <div class="game-control-footer">
            <button class="dock-action-btn primary" type="button" @click="emit('navigate', 'games')"><Gamepad2 :size="14" />游戏大厅</button>
            <button v-if="activeGameModule" class="dock-action-btn danger" type="button" @click="stopAllRunningGames"><CircleStop :size="14" />结束游戏</button>
          </div>
        </section>

        <section class="console-tools-section">
          <div class="panel-heading"><h3>常用操作</h3></div>
          <div class="console-tools-grid">
            <button type="button" :disabled="openingGameDisplay" @click="openGameDisplay">
              <ExternalLink :size="17" aria-hidden="true" />
              <span>{{ openingGameDisplay ? '打开中…' : '游戏画面' }}</span>
            </button>
            <button type="button" @click="emit('navigate', 'connect')">
              <Radio :size="17" aria-hidden="true" /><span>连接设置</span>
            </button>
            <button type="button" @click="emit('navigate', 'bgm')">
              <Music :size="17" aria-hidden="true" /><span>音乐音效</span>
            </button>
            <button type="button" @click="emit('navigate', 'voice')">
              <Volume2 :size="17" aria-hidden="true" /><span>语音播报</span>
            </button>
          </div>
        </section>

        <section class="console-session-section">
          <div class="panel-heading">
            <h3>本场概况</h3>
            <span class="status-label" :class="{ good: simulationState.active || liveState.connection === 'live' }">
              {{ simulationState.active ? '模拟中' : liveState.connectionLabel }}
            </span>
          </div>
          <dl class="console-session-details">
            <div><dt>当前游戏</dt><dd>{{ activeGameModule?.name || '未启动' }}</dd></div>
            <div><dt>互动记录</dt><dd>{{ liveState.activityFeed.length }} 条</dd></div>
            <div><dt>运行模式</dt><dd>{{ simulationState.active ? '模拟演练' : '真实直播' }}</dd></div>
            <div v-if="simulationState.active"><dt>脚本进度</dt><dd>{{ simulationState.cursor }} / {{ simulationState.timeline.length }}</dd></div>
          </dl>
          <div class="console-output-summary"><ExternalLink :size="13" aria-hidden="true" /><span>游戏画面</span><strong>1080 × 1920 · 9:16</strong></div>
        </section>
      </main>

      <!-- ================= 3. 右侧面板：实时弹幕互动流 ================= -->
      <aside class="studio-right-dock">
        <div class="feed-dock-header">
          <div class="feed-dock-title">
            <MessageSquare :size="15" class="title-icon" />
            <span class="dock-title">实时弹幕互动</span>
          </div>
          <span class="feed-count-badge">{{ filteredFeed.length }} 条</span>
        </div>

        <div v-if="simulationState.active" class="right-interaction-panel">
          <div class="right-panel-heading">
            <div>
              <strong>人工互动</strong>
            </div>
            <span class="right-panel-badge">{{ simulationState.queue.length }} 待发</span>
          </div>
          <div class="manual-type-switch">
            <button type="button" :class="{ active: manualDraft.type === 'chat' }" @click="manualDraft.type = 'chat'"><MessageCircle :size="13" /> 评论</button>
            <button type="button" :class="{ active: manualDraft.type === 'like' }" @click="manualDraft.type = 'like'"><Heart :size="13" /> 点赞</button>
            <button type="button" :class="{ active: manualDraft.type === 'gift' }" @click="manualDraft.type = 'gift'"><Gift :size="13" /> 礼物</button>
          </div>
          <div class="manual-form-grid">
            <input v-model.trim="manualDraft.actorName" placeholder="观众昵称" />
            <input v-if="manualDraft.type === 'chat'" v-model.trim="manualDraft.text" placeholder="评论内容，例如 A" />
            <input v-else v-model.number="manualDraft.count" type="number" min="1" placeholder="数量" />
            <template v-if="manualDraft.type === 'gift'">
              <input v-model.trim="manualDraft.giftName" placeholder="礼物名称" />
              <input v-model.number="manualDraft.price" type="number" min="1" placeholder="单价" />
            </template>
          </div>
          <div class="manual-actions-row">
            <button type="button" class="manual-send-btn" @click="sendManualInteraction">立即发送</button>
            <button type="button" class="manual-send-btn secondary" @click="queueManualInteraction">加入队列</button>
          </div>
          <div v-if="simulationState.queue.length" class="right-queue-row">
            <button type="button" @click="dispatchNextSimulationEvent">发送下一条</button>
            <button type="button" @click="clearSimulationQueue">清空队列</button>
          </div>
          <div v-if="simulationState.history.length" class="right-history-strip">
            <span>最近：{{ simulationState.history[0].payload.name }} · {{ simulationState.history[0].label }}</span>
            <b :class="simulationState.history[0].status">
              {{ simulationState.history[0].status === 'claimed' ? '已消费' : simulationState.history[0].status === 'ignored' ? '已忽略' : '已发送' }}
            </b>
          </div>
        </div>

        <!-- 弹幕分类过滤过滤器 -->
        <div class="feed-filter-bar">
          <button 
            v-for="filter in feedFilters" 
            :key="filter.id"
            class="filter-pill"
            :class="{ active: activeFeedFilter === filter.id }"
            type="button"
            @click="activeFeedFilter = filter.id"
          >
            {{ filter.name }}
          </button>
        </div>

        <!-- 弹幕消息列表 -->
        <div class="feed-stream-container">
          <div v-if="filteredFeed.length" class="feed-stream-list">
            <div 
              v-for="item in visibleFeed"
              :key="item.id" 
              class="feed-bubble"
              :class="`kind-${item.kind}`"
            >
              <UserAvatar :src="item.userAvatar" :name="item.userName" />
              <div class="bubble-body">
                <div class="bubble-header">
                  <span class="sender-name">{{ item.userName }}</span>
                  <span class="kind-tag" :class="item.kind">
                    {{ item.kind === 'gift' ? '送礼' : item.kind === 'like' ? '点赞' : '评论' }}
                  </span>
                  <span class="bubble-time">{{ formatTime(item.timestamp) }}</span>
                </div>
                <div class="bubble-text">
                  <img v-if="item.kind === 'gift' && item.giftIcon" class="gift-icon" :src="item.giftIcon" alt="" />
                  <span>{{ item.detail }}</span>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="feed-empty-hint">
            <MessageSquare :size="28" class="empty-icon" />
            <p>暂无互动数据</p>
            <small>连接直播间或开启模拟，弹幕将在此滚动</small>
          </div>
        </div>
      </aside>

    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { 
  Radio, MessageSquare, Sparkles, ExternalLink, ShieldCheck, Gamepad2, Play, Pause, SkipForward, MessageCircle, Gift, Heart, CircleStop, ArrowRight, Music, Volume2
} from '@lucide/vue';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import {
  liveState,
  simulationState,
  startLiveSimulation,
  stopLiveSimulation,
  pauseLiveSimulation,
  resumeLiveSimulation,
  stepLiveSimulation,
  injectSimulationEvent,
  queueSimulationEvent,
  dispatchNextSimulationEvent,
  clearSimulationQueue
} from '@/stores/liveStore';
import {
  canStartLiveSimulation,
  createManualInteractionEvent,
  defaultLiveSimulationConfig,
  normalizeSimulationConfig,
  type SimulationGameId,
  type SimulationMode
} from '@/services/liveSimulation';
import {
  GAME_DISPLAY_WINDOW_LABEL,
  getGameDisplayUrl,
  getGameDisplayWindowOptions,
  isTauriRuntime
} from '@/services/gameDisplayWindow';
import { activeGameModule, getGameModule, registeredGames, stopAllRunningGames } from '@/game/gameRegistry';
import { loadConfig, saveConfig } from '@/services/configApi';
import AppModal from '@/components/AppModal.vue';
import UserAvatar from '@/components/UserAvatar.vue';

const emit = defineEmits<{
  navigate: [page: string];
}>();

const gameDisplayUrl = computed(() => getGameDisplayUrl(location.origin, location.pathname));

const showSimulationConfig = ref(false);
const startingSimulation = ref(false);
const simulationConfigLoaded = ref(false);
const openingGameDisplay = ref(false);
const gameDisplayError = ref('');
const selectedSimulationGame = ref<SimulationGameId>('quiz');
const selectedSimulationMode = ref<SimulationMode>('demo');
const configError = ref('');
const canStartSimulation = computed(() => canStartLiveSimulation(liveState.connection, simulationState.active));
const simulationDraft = reactive({ ...defaultLiveSimulationConfig });
const manualDraft = reactive({
  type: 'chat' as 'chat' | 'like' | 'gift',
  actorName: '现场观众',
  text: 'A',
  count: 1,
  giftName: '小心心',
  price: 1
});

const remainingLabel = computed(() => {
  const seconds = Math.max(0, simulationState.durationSeconds - simulationState.elapsedSeconds);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
});

// 弹幕过滤
const feedFilters = [
  { id: 'all', name: '全部' },
  { id: 'gift', name: '礼物' },
  { id: 'chat', name: '评论' },
  { id: 'like', name: '点赞' }
];
const activeFeedFilter = ref('all');

const filteredFeed = computed(() => {
  if (activeFeedFilter.value === 'all') return liveState.activityFeed;
  return liveState.activityFeed.filter(item => item.kind === activeFeedFilter.value);
});
const visibleFeed = computed(() => filteredFeed.value.slice(0, 8));
const visibleTimeline = computed(() => simulationState.timeline.slice(0, 6));

onMounted(async () => {
  try {
    const saved = await loadConfig();
    Object.assign(simulationDraft, normalizeSimulationConfig(saved.simulationConfig));
    for (const mod of registeredGames) {
      mod.applySavedConfig(saved);
    }
    liveState.roomId = saved.roomId;
    liveState.relayUrl = saved.relayUrl;
  } catch (error) {
    configError.value = error instanceof Error ? error.message : '配置加载失败';
  } finally {
    simulationConfigLoaded.value = true;
  }
});


function openSimulationSetup() {
  selectedSimulationGame.value = (registeredGames[0]?.id as SimulationGameId) || 'quiz';
  selectedSimulationMode.value = 'demo';
  configError.value = '';
  showSimulationConfig.value = true;
}

async function startDemo() {
  if (!selectedSimulationGame.value || !canStartSimulation.value || startingSimulation.value) return;
  startingSimulation.value = true;
  configError.value = '';
  try {
    const config = normalizeSimulationConfig({ ...simulationDraft, mode: selectedSimulationMode.value });
    Object.assign(simulationDraft, config);
    const saved = await loadConfig();
    await saveConfig({ ...saved, simulationConfig: config });
    getGameModule(selectedSimulationGame.value)?.applySavedConfig(saved);
    if (startLiveSimulation(selectedSimulationGame.value, config)) {
      showSimulationConfig.value = false;
    }
  } catch (error) {
    configError.value = error instanceof Error ? error.message : '无法启动模拟直播';
  } finally {
    startingSimulation.value = false;
  }
}

function toggleSimulationPause() {
  if (simulationState.status === 'paused' || simulationState.status === 'ready') resumeLiveSimulation();
  else if (simulationState.status === 'running') pauseLiveSimulation();
}

function buildManualInteraction() {
  const event = createManualInteractionEvent(manualDraft.type, {
    actorName: manualDraft.actorName,
    text: manualDraft.type === 'chat'
      ? (manualDraft.text || (selectedSimulationGame.value === 'versus' ? '1A' : 'A'))
      : undefined,
    count: manualDraft.count,
    giftName: manualDraft.giftName,
    price: manualDraft.price
  });
  return event;
}

function sendManualInteraction() {
  injectSimulationEvent(buildManualInteraction());
}

function queueManualInteraction() {
  queueSimulationEvent(buildManualInteraction());
}

async function openGameDisplay() {
  if (openingGameDisplay.value) return;
  openingGameDisplay.value = true;
  gameDisplayError.value = '';

  try {
    if (!isTauriRuntime()) {
      const popup = window.open(gameDisplayUrl.value, 'douai-game-display', 'width=460,height=820,menubar=no,toolbar=no');
      if (!popup) {
        gameDisplayError.value = '浏览器阻止了新窗口，请允许弹出窗口后重试。';
      }
      return;
    }

    const existing = await WebviewWindow.getByLabel(GAME_DISPLAY_WINDOW_LABEL);
    if (existing) {
      await existing.show();
      await existing.setFocus();
      return;
    }

    const gameDisplayWindow = new WebviewWindow(
      GAME_DISPLAY_WINDOW_LABEL,
      getGameDisplayWindowOptions(gameDisplayUrl.value),
    );
    await gameDisplayWindow.once('tauri://error', () => {
      gameDisplayError.value = '游戏画面窗口创建失败，请重启软件后重试。';
    });
  } catch (error) {
    gameDisplayError.value = error instanceof Error
      ? `游戏画面窗口打开失败：${error.message}`
      : '游戏画面窗口打开失败，请重试。';
  } finally {
    openingGameDisplay.value = false;
  }
}

function format(value: number) {
  return Number.isFinite(value) && value > 0
    ? new Intl.NumberFormat('zh-CN', { notation: 'compact' }).format(value)
    : '0';
}

function formatTime(timestamp?: number) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}
</script>

<style scoped>
.studio-console-page {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: max-content;
  min-width: 0;
  min-height: 0;
  padding: 10px 12px 12px;
  gap: 8px;
  background: var(--bg-app);
  box-sizing: border-box;
  overflow: visible;
}

/* 演播室顶栏 */
.studio-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  flex-wrap: nowrap;
  padding: 10px 16px;
  background: #ffffff;
  border-radius: var(--radius-md);
  border: 1px solid var(--line);
  box-shadow: var(--card-shadow);
  flex-shrink: 0;
}

.game-display-error {
  margin: -4px 2px 0;
  color: #b91c1c;
  font-size: 12px;
}

.studio-meta {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 16px;
}

.live-dot-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 12px;
  border-radius: 20px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
}

.pulsing-core {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #94a3b8;
}

.live-dot-indicator.live {
  background: #e7f5ef;
  border-color: #b8e3d0;
  color: #065f46;
}
.live-dot-indicator.live .pulsing-core {
  background: #0b8f69;
  box-shadow: 0 0 8px rgba(11, 143, 105, 0.7);
}

.live-dot-indicator.simulation {
  background: #f5f3ff;
  border-color: #ddd6fe;
  color: #5b21b6;
}
.live-dot-indicator.simulation .pulsing-core {
  background: #8b5cf6;
  box-shadow: 0 0 8px rgba(139, 92, 246, 0.7);
}

.room-anchor-tag {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 8px;
  font-size: 12px;
}
.room-anchor-tag strong {
  color: var(--text-main);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.room-anchor-tag span {
  color: var(--text-muted);
}

.studio-center-stats {
  display: flex;
  align-items: center;
  min-width: 0;
  flex: 1;
  justify-content: center;
  gap: 10px;
}

.resolution-pill {
  font-size: 11px;
  font-family: ui-monospace, monospace;
  padding: 4px 10px;
  border-radius: 6px;
  background: #f1f5f9;
  color: #475569;
}

.timer-pill {
  font-size: 12px;
  font-weight: 700;
  font-family: ui-monospace, monospace;
  padding: 4px 10px;
  border-radius: 6px;
  background: #f5f3ff;
  color: #7c3aed;
}

.studio-actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 8px;
}

.action-btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 8px;
  background: #0b8f69;
  color: #ffffff;
  font-size: 12px;
  font-weight: 600;
  transition: all 0.15s;
}
.action-btn-primary:hover:not(:disabled) {
  background: #087a5a;
}

.action-btn-danger {
  padding: 6px 14px;
  border-radius: 8px;
  background: #fee2e2;
  border: 1px solid #fca5a5;
  color: #b91c1c;
  font-size: 12px;
  font-weight: 600;
}

.action-btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #334155;
  font-size: 12px;
  font-weight: 500;
}
.action-btn-secondary:hover {
  background: #f8fafc;
}

/* 演播室 3 列工作台布局 (左侧控制 | 中间9:16满屏主画面 | 右侧弹幕互动) */
.studio-workbench-layout {
  display: grid;
  grid-template-columns: minmax(190px, 0.82fr) minmax(220px, 0.62fr) minmax(230px, 0.98fr);
  gap: 10px;
  width: 100%;
  flex: 1 0 auto;
  min-height: 620px;
  min-width: 0;
  overflow: visible;
  align-items: start;
}

/* ================= 1. 左侧面板 ================= */
.studio-left-dock {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  height: auto;
  overflow: visible;
  min-width: 0;
}

.dock-section {
  background: #ffffff;
  border-radius: var(--radius-md);
  border: 1px solid var(--line);
  padding: 14px;
  box-shadow: var(--card-shadow);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.stream-info-section {
  flex: 1;
  justify-content: space-between;
}

.dock-quick-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: auto;
  padding-top: 6px;
}

.dock-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  transition: all 0.15s;
}

.dock-action-btn.primary {
  background: #e7f5ef;
  color: #087a5a;
  border: 1px solid #b8e3d0;
}
.dock-action-btn.primary:hover {
  background: #0b8f69;
  color: #ffffff;
}

.dock-action-btn.secondary {
  background: #f8fafc;
  color: #475569;
  border: 1px solid #e2e8f0;
}
.dock-action-btn.secondary:hover {
  background: #f1f5f9;
  color: #1e293b;
}

.dock-action-btn.danger {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}
.dock-action-btn.danger:hover {
  background: #ef4444;
  color: #ffffff;
}

.dock-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.title-icon {
  color: #0b8f69;
}

.dock-title {
  font-size: 12px;
  font-weight: 700;
  color: #334155;
}

.mini-metrics-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.mini-metric {
  background: #f8fafc;
  border: 1px solid #f1f5f9;
  border-radius: 8px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.m-title {
  font-size: 11px;
  color: var(--text-muted);
}

.m-num {
  font-size: 18px;
  font-weight: 800;
  color: var(--text-main);
  font-family: ui-monospace, sans-serif;
}

/* 伴侣推流信息卡片 */
.stream-status-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.status-indicator-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #334155;
}

.status-ping-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #94a3b8;
}
.status-ping-dot.live {
  background: #0b8f69;
  box-shadow: 0 0 6px rgba(11, 143, 105, 0.8);
}

.stream-meta-line {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #64748b;
}
.stream-meta-line b {
  color: #1e293b;
}

.sound-quick-triggers {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.sound-trigger-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 4px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  border: 1px solid transparent;
  transition: all 0.15s;
}

.sound-trigger-btn.green {
  background: #e7f5ef;
  color: #065f46;
  border-color: #b8e3d0;
}
.sound-trigger-btn.red {
  background: #fef2f2;
  color: #991b1b;
  border-color: #fca5a5;
}
.sound-trigger-btn.amber {
  background: #fffbeb;
  color: #92400e;
  border-color: #fde68a;
}
.sound-trigger-btn.purple {
  background: #f5f3ff;
  color: #5b21b6;
  border-color: #ddd6fe;
}
.sound-trigger-btn.blue {
  background: #eff6ff;
  color: #1e40af;
  border-color: #bfdbfe;
}

.sound-trigger-btn:hover {
  filter: brightness(0.95);
  transform: translateY(-1px);
}

/* ================= 2. 中间舞台：9:16 主监视器 ================= */
.studio-center-stage {
  display: flex;
  justify-content: stretch;
  align-items: stretch;
  height: auto;
  min-height: 620px;
  height: 100%;
  min-width: 0;
  overflow: hidden;
}

.monitor-card {
  background: #d9e2ee;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  min-width: 0;
  min-height: 0;
  min-height: 620px;
  max-width: none;
  padding: 8px;
  overflow: hidden;
  box-shadow: none;
}

.monitor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  background: #090d16;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.monitor-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rec-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #64748b;
}

.rec-dot.active {
  background: #ef4444;
  box-shadow: 0 0 8px #ef4444;
  animation: blink 1.4s infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.monitor-name {
  font-size: 12px;
  font-weight: 700;
  color: #f8fafc;
}

.monitor-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.scale-label {
  font-size: 11px;
  color: #94a3b8;
  font-family: ui-monospace, monospace;
}

.copy-url-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
  color: #cbd5e1;
  font-size: 11px;
  transition: all 0.15s;
}
.copy-url-btn:hover {
  background: #0b8f69;
  color: #ffffff;
}

/* 监视器满高满宽直播视口 (把此窗口就当成实际直播窗口，铺满不缩小！) */
.monitor-live-viewport {
  flex: 1;
  min-height: 0;
  width: 100%;
  position: relative;
  overflow: hidden;
  background: #dbe4ee;
  display: flex;
  flex-direction: column;
}

.broadcast-viewport-fill {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}

.monitor-canvas-scaled {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 1080px;
  height: 1920px;
  transform-origin: center center;
}

/* 抖音直播待播画面 (1080×1920 标准画布坐标系，等比缩放，任何分辨率下绝不挤压变形) */
.douyin-live-standby-view {
  width: 1080px;
  height: 1920px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 64px 68px 60px;
  background:
    radial-gradient(circle at 50% 28%, rgba(11, 143, 105, 0.16) 0%, transparent 52%),
    radial-gradient(circle at 50% 35%, #1e293b 0%, #090d16 85%);
  color: #ffffff;
  position: relative;
  box-sizing: border-box;
}

.standby-top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
}

.host-pill {
  display: flex;
  align-items: center;
  gap: 22px;
  background: rgba(15, 23, 42, 0.72);
  backdrop-filter: blur(12px);
  padding: 14px 36px 14px 16px;
  border-radius: 999px;
  border: 2px solid rgba(255, 255, 255, 0.14);
}

.host-avatar {
  width: 84px;
  height: 84px;
  border-radius: 50%;
  background: linear-gradient(135deg, #0b8f69, #06b6d4);
  display: grid;
  place-items: center;
  font-size: 38px;
  font-weight: 800;
  color: #ffffff;
  flex-shrink: 0;
}

.host-text {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.host-text strong {
  display: block;
  font-size: 34px;
  font-weight: 800;
  color: #f8fafc;
  line-height: 1.15;
  white-space: nowrap;
}
.host-text small {
  display: block;
  font-size: 24px;
  color: #94a3b8;
  white-space: nowrap;
}

.audience-badge {
  font-size: 30px;
  font-weight: 700;
  padding: 18px 34px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.72);
  color: #e2e8f0;
  border: 2px solid rgba(255, 255, 255, 0.12);
  white-space: nowrap;
  flex-shrink: 0;
}

.standby-center-visual {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 40px 24px;
}

.camera-standby-ring {
  width: 188px;
  height: 188px;
  border-radius: 50%;
  background: rgba(11, 143, 105, 0.12);
  border: 4px dashed #0b8f69;
  display: grid;
  place-items: center;
  margin-bottom: 42px;
  box-shadow: 0 0 60px rgba(11, 143, 105, 0.22);
  animation: pulse-ring 3s infinite;
}

@keyframes pulse-ring {
  0%, 100% { transform: scale(1); opacity: 0.95; }
  50% { transform: scale(1.05); opacity: 0.7; }
}

.standby-icon {
  color: #0b8f69;
}

.standby-signal-pill {
  font-size: 24px;
  font-weight: 700;
  font-family: ui-monospace, monospace;
  padding: 10px 28px;
  border-radius: 999px;
  background: rgba(11, 143, 105, 0.14);
  color: #34d399;
  border: 1px solid rgba(11, 143, 105, 0.35);
  margin-bottom: 28px;
  letter-spacing: 0.04em;
}

.standby-center-visual h3 {
  margin: 0 0 24px;
  font-size: 56px;
  font-weight: 800;
  color: #f8fafc;
  letter-spacing: 0.02em;
}

.standby-desc {
  margin: 0 0 56px;
  font-size: 32px;
  color: #94a3b8;
  line-height: 1.65;
  max-width: 820px;
}

.standby-quick-buttons {
  display: flex;
  flex-direction: column;
  width: 680px;
  gap: 26px;
}

.standby-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  padding: 30px 44px;
  border-radius: 999px;
  font-size: 34px;
  font-weight: 800;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
}

.standby-btn.primary {
  background: linear-gradient(135deg, #0b8f69, #087a5a);
  color: #ffffff;
  border: none;
  box-shadow: 0 12px 32px rgba(11, 143, 105, 0.38);
}
.standby-btn.primary:hover {
  filter: brightness(1.06);
}

.standby-btn.secondary {
  background: rgba(255, 255, 255, 0.09);
  color: #e2e8f0;
  border: 2px solid rgba(255, 255, 255, 0.18);
}
.standby-btn.secondary:hover {
  background: rgba(255, 255, 255, 0.16);
}

.standby-bottom-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
  padding-top: 28px;
}

.fake-chat-input {
  flex: 1;
  padding: 24px 36px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.68);
  border: 2px solid rgba(255, 255, 255, 0.12);
  color: #64748b;
  font-size: 28px;
}

.fake-action-icons {
  display: flex;
  align-items: center;
  gap: 20px;
}

.fake-icon {
  width: 82px;
  height: 82px;
  border-radius: 50%;
  background: rgba(15, 23, 42, 0.68);
  border: 2px solid rgba(255, 255, 255, 0.12);
  display: grid;
  place-items: center;
  font-size: 36px;
}

.monitor-footer {
  padding: 8px 14px;
  background: #090d16;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.footer-tip {
  font-size: 11px;
  color: #94a3b8;
}

.footer-tip strong {
  color: #0b8f69;
}

/* ================= 3. 右侧面板：实时弹幕互动流 ================= */
.studio-right-dock {
  background: #ffffff;
  border-radius: var(--radius-md);
  border: 1px solid var(--line);
  box-shadow: var(--card-shadow);
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  overflow: visible;
}

.feed-dock-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid #f1f5f9;
  flex-shrink: 0;
}

.feed-dock-title {
  display: flex;
  align-items: center;
  gap: 6px;
}

.feed-count-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 10px;
  background: #e7f5ef;
  color: #087a5a;
}

.right-interaction-panel {
  padding: 10px 12px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
}
.right-panel-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.right-panel-heading strong {
  display: block;
  color: #1e293b;
  font-size: 12px;
}
.right-panel-heading small {
  display: block;
  margin-top: 2px;
  color: #94a3b8;
  font-size: 10px;
}
.right-panel-badge {
  padding: 2px 6px;
  border-radius: 4px;
  background: #fff7ed;
  color: #c2410c;
  font-size: 10px;
  font-weight: 700;
}
.right-interaction-panel .manual-form-grid {
  margin-top: 6px;
}
.right-interaction-panel .manual-actions-row {
  margin-top: 6px;
}
.right-queue-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5px;
  margin-top: 6px;
}
.right-queue-row button {
  height: 25px;
  border: 1px solid #fed7aa;
  border-radius: 5px;
  background: #fff;
  color: #9a3412;
  font-size: 10px;
  font-weight: 700;
}
.right-history-strip {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-top: 7px;
  padding-top: 7px;
  border-top: 1px solid #e2e8f0;
  color: #64748b;
  font-size: 10px;
}
.right-history-strip span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.right-history-strip b.claimed { color: #087a5a; }
.right-history-strip b.ignored { color: #94a3b8; }

.feed-filter-bar {
  display: flex;
  gap: 4px;
  padding: 8px 12px;
  background: #f8fafc;
  border-bottom: 1px solid #f1f5f9;
  flex-shrink: 0;
}

.filter-pill {
  flex: 1;
  padding: 4px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-muted);
  background: transparent;
  transition: all 0.15s;
}

.filter-pill:hover {
  background: #ffffff;
  color: var(--text-main);
}

.filter-pill.active {
  background: #ffffff;
  color: #0b8f69;
  font-weight: 700;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.feed-stream-container {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 10px;
}

.feed-stream-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.feed-bubble {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  background: #f8fafc;
  border: 1px solid #f1f5f9;
  transition: all 0.15s;
}

.feed-bubble:hover {
  background: #ffffff;
  border-color: #e2e8f0;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
}

.feed-bubble.kind-gift {
  background: #fefce8;
  border-color: #fef08a;
}
.feed-bubble.kind-like {
  background: #fdf2f8;
  border-color: #fbcfe8;
}

.bubble-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.bubble-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.sender-name {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-main);
}

.kind-tag {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 4px;
}
.kind-tag.gift {
  background: #fde68a;
  color: #92400e;
}
.kind-tag.like {
  background: #fbcfe8;
  color: #9d174d;
}
.kind-tag.comment,
.kind-tag.chat {
  background: #e2e8f0;
  color: #475569;
}

.bubble-time {
  margin-left: auto;
  font-size: 10px;
  color: var(--text-faint);
  font-family: ui-monospace, monospace;
}

.bubble-text {
  font-size: 12px;
  color: #334155;
  display: flex;
  align-items: center;
  gap: 4px;
  word-break: break-all;
}

.gift-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
}

.feed-empty-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 40px 10px;
  color: var(--text-muted);
  text-align: center;
  gap: 6px;
}

.empty-icon {
  color: #cbd5e1;
}

.feed-empty-hint p {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main);
}

.feed-empty-hint small {
  font-size: 11px;
}

/* 模拟设置弹窗表单样式 */
.modal-game-selection {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.modal-section-title {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
}

.game-select-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 8px;
  background: #f0fdf4;
  border: 1px solid #86efac;
  cursor: pointer;
}

.game-select-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.game-select-info strong {
  font-size: 13px;
  color: #166534;
}

.game-select-info small {
  font-size: 11px;
  color: #15803d;
}

.game-ready-badge {
  margin-left: auto;
  font-size: 11px;
  font-weight: 700;
  color: #16a34a;
}

.modal-form-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 14px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-field label {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
}

.form-field input {
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  font-size: 13px;
  outline: none;
}
.form-field select {
  min-height: 34px;
  padding: 0 10px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  font-size: 13px;
}
.form-field input:focus {
  border-color: #0b8f69;
  background: #ffffff;
}

.mode-hint {
  margin: -4px 0 8px;
  color: #64748b;
  font-size: 12px;
}

.simulation-transport {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 10px 14px;
  border: 1px solid #cbd5e1;
  border-radius: var(--radius-md);
  background: #0f172a;
  color: #e2e8f0;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.14);
  flex-shrink: 0;
}

.transport-status,
.transport-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.transport-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #94a3b8;
}
.transport-dot.running { background: #34d399; box-shadow: 0 0 8px rgba(52, 211, 153, 0.75); }
.transport-dot.paused { background: #fbbf24; }
.transport-dot.ready { background: #60a5fa; }

.transport-muted,
.transport-progress {
  color: #94a3b8;
  font-size: 11px;
}
.transport-progress {
  padding-left: 8px;
  border-left: 1px solid rgba(148, 163, 184, 0.3);
  font-family: ui-monospace, monospace;
}

.transport-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  padding: 0 10px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
  color: #e2e8f0;
  font-size: 11px;
  font-weight: 700;
}
.transport-btn:hover:not(:disabled) { background: rgba(255, 255, 255, 0.14); }
.transport-btn.primary { background: #0b8f69; border-color: #0b8f69; color: #fff; }
.transport-btn.danger { background: rgba(239, 68, 68, 0.15); border-color: rgba(248, 113, 113, 0.45); color: #fecaca; }
.transport-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.timeline-box {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #e2e8f0;
}
.timeline-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  color: #334155;
  font-size: 11px;
  font-weight: 700;
}
.timeline-heading small { color: #94a3b8; font-weight: 500; }
.timeline-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: hidden;
}
.timeline-item {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) auto;
  gap: 6px;
  align-items: center;
  padding: 5px 6px;
  border-radius: 5px;
  color: #64748b;
  font-size: 11px;
}
.timeline-item.current { background: #eff6ff; color: #1d4ed8; }
.timeline-item.executed { color: #087a5a; }
.timeline-index {
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #e2e8f0;
  font-size: 9px;
}
.timeline-item.executed .timeline-index { background: #c8ebdc; }
.timeline-item small { color: #94a3b8; font-family: ui-monospace, monospace; }
.timeline-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.manual-event-panel {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #e2e8f0;
}
.manual-panel-title,
.history-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #334155;
  font-size: 11px;
  font-weight: 700;
}
.manual-panel-title small,
.history-heading small { color: #94a3b8; font-weight: 500; }
.manual-type-switch {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  margin-top: 7px;
}
.manual-type-switch button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 27px;
  border: 1px solid #cbd5e1;
  border-radius: 5px;
  background: #fff;
  color: #64748b;
  font-size: 11px;
  font-weight: 600;
}
.manual-type-switch button.active {
  color: #047857;
  border-color: #6ee7b7;
  background: #e7f5ef;
}
.manual-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5px;
  margin-top: 6px;
}
.manual-form-grid input {
  min-width: 0;
  height: 28px;
  padding: 0 7px;
  border: 1px solid #cbd5e1;
  border-radius: 5px;
  background: #fff;
  color: #334155;
  font-size: 11px;
}
.manual-actions-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5px;
  margin-top: 6px;
}
.manual-send-btn {
  height: 28px;
  border: 1px solid #087a5a;
  border-radius: 5px;
  background: #0b8f69;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
}
.manual-send-btn.secondary {
  border-color: #cbd5e1;
  background: #f8fafc;
  color: #475569;
}
.queue-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-top: 9px;
  padding-top: 8px;
  border-top: 1px dashed #cbd5e1;
}
.queue-item {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr);
  gap: 5px;
  align-items: center;
  padding: 5px 6px;
  border-radius: 5px;
  background: #fff7ed;
  color: #9a3412;
  font-size: 10px;
}
.queue-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5px;
  margin-top: 3px;
}
.queue-actions button {
  height: 25px;
  border: 1px solid #fed7aa;
  border-radius: 5px;
  background: #fff;
  color: #9a3412;
  font-size: 10px;
  font-weight: 700;
}
.history-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-top: 10px;
}
.history-item {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) auto;
  gap: 5px;
  align-items: center;
  padding: 5px 6px;
  border-radius: 5px;
  background: #f8fafc;
  font-size: 10px;
}
.history-kind {
  color: #64748b;
  font-weight: 700;
}
.history-text {
  overflow: hidden;
  color: #334155;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.history-status {
  color: #64748b;
  font-weight: 700;
}
.history-status.claimed { color: #087a5a; }
.history-status.ignored { color: #94a3b8; }

@media (max-width: 900px) {
  .simulation-transport { align-items: flex-start; flex-direction: column; }
  .transport-actions { flex-wrap: wrap; }
  .modal-form-grid { grid-template-columns: repeat(2, 1fr); }
}

.modal-error-msg {
  color: #ef4444;
  font-size: 12px;
  margin: 6px 0 0;
}

.modal-confirm-btn {
  padding: 8px 20px;
  border-radius: 8px;
  background: #0b8f69;
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
}
.modal-confirm-btn:hover:not(:disabled) {
  background: #087a5a;
}

@media (max-width: 1100px) {
  .studio-workbench-layout {
    grid-template-columns: minmax(180px, 0.78fr) minmax(220px, 0.9fr) minmax(220px, 1fr);
  }
}

@media (max-width: 900px) {
  .studio-header {
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 8px 12px;
  }

  .studio-center-stats {
    order: 3;
    flex-basis: 100%;
    justify-content: flex-start;
  }

  .studio-workbench-layout {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    align-items: start;
  }

  .studio-center-stage {
    grid-column: 1 / -1;
    grid-row: 1;
  }

  .studio-left-dock {
    grid-column: 1;
    grid-row: 2;
  }

  .studio-right-dock {
    grid-column: 2;
    grid-row: 2;
  }
}

@media (max-width: 640px) {
  .studio-console-page {
    padding: 8px;
  }

  .studio-header {
    padding: 10px 12px;
  }

  .studio-meta,
  .studio-actions {
    width: 100%;
  }

  .studio-actions {
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .studio-workbench-layout {
    grid-template-columns: minmax(0, 1fr);
    min-height: 0;
  }

  .studio-center-stage,
  .studio-left-dock,
  .studio-right-dock {
    grid-column: 1;
    grid-row: auto;
  }

  .studio-center-stage {
    order: 1;
  }

  .studio-left-dock {
    order: 2;
  }

  .studio-right-dock {
    order: 3;
  }
}

/* Desktop workbench refinement */
.studio-console-page {
  height: 100%;
  min-height: 0;
  padding: 10px 12px;
  gap: 8px;
  background: #eef2f7;
  overflow: hidden;
}

.studio-header {
  min-height: 44px;
  padding: 6px 12px;
  border-radius: 8px;
  box-shadow: none;
}

.studio-meta {
  gap: 10px;
}

.live-dot-indicator,
.room-anchor-tag,
.resolution-pill,
.timer-pill,
.action-btn-primary,
.action-btn-secondary,
.action-btn-danger {
  border-radius: 6px;
}

.action-btn-primary {
  background: #0b8f69;
  box-shadow: none;
}

.action-btn-primary:hover {
  background: #087a5a;
}

.studio-workbench-layout {
  gap: 8px;
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 0.9fr) minmax(0, 1.3fr);
  align-items: stretch;
  grid-template-rows: minmax(0, 1fr);
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
}

.studio-left-dock,
.studio-right-dock,
.studio-control-stage {
  border-radius: 8px;
  box-shadow: none;
}

.studio-left-dock,
.studio-right-dock {
  background: #ffffff;
  border: 1px solid #dbe3ee;
  min-height: 0;
  overflow: hidden;
}

.studio-left-dock {
  grid-column: 1;
  grid-row: 1;
  overflow-y: auto;
  gap: 0;
  height: 100%;
}

.studio-control-stage {
  grid-column: 2;
  grid-row: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
}

.studio-right-dock {
  grid-column: 3;
  grid-row: 1;
}

.control-hero-panel,
.control-action-panel,
.control-info-card {
  background: #ffffff;
  border: 1px solid #dbe3ee;
  border-radius: 8px;
}

.control-hero-panel {
  min-height: 168px;
  padding: 24px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  background:
    linear-gradient(135deg, rgba(11, 143, 105, 0.08), transparent 52%),
    #ffffff;
}

.section-kicker {
  display: block;
  color: #0b8f69;
  font: 700 10px/1.2 ui-monospace, SFMono-Regular, Consolas, monospace;
  letter-spacing: 0.08em;
}

.control-hero-copy h2 {
  margin: 10px 0 8px;
  color: #0f172a;
  font-size: 28px;
  line-height: 1.15;
}

.control-hero-copy p {
  max-width: 430px;
  margin: 0;
  color: #64748b;
  font-size: 13px;
  line-height: 1.6;
}

.control-hero-status {
  display: flex;
  min-width: 112px;
  padding: 10px 12px;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  color: #64748b;
  background: #f8fafc;
}

.control-hero-status.active {
  border-color: #b8e3d0;
  background: #e7f5ef;
  color: #087a5a;
}

.control-hero-status small {
  color: #94a3b8;
  font-size: 11px;
}

.control-action-panel {
  padding: 12px;
}

.panel-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

.panel-heading h3 {
  margin: 0;
  color: #1e293b;
  font-size: 13px;
}

.panel-heading.compact {
  align-items: center;
}

.panel-heading.compact h3 {
  margin: 0;
  font-size: 14px;
}

.panel-hint,
.control-note {
  color: #94a3b8;
  font-size: 11px;
}

.control-action-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
  margin-top: 14px;
}

.control-action {
  display: flex;
  min-height: 70px;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid #dbe3ee;
  border-radius: 8px;
  background: #ffffff;
  color: #475569;
  text-align: left;
  transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease;
}

.control-action:hover:not(:disabled) {
  border-color: #9ccfba;
  background: #f7fcfa;
  transform: translateY(-1px);
}

.control-action.primary {
  border-color: #0b8f69;
  background: #0b8f69;
  color: #ffffff;
}

.control-action.primary:hover:not(:disabled) {
  border-color: #087a5a;
  background: #087a5a;
}

.control-action.danger {
  border-color: #fecaca;
  background: #fff7f7;
  color: #b91c1c;
}

.control-action span {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.control-action strong {
  font-size: 12px;
}

.control-action small {
  color: #94a3b8;
  font-size: 10px;
  line-height: 1.4;
}

.control-action.primary small {
  color: rgba(255, 255, 255, 0.76);
}

.control-info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.control-info-card {
  padding: 16px;
}

.status-label {
  padding: 4px 7px;
  border-radius: 5px;
  color: #64748b;
  background: #f1f5f9;
  font-size: 10px;
  font-weight: 700;
}

.status-label.good {
  color: #087a5a;
  background: #e7f5ef;
}

.output-spec-row {
  display: flex;
  justify-content: space-between;
  padding: 11px 0;
  border-bottom: 1px solid #eef2f7;
  color: #64748b;
  font-size: 12px;
}

.output-spec-row strong {
  color: #1e293b;
  font-family: ui-monospace, monospace;
  font-size: 11px;
}

.control-note {
  margin: 12px 0 0;
  line-height: 1.55;
}

.connection-summary {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 18px 0 12px;
}

.connection-summary strong {
  color: #1e293b;
  font-size: 15px;
}

.connection-summary span {
  color: #64748b;
  font-size: 11px;
  line-height: 1.5;
}

.text-action {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0;
  color: #0b8f69;
  font-size: 11px;
  font-weight: 700;
}

@media (max-width: 560px) {
  .studio-workbench-layout {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto;
    flex: 0 0 auto;
    overflow: visible;
  }

  .studio-left-dock,
  .studio-control-stage,
  .studio-right-dock {
    grid-column: 1;
    grid-row: auto;
  }

  .studio-control-stage {
    min-height: 0;
    overflow: visible;
  }

  .studio-console-page,
  :global(.desktop-content-viewport.console-page) {
    height: auto;
    overflow: visible;
  }

  .studio-right-dock {
    min-height: 360px;
  }
}

@media (max-width: 560px) {
  .control-hero-panel,
  .panel-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .control-action-grid,
  .control-info-grid {
    grid-template-columns: 1fr;
  }
}

.monitor-card {
  background: #d9e2ee;
  border: 1px solid #cbd5e1;
  padding: 8px;
}

.dock-section,
.feed-dock-header,
.feed-filter-bar {
  background: #ffffff;
}

.dock-section {
  padding: 12px;
}

.dock-title {
  font-size: 12px;
}

.mini-metric {
  padding: 9px 8px;
  border-radius: 6px;
}

.stream-status-box {
  border-radius: 6px;
}

.monitor-live-viewport {
  background: #cbd5e1;
  border-radius: 6px;
}

.standby-center-visual h3 {
  font-size: 48px;
}

.standby-btn {
  border-radius: 8px;
}

.standby-btn.primary {
  background: #0b8f69;
  box-shadow: none;
}

.standby-btn.primary:hover {
  filter: none;
  background: #087a5a;
}

.audience-badge,
.host-pill {
  border-radius: 8px;
}

.douyin-live-standby-view {
  background:
    radial-gradient(circle at 50% 22%, rgba(148, 163, 184, 0.22) 0%, transparent 40%),
    linear-gradient(180deg, #e8eef5 0%, #dbe4ee 100%);
  color: #0f172a;
}

.host-pill,
.audience-badge,
.fake-chat-input,
.fake-icon {
  background: rgba(255, 255, 255, 0.84);
  border-color: rgba(148, 163, 184, 0.45);
  color: #334155;
}

.host-text strong,
.standby-center-visual h3 {
  color: #0f172a;
}

.host-text small,
.standby-desc {
  color: #64748b;
}

.host-avatar {
  background: #0b8f69;
}

.camera-standby-ring {
  background: rgba(11, 143, 105, 0.08);
  border-color: #0b8f69;
  box-shadow: 0 0 44px rgba(11, 143, 105, 0.14);
}

.standby-icon,
.standby-signal-pill {
  color: #0b8f69;
}

.standby-signal-pill {
  background: #e7f5ef;
  border-color: #b8e3d0;
}

.standby-btn.secondary {
  background: rgba(255, 255, 255, 0.74);
  border-color: #cbd5e1;
  color: #334155;
}

.standby-bottom-bar {
  color: #64748b;
}

.fake-icon {
  display: grid;
  place-items: center;
}

.feed-bubble,
.filter-pill {
  border-radius: 6px;
}

.studio-left-dock .dock-section {
  border: 0;
  border-bottom: 1px solid #e5e7eb;
  border-radius: 0;
  box-shadow: none;
  padding: 12px;
}

.studio-left-dock .stream-info-section {
  flex: 0 0 auto;
}

.studio-left-dock .dock-quick-actions {
  display: flex;
  margin-top: 0;
}

.studio-left-dock .stream-status-box {
  background: transparent;
  padding: 0;
  border: 0;
}

.game-control-list {
  margin-top: 12px;
}

.studio-control-stage {
  background: #ffffff;
  border: 1px solid #dbe3ee;
  gap: 0;
}

.studio-control-stage .control-action-panel {
  border: 0;
  border-radius: 0;
  padding: 16px;
}

.console-tools-section,
.console-session-section {
  padding: 16px;
  border-top: 1px solid #e5e7eb;
}

.console-tools-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
}

.console-tools-grid button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 40px;
  padding: 8px;
  border: 1px solid #dbe3ee;
  border-radius: 6px;
  background: #f8faf9;
  color: #334155;
  font-size: 12px;
  transition: background 0.15s, border-color 0.15s;
}

.console-tools-grid button:hover:not(:disabled) {
  background: #e7f5ef;
  border-color: #9ccfba;
}

.console-tools-grid button:disabled {
  opacity: 0.5;
}

.console-session-details {
  margin: 12px 0;
}

.console-session-details div {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 6px;
  padding: 8px 0;
  font-size: 12px;
  line-height: 1.4;
}

.console-session-details dt {
  color: #64748b;
}

.console-session-details dd {
  margin: 0;
  color: #334155;
  font-weight: 600;
}

.console-output-summary {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding-top: 12px;
  border-top: 1px solid #edf0ee;
  color: #64748b;
  font-size: 11px;
}

.console-output-summary strong {
  margin-left: auto;
  font-size: 11px;
  font-weight: 500;
}

.game-control-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 68px;
  border-top: 1px solid #edf0ee;
}

.game-control-name {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.game-control-name strong {
  color: #1f2937;
  font-size: 13px;
}

.game-control-name small {
  color: #64748b;
  font-size: 12px;
}

.game-control-footer {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid #edf0ee;
}

.current-game-line {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 0;
  font-size: 12px;
  line-height: 1.5;
  color: #475569;
  overflow-wrap: anywhere;
}

@media (min-width: 561px) {
  .studio-workbench-layout {
    grid-template-columns: minmax(0, 0.8fr) minmax(0, 0.9fr) minmax(0, 1.3fr);
    grid-template-rows: minmax(0, 1fr);
  }

  .studio-left-dock { grid-column: 1; grid-row: 1; }
  .studio-control-stage { grid-column: 2; grid-row: 1; }
  .studio-right-dock { grid-column: 3; grid-row: 1; }

  .studio-header {
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
  }

  .studio-center-stats {
    flex: 1;
    order: initial;
    justify-content: flex-end;
  }
}

@media (prefers-reduced-motion: reduce) {
  .camera-standby-ring,
  .rec-dot.active {
    animation: none;
  }
}
</style>
