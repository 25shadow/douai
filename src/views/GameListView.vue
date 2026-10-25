<template>
  <div class="games-center-page">
    <header class="games-heading">
      <div class="heading-titles">
        <span class="sub-category">INTERACTIVE GAME CENTER</span>
        <h1>游戏中心</h1>
        <p>管理与运行直播间互动游戏，支持独立 9:16 竖屏渲染，OBS / 抖音伴侣窗口采集直接捕获。</p>
      </div>

      <div class="game-engine-status" :class="{ running: isAnyGameRunning }">
        <span class="status-core-dot"></span>
        <span>{{ isAnyGameRunning ? `正在运行：${activeGameModule?.name}` : '游戏实例：待机中' }}</span>
      </div>
    </header>

    <!-- 游戏列表卡片网格 -->
    <div class="games-cards-grid">
      <!-- 游戏卡片 1: 知识问答 (答题竞技场) -->
      <div class="game-master-card">
        <div class="card-top-bar">
          <div class="badge-group">
            <span class="game-tag-active">官方互动游戏</span>
            <span class="game-tag-tech">9:16 竖屏渲染</span>
            <span class="game-tag-tech">弹幕抢答 (A/B/C/D)</span>
          </div>
          <div class="status-indicator-pill" :class="{ active: quizState.running }">
            <span class="pulse-dot"></span>
            <span>{{ quizState.running ? '运行中 (Live)' : '待机中 (Idle)' }}</span>
          </div>
        </div>

        <div class="game-main-content">
          <div class="game-poster-box">
            <span class="poster-icon">Q</span>
            <div class="poster-overlay">
              <strong>知识问答</strong>
              <small>DOUAI · QUIZ</small>
            </div>
          </div>

          <div class="game-detail-info">
            <div class="game-title-row">
              <h2>知识问答 (答题竞技场)</h2>
            </div>
            <p class="game-desc">
              观众通过直播间弹幕发送 A、B、C、D 参与实时抢答，系统自动识别有效答案、实时累计个人积分并生成榜单。
              支持点赞助力免除淘汰、送礼直接通关及全自动语音播报，大幅提升直播间互动率与留存时长。
            </p>

            <div class="feature-pills-row">
              <span class="feat-pill">✨ 弹幕抢答 (A/B/C/D)</span>
              <span class="feat-pill">⚡ 积分排行榜与淘汰机制</span>
              <span class="feat-pill">💖 点赞助力与礼物免除</span>
              <span class="feat-pill">🤖 AI 智能生成题库</span>
              <span class="feat-pill">🎨 5 套专属直播主题</span>
            </div>
          </div>
        </div>

        <!-- 生命周期控制板 -->
        <div class="lifecycle-control-panel">
          <div v-if="quizState.running" class="running-status-strip">
            <div class="running-meta">
              <span class="round-badge">第 {{ quizProgress }} 题进行中</span>
              <strong class="current-q">{{ quizState.question?.title || quizState.status }}</strong>
              <span class="time-remain">倒计时：<b>{{ quizState.timeLeft }}</b> 秒</span>
            </div>

            <div class="running-actions">
              <button 
                v-if="quizState.phase === 'waiting'" 
                class="ctrl-btn next-btn" 
                type="button" 
                @click="nextQuestion"
              >
                <FastForward :size="14" />
                <span>下一题</span>
              </button>

              <button 
                class="ctrl-btn obs-btn" 
                type="button" 
                title="预览直播主题效果"
                @click="$emit('launch-obs', 'quiz')"
              >
                <Eye :size="14" />
                <span>主题预览</span>
              </button>

              <button 
                class="ctrl-btn stop-btn" 
                type="button" 
                @click="handleStopGame"
              >
                <Square :size="14" />
                <span>关闭 / 结束游戏</span>
              </button>
            </div>
          </div>

          <div v-else class="idle-status-strip">
            <div class="idle-text">
              <strong>知识问答待机中</strong>
              <small>可直接启动游戏进入开播，或进入配置修改题库、答题时长与画面主题</small>
            </div>

            <div class="idle-actions">
              <button 
                class="launch-action-btn" 
                type="button" 
                @click="handleStartGame"
              >
                <Play :size="15" fill="currentColor" />
                <span>启动游戏</span>
              </button>

              <button 
                class="config-action-btn" 
                type="button" 
                @click="$emit('open-quiz')"
              >
                <Sliders :size="15" />
                <span>游戏配置 (题库/规则/主题)</span>
              </button>

              <button 
                class="obs-action-btn" 
                type="button" 
                title="预览直播主题效果"
                @click="$emit('launch-obs', 'quiz')"
              >
                <Eye :size="15" />
                <span>主题预览</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 游戏卡片 2: 阵营对抗 (双阵营拔河与对决) -->
      <div class="game-master-card versus-card">
        <div class="card-top-bar">
          <div class="badge-group">
            <span class="game-tag-active versus-tag">官方独立玩法</span>
            <span class="game-tag-tech">9:16 竖屏渲染</span>
            <span class="game-tag-tech">双阵营对决</span>
          </div>
          <div class="status-indicator-pill" :class="{ active: versusState.running }">
            <span class="pulse-dot"></span>
            <span>{{ versusState.running ? '对决中 (Live)' : '待机中 (Idle)' }}</span>
          </div>
        </div>

        <div class="game-main-content">
          <div class="game-poster-box versus-poster">
            <span class="poster-icon">VS</span>
            <div class="poster-overlay">
              <strong>阵营对抗</strong>
              <small>DOUAI · VERSUS</small>
            </div>
          </div>

          <div class="game-detail-info">
            <div class="game-title-row">
              <h2>阵营对抗 (答题阵营对抗)</h2>
            </div>
            <p class="game-desc">
              双阵营答题对抗！观众发送 <b>{{ versusRuntimeSettings.redCommand }}</b> 加入 {{ versusRuntimeSettings.redTeamName }}，发送 <b>{{ versusRuntimeSettings.blueCommand }}</b> 加入 {{ versusRuntimeSettings.blueTeamName }}。
              观众发送 A/B/C/D 抢答题目，答对即刻为所在阵营拉扯拔河血条！点赞可排除错误项，送礼触发 {{ versusRuntimeSettings.giftMultiplier }} 倍暴击，率先达成 {{ versusRuntimeSettings.targetScore }} 分夺魁！
            </p>

            <div class="feature-pills-row">
              <span class="feat-pill">🔴 发送 {{ versusRuntimeSettings.redCommand }} 加入 {{ versusRuntimeSettings.redTeamName }}</span>
              <span class="feat-pill">🔵 发送 {{ versusRuntimeSettings.blueCommand }} 加入 {{ versusRuntimeSettings.blueTeamName }}</span>
              <span class="feat-pill">⚡ 弹幕抢答 A/B/C/D 拉扯血条</span>
              <span class="feat-pill">💖 点赞排除错误选项</span>
              <span class="feat-pill">🎁 礼物积分 {{ versusRuntimeSettings.giftMultiplier }} 倍暴击</span>
              <span class="feat-pill">🎨 4 套专属直播主题 (拔河/机甲/街机/角斗)</span>
            </div>
          </div>
        </div>

        <div class="lifecycle-control-panel">
          <div v-if="versusState.running" class="running-status-strip versus-running">
            <div class="running-meta">
              <span class="round-badge vs-badge">对抗激战中</span>
              <strong class="current-q">🔴 {{ versusRuntimeSettings.redTeamName }} {{ versusState.redScore }} 分 VS 🔵 {{ versusRuntimeSettings.blueTeamName }} {{ versusState.blueScore }} 分</strong>
              <span class="time-remain">目标：<b>{{ versusState.targetScore }}</b> 分</span>
            </div>

            <div class="running-actions">
              <button 
                class="ctrl-btn config-btn" 
                type="button" 
                title="调整游戏规则与阵营"
                @click="$emit('open-versus')"
              >
                <Sliders :size="14" />
                <span>配置</span>
              </button>

              <button 
                class="ctrl-btn obs-btn" 
                type="button" 
                title="预览对抗主题效果"
                @click="$emit('launch-obs', 'versus')"
              >
                <Eye :size="14" />
                <span>主题预览</span>
              </button>

              <button 
                class="ctrl-btn stop-btn" 
                type="button" 
                @click="handleStopVersus"
              >
                <Square :size="14" />
                <span>关闭 / 结束对抗</span>
              </button>
            </div>
          </div>

          <div v-else class="idle-status-strip">
            <div class="idle-text">
              <strong>阵营对抗待机中</strong>
              <small>支持自定义红蓝阵营名称、对决目标分、礼物暴击倍数及 4 款专属视觉主题</small>
            </div>

            <div class="idle-actions">
              <button 
                class="launch-action-btn vs-launch" 
                type="button" 
                @click="handleStartVersus"
              >
                <Play :size="15" fill="currentColor" />
                <span>启动阵营对抗</span>
              </button>

              <button 
                class="config-action-btn" 
                type="button" 
                @click="$emit('open-versus')"
              >
                <Sliders :size="15" />
                <span>游戏配置 (题库/阵营/规则/主题)</span>
              </button>

              <button 
                class="obs-action-btn" 
                type="button" 
                title="预览对抗主题效果"
                @click="$emit('launch-obs', 'versus')"
              >
                <Eye :size="15" />
                <span>主题预览</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { 
  Play, Square, FastForward, Sliders, Eye 
} from '@lucide/vue';
import { 
  quizState, quizProgress, startQuiz, stopQuiz, nextQuestion, setQuizPreviewConfig 
} from '@/game/quiz/quizStore';
import { versusState, versusRuntimeSettings, startVersus, stopVersus } from '@/game/versus/versusStore';
import { activeGameModule } from '@/game/gameRegistry';
import { loadConfig } from '@/services/configApi';

