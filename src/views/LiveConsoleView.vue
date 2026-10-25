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
        <span class="resolution-pill">9:16 竖屏 · 1080 × 1920 · 60 FPS</span>
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
          title="在新窗口独立打开 9:16 直播画面"
          @click="openExternalObs"
        >
          <ExternalLink :size="14" />
          <span>独立窗口</span>
        </button>
      </div>
    </header>

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
            <span class="dock-title">伴侣推流状态</span>
          </div>
          <div class="stream-status-box">
            <div class="status-indicator-row">
              <span class="status-ping-dot" :class="{ live: liveState.connection === 'live' || simulationState.active }"></span>
              <strong>{{ liveState.connection === 'live' ? '直播推流中 (Online)' : simulationState.active ? '模拟演练推流中' : '伴侣待机中 (Ready)' }}</strong>
            </div>
            <div class="stream-meta-line">
              <span>房间 ID：</span>
              <b>{{ liveState.roomId || '未配置' }}</b>
            </div>
            <div class="stream-meta-line">
              <span>渲染画质：</span>
              <b>1080 × 1920 (9:16)</b>
            </div>
            <div class="stream-meta-line">
              <span>语音引擎：</span>
              <b>本地 TTS 正常</b>
            </div>
            <div class="stream-meta-line">
              <span>互动模块：</span>
              <b :style="{ color: activeGameModule ? '#10b981' : '#64748b' }">
                {{ activeGameModule ? `运行中 · ${activeGameModule.name}` : '未启动 (待机)' }}
              </b>
            </div>
          </div>

          <div class="dock-quick-actions">
            <button
              v-if="activeGameModule"
              class="dock-action-btn danger"
              type="button"
              @click="stopAllRunningGames"
            >
              <span>结束当前游戏</span>
            </button>
            <button
              v-else
              class="dock-action-btn primary"
              type="button"
              @click="emit('navigate', 'games')"
            >
              <Gamepad2 :size="14" />
              <span>进入游戏大厅</span>
            </button>
            <button
              class="dock-action-btn secondary"
              type="button"
              @click="emit('navigate', 'connect')"
            >
              <Radio :size="14" />
              <span>直播连接设置</span>
            </button>
          </div>
        </div>
      </aside>

      <!-- ================= 2. 中间舞台：核心 9:16 直播竖屏主监视器 (CENTER STAGE) ================= -->
      <main class="studio-center-stage">
        <div class="monitor-card">
          <!-- 核心直播预览视口：统一采用 1080×1920 标准画布等比缩放，保证任何窗口尺寸下排版 100% 稳定不折行 -->
          <div ref="previewFrame" class="monitor-live-viewport">
            <div class="broadcast-viewport-fill">
              <div class="monitor-canvas-scaled" :style="canvasCoverStyle">
                <!-- 仅当某个独立游戏模块真正启动运行时，才挂载渲染该游戏的 9:16 直播画面 -->
                <component :is="activeGameModule.component" v-if="activeGameModule" />

                <!-- 未启动任何游戏时：展示标准 1080×1920 抖音直播间待机画面 -->
                <div v-else class="douyin-live-standby-view">
                  <div class="standby-top-bar">
                    <div class="host-pill">
                      <span class="host-avatar">{{ (liveState.liveInfo?.nickname || '播')[0] }}</span>
                      <div class="host-text">
                        <strong>{{ liveState.liveInfo?.nickname || '直播主控台' }}</strong>
                        <small>{{ format(liveState.likes) }} 本场点赞</small>
                      </div>
                    </div>
                    <div class="audience-badge">
                      <span>👁 {{ format(liveState.audience) }} 在线</span>
                    </div>
                  </div>

                  <div class="standby-center-visual">
                    <div class="camera-standby-ring">
                      <Gamepad2 :size="76" class="standby-icon" />
                    </div>
                    <span class="standby-signal-pill">9:16 竖屏信号待机 · 1080 × 1920</span>
                    <h3>暂未启动互动游戏</h3>
                    <p class="standby-desc">
                      每个互动游戏均为独立模块。<br />
                      请前往「游戏大厅」启动指定游戏，或开启模拟直播演示。
                    </p>
                    <div class="standby-quick-buttons">
                      <button
                        class="standby-btn primary"
                        type="button"
                        @click="emit('navigate', 'games')"
                      >
                        <Gamepad2 :size="32" />
                        <span>前往游戏大厅启动</span>
                      </button>
                      <button
                        v-if="canStartSimulation"
                        class="standby-btn secondary"
                        type="button"
                        @click="openSimulationSetup"
                      >
                        <Sparkles :size="32" />
                        <span>开启模拟直播演示</span>
                      </button>
                    </div>
                  </div>

                  <div class="standby-bottom-bar">
                    <div class="fake-chat-input">说点什么...</div>
                    <div class="fake-action-icons">
                      <span class="fake-icon">🎁</span>
                      <span class="fake-icon">❤️</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
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
              v-for="item in filteredFeed" 
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
import { computed, onMounted, onBeforeUnmount, reactive, ref } from 'vue';
import { 
  Radio, MessageSquare, Sparkles, ExternalLink, ShieldCheck, Gamepad2 
} from '@lucide/vue';
import { liveState, simulationState, startLiveSimulation, stopLiveSimulation } from '@/stores/liveStore';
import { canStartLiveSimulation, defaultLiveSimulationConfig, normalizeSimulationConfig, type SimulationGameId } from '@/services/liveSimulation';
import { activeGameModule, getGameModule, registeredGames, stopAllRunningGames } from '@/game/gameRegistry';
import { loadConfig, saveConfig } from '@/services/configApi';
import AppModal from '@/components/AppModal.vue';
import UserAvatar from '@/components/UserAvatar.vue';

const emit = defineEmits<{
  navigate: [page: string];
}>();

const previewFrame = ref<HTMLElement>();
const viewportWidth = ref(0);
const viewportHeight = ref(0);
let observer: ResizeObserver | undefined;

const canvasCoverStyle = computed(() => {
  if (!viewportWidth.value || !viewportHeight.value) return {};
  const scale = Math.min(viewportWidth.value / 1080, viewportHeight.value / 1920);
  return {
    transform: `translate(-50%, -50%) scale(${scale})`
  };
});

const outputUrl = computed(() => `${location.origin}${location.pathname}?page=obs&output=1`);

const showSimulationConfig = ref(false);
const startingSimulation = ref(false);
const simulationConfigLoaded = ref(false);
const selectedSimulationGame = ref<SimulationGameId>('quiz');
const configError = ref('');
const canStartSimulation = computed(() => canStartLiveSimulation(liveState.connection, simulationState.active));
const simulationDraft = reactive({ ...defaultLiveSimulationConfig });

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

onMounted(async () => {
  if (previewFrame.value) {
    observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      viewportWidth.value = width;
      viewportHeight.value = height;
    });
    observer.observe(previewFrame.value);
  }

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

onBeforeUnmount(() => {
  observer?.disconnect();
});

function openSimulationSetup() {
  selectedSimulationGame.value = (registeredGames[0]?.id as SimulationGameId) || 'quiz';
  configError.value = '';
  showSimulationConfig.value = true;
}