const emit = defineEmits<{
  'open-quiz': [];
  'open-versus': [];
  'launch-obs': [gameId?: 'quiz' | 'versus'];
}>();

const isAnyGameRunning = computed(() => quizState.running || versusState.running);

onMounted(async () => {
  try {
    const saved = await loadConfig();
    if (!quizState.running) {
      setQuizPreviewConfig(saved.quizConfig);
    }
  } catch {
    // Ignore load error and fallback to runtime settings
  }
});

async function handleStartGame() {
  if (versusState.running) stopVersus();
  if (!quizState.running) {
    try {
      const saved = await loadConfig();
      startQuiz(saved.quizConfig);
    } catch {
      startQuiz();
    }
  }
}

function handleStopGame() {
  stopQuiz();
}

function handleStartVersus() {
  if (quizState.running) stopQuiz();
  startVersus();
}

function handleStopVersus() {
  stopVersus();
}
</script>

<style scoped>
.games-center-page {
  padding: 20px 24px 36px;
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.games-heading {
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
  color: #10b981;
}

.heading-titles h1 {
  margin: 4px 0 2px;
  font-size: 24px;
  font-weight: 800;
  color: var(--text-main);
}

.heading-titles p {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
}

.game-engine-status {
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

.status-core-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #94a3b8;
}

.game-engine-status.running {
  background: #ecfdf5;
  border-color: #a7f3d0;
  color: #065f46;
}
.game-engine-status.running .status-core-dot {
  background: #10b981;
  box-shadow: 0 0 6px rgba(16, 185, 129, 0.6);
}

/* 主游戏卡片 */
.game-master-card {
  background: #ffffff;
  border-radius: var(--radius-md);
  border: 1px solid var(--line);
  box-shadow: var(--card-shadow);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.game-master-card:hover {
  box-shadow: var(--card-shadow-hover);
  border-color: rgba(16, 185, 129, 0.3);
}

.card-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 18px;
  background: #f8fafc;
  border-bottom: 1px solid #f1f5f9;
}

.badge-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.game-tag-active {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  background: #ecfdf5;
  color: #059669;
  border: 1px solid #a7f3d0;
}

.game-tag-tech {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background: #ffffff;
  color: #475569;
  border: 1px solid #e2e8f0;
  font-family: ui-monospace, monospace;
}

.status-indicator-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 20px;
  background: #f1f5f9;
  color: #64748b;
}

.pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #94a3b8;
}

.status-indicator-pill.active {
  background: #ecfdf5;
  color: #059669;
}
.status-indicator-pill.active .pulse-dot {
  background: #10b981;
  box-shadow: 0 0 6px rgba(16, 185, 129, 0.6);
}

.game-main-content {
  display: grid;
  grid-template-columns: 180px 1fr;
  gap: 24px;
  padding: 24px 20px;
  align-items: center;
}

.game-poster-box {
  width: 100%;
  aspect-ratio: 4/3;
  border-radius: 12px;
  background: linear-gradient(135deg, #10b981 0%, #064e3b 100%);
  display: grid;
  place-items: center;
  position: relative;
  overflow: hidden;
  box-shadow: 0 8px 20px rgba(16, 185, 129, 0.25);
}

.poster-icon {
  font-size: 64px;
  font-weight: 900;
  color: #ffffff;
  letter-spacing: -0.05em;
  text-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}

.poster-overlay {
  position: absolute;
  bottom: 0;
  inset-x: 0;
  padding: 8px 10px;
  background: linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.6) 100%);
  color: #ffffff;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.poster-overlay strong {
  font-size: 13px;
}

.poster-overlay small {
  font-size: 9px;
  font-family: ui-monospace, monospace;
  opacity: 0.8;
}