async function startDemo() {
  if (!selectedSimulationGame.value || !canStartSimulation.value || startingSimulation.value) return;
  startingSimulation.value = true;
  configError.value = '';
  try {
    const config = normalizeSimulationConfig(simulationDraft);
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

function openExternalObs() {
  window.open(outputUrl.value, 'douai-obs-studio', 'width=460,height=820,menubar=no,toolbar=no');
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
  height: 100%;
  padding: 14px 18px 20px;
  gap: 12px;
  background: var(--bg-app);
  box-sizing: border-box;
}

/* 演播室顶栏 */
.studio-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: #ffffff;
  border-radius: var(--radius-md);
  border: 1px solid var(--line);
  box-shadow: var(--card-shadow);
  flex-shrink: 0;
}

.studio-meta {
  display: flex;
  align-items: center;
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
  background: #ecfdf5;
  border-color: #a7f3d0;
  color: #065f46;
}
.live-dot-indicator.live .pulsing-core {
  background: #10b981;
  box-shadow: 0 0 8px rgba(16, 185, 129, 0.7);
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
  gap: 8px;
  font-size: 12px;
}
.room-anchor-tag strong {
  color: var(--text-main);
}
.room-anchor-tag span {
  color: var(--text-muted);
}

.studio-center-stats {
  display: flex;
  align-items: center;
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
  gap: 8px;
}

.action-btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 8px;
  background: #10b981;
  color: #ffffff;
  font-size: 12px;
  font-weight: 600;
  transition: all 0.15s;
}
.action-btn-primary:hover:not(:disabled) {
  background: #059669;
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
  grid-template-columns: minmax(230px, 0.92fr) auto minmax(260px, 1.2fr);
  gap: 14px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  align-items: stretch;
}

/* ================= 1. 左侧面板 ================= */
.studio-left-dock {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  height: 100%;
  overflow-y: auto;
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
  background: #ecfdf5;
  color: #059669;
  border: 1px solid #a7f3d0;
}
.dock-action-btn.primary:hover {
  background: #10b981;
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
  color: #10b981;
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
  background: #10b981;
  box-shadow: 0 0 6px rgba(16, 185, 129, 0.8);
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
  background: #ecfdf5;
  color: #065f46;
  border-color: #a7f3d0;
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
  justify-content: center;
  align-items: center;
  height: 100%;
  min-height: 0;
}

.monitor-card {
  background: #0f172a;
  border-radius: var(--radius-md);
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  height: 100%;
  aspect-ratio: 9/16;
  max-width: 100%;
  overflow: hidden;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.25);
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
  background: #10b981;
  color: #ffffff;
}

/* 监视器满高满宽直播视口 (把此窗口就当成实际直播窗口，铺满不缩小！) */
.monitor-live-viewport {
  flex: 1;
  min-height: 0;
  width: 100%;
  position: relative;
  overflow: hidden;
  background: #020617;
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
    radial-gradient(circle at 50% 28%, rgba(16, 185, 129, 0.16) 0%, transparent 52%),
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
  background: linear-gradient(135deg, #10b981, #06b6d4);
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
  background: rgba(16, 185, 129, 0.12);
  border: 4px dashed #10b981;
  display: grid;
  place-items: center;
  margin-bottom: 42px;
  box-shadow: 0 0 60px rgba(16, 185, 129, 0.22);
  animation: pulse-ring 3s infinite;
}

@keyframes pulse-ring {
  0%, 100% { transform: scale(1); opacity: 0.95; }
  50% { transform: scale(1.05); opacity: 0.7; }
}

.standby-icon {
  color: #10b981;
}

.standby-signal-pill {
  font-size: 24px;
  font-weight: 700;
  font-family: ui-monospace, monospace;
  padding: 10px 28px;
  border-radius: 999px;
  background: rgba(16, 185, 129, 0.14);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.35);
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
  background: linear-gradient(135deg, #10b981, #059669);
  color: #ffffff;
  border: none;
  box-shadow: 0 12px 32px rgba(16, 185, 129, 0.38);
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
  color: #10b981;
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
  overflow: hidden;
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
  background: #ecfdf5;
  color: #059669;
}

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
  color: #10b981;
  font-weight: 700;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.feed-stream-container {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
}

.feed-stream-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
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
  grid-template-columns: repeat(3, 1fr);
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
.form-field input:focus {
  border-color: #10b981;
  background: #ffffff;
}

.modal-error-msg {
  color: #ef4444;
  font-size: 12px;
  margin: 6px 0 0;
}

.modal-confirm-btn {
  padding: 8px 20px;
  border-radius: 8px;
  background: #10b981;
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
}
.modal-confirm-btn:hover:not(:disabled) {
  background: #059669;
}

@media (max-width: 1100px) {
  .studio-workbench-layout {
    grid-template-columns: minmax(210px, 0.9fr) auto minmax(240px, 1.15fr);
  }
}
</style>