.game-detail-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.game-title-row h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
  color: var(--text-main);
}

.game-desc {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.6;
}

.feature-pills-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.feat-pill {
  font-size: 11px;
  padding: 4px 9px;
  border-radius: 6px;
  background: #f1f5f9;
  color: #334155;
  border: 1px solid #e2e8f0;
}

/* 底部生命周期控制条 */
.lifecycle-control-panel {
  padding: 16px 20px;
  background: #f8fafc;
  border-top: 1px solid #f1f5f9;
}

/* 运行中条目 */
.running-status-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.running-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.round-badge {
  font-size: 12px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 6px;
  background: #10b981;
  color: #ffffff;
}

.current-q {
  font-size: 13px;
  color: var(--text-main);
}

.time-remain {
  font-size: 12px;
  color: var(--text-muted);
}
.time-remain b {
  color: #ef4444;
  font-family: ui-monospace, monospace;
  font-size: 14px;
}

.running-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ctrl-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 14px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  transition: all 0.15s;
}

.next-btn {
  background: #10b981;
  color: #ffffff;
}
.next-btn:hover {
  background: #059669;
}

.obs-btn {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  color: #334155;
}
.obs-btn:hover {
  background: #f8fafc;
}

.stop-btn {
  background: #fee2e2;
  border: 1px solid #fca5a5;
  color: #b91c1c;
}
.stop-btn:hover {
  background: #fecaca;
}

/* 未运行待机条目 */
.idle-status-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.idle-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.idle-text strong {
  font-size: 13px;
  color: var(--text-main);
}

.idle-text small {
  font-size: 12px;
  color: var(--text-muted);
}

.idle-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.launch-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 20px;
  border-radius: 8px;
  background: #10b981;
  color: #ffffff;
  font-size: 13px;
  font-weight: 700;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.25);
  transition: all 0.15s;
}
.launch-action-btn:hover {
  background: #059669;
}

.config-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  color: #334155;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.15s;
}
.config-action-btn:hover {
  background: #f8fafc;
  border-color: #94a3b8;
}

.obs-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 8px 14px;
  border-radius: 8px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  color: #64748b;
  font-size: 12px;
  font-weight: 500;
}
.obs-action-btn:hover {
  background: #f8fafc;
  color: #1e293b;
}

/* 红蓝对抗专属卡片样式 */
.games-cards-grid {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.versus-tag {
  background: #fef2f2 !important;
  color: #e11d48 !important;
  border-color: #fecdd3 !important;
}
.versus-poster {
  background: linear-gradient(135deg, #e11d48 0%, #0284c7 100%) !important;
  box-shadow: 0 8px 20px rgba(225, 29, 72, 0.25) !important;
}
.versus-running {
  background: #fff1f2 !important;
  border-color: #fecdd3 !important;
}
.vs-badge {
  background: #e11d48 !important;
}
.vs-launch {
  background: linear-gradient(135deg, #e11d48 0%, #0284c7 100%) !important;
  box-shadow: 0 2px 8px rgba(225, 29, 72, 0.3) !important;
}
.vs-launch:hover {
  filter: brightness(1.1);
}

@media (max-width: 768px) {
  .game-main-content {
    grid-template-columns: 1fr;
  }
}
</style>
