<template>
  <div class="games-center-page">
    <header class="games-heading">
      <div class="heading-titles">
        <h1>游戏中心</h1>
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
            <span class="game-tag-active">知识问答</span>
            <span class="game-tag-tech">9:16 竖屏渲染</span>
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
            <p class="game-desc">观众发送 A、B、C、D 实时抢答，支持积分排行与直播互动。</p>

            <div class="feature-pills-row">
              <span class="feat-pill">弹幕抢答</span>
              <span class="feat-pill">积分排行</span>
              <span class="feat-pill">礼物互动</span>
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
                class="ctrl-btn preview-btn"
                type="button" 
                title="预览直播主题效果"
                @click="$emit('open-game-preview', 'quiz')"
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
                <span>结束</span>
              </button>
            </div>
          </div>

          <div v-else class="idle-status-strip">
            <div class="idle-text">
              <strong>知识问答待机中</strong>
                <small>选择题库与主题后开始互动</small>
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
                <span>配置</span>
              </button>

              <button 
                class="preview-action-btn"
                type="button" 
                title="预览直播主题效果"
                @click="$emit('open-game-preview', 'quiz')"
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
            <span class="game-tag-active versus-tag">阵营对抗</span>
            <span class="game-tag-tech">9:16 竖屏渲染</span>
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
            <p class="game-desc">观众加入红蓝阵营并参与答题，比分实时变化。</p>

            <div class="feature-pills-row">
              <span class="feat-pill">红蓝分组</span>
              <span class="feat-pill">答题对抗</span>
              <span class="feat-pill">比分拉扯</span>
            </div>
          </div>
        </div>

        <div class="lifecycle-control-panel">
          <div v-if="versusState.running" class="running-status-strip versus-running">
            <div class="running-meta">
              <span class="round-badge vs-badge">对抗激战中</span>
              <strong class="current-q">{{ versusRuntimeSettings.redTeamName }} {{ versusState.redScore }} 分 VS {{ versusRuntimeSettings.blueTeamName }} {{ versusState.blueScore }} 分</strong>
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
                class="ctrl-btn preview-btn"
                type="button" 
                title="预览对抗主题效果"
                @click="$emit('open-game-preview', 'versus')"
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
                <span>结束</span>
              </button>
            </div>
          </div>

          <div v-else class="idle-status-strip">
            <div class="idle-text">
              <strong>阵营对抗待机中</strong>
                <small>设置阵营与目标分后开始对决</small>
            </div>

            <div class="idle-actions">
              <button 
                class="launch-action-btn"
                type="button" 
                @click="handleStartVersus"
              >
                <Play :size="15" fill="currentColor" />
                <span>启动游戏</span>
              </button>

              <button 
                class="config-action-btn" 
                type="button" 
                @click="$emit('open-versus')"
              >
                <Sliders :size="15" />
                <span>配置</span>
              </button>

              <button 
                class="preview-action-btn"
                type="button" 
                title="预览对抗主题效果"
                @click="$emit('open-game-preview', 'versus')"
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
  'open-game-preview': [gameId?: 'quiz' | 'versus'];
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
  width: 100%;
  min-height: 100%;
  min-width: 0;
  padding: 18px clamp(12px, 2.2vw, 28px) 28px;
  max-width: 1280px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-sizing: border-box;
  overflow: visible;
}

.games-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding-bottom: 10px;
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

.heading-titles h1 {
  margin: 2px 0;
  font-size: 22px;
  font-weight: 800;
  color: var(--text-main);
}

.heading-titles p {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
  background: #e7f5ef;
  border-color: #b8e3d0;
  color: #065f46;
}
.game-engine-status.running .status-core-dot {
  background: #0b8f69;
  box-shadow: 0 0 6px rgba(11, 143, 105, 0.6);
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
  min-width: 0;
}

.game-master-card:hover {
  box-shadow: var(--card-shadow-hover);
  border-color: rgba(11, 143, 105, 0.3);
}

.card-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 12px;
  background: #f8fafc;
  border-bottom: 1px solid #f1f5f9;
}

.badge-group {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex-wrap: wrap;
}

.game-tag-active {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  background: #e7f5ef;
  color: #087a5a;
  border: 1px solid #b8e3d0;
}

.game-tag-tech {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background: #ffffff;
  color: #475569;
  border: 1px solid #e2e8f0;
  font-family: ui-monospace, monospace;
  white-space: nowrap;
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
  background: #e7f5ef;
  color: #087a5a;
}
.status-indicator-pill.active .pulse-dot {
  background: #0b8f69;
  box-shadow: 0 0 6px rgba(11, 143, 105, 0.6);
}

.game-main-content {
  display: grid;
  grid-template-columns: 128px minmax(0, 1fr);
  gap: 14px;
  padding: 14px 14px;
  align-items: center;
}

.game-poster-box {
  width: 100%;
  aspect-ratio: 4/3;
  border-radius: 12px;
  background: linear-gradient(135deg, #0b8f69 0%, #064e3b 100%);
  display: grid;
  place-items: center;
  position: relative;
  overflow: hidden;
  box-shadow: 0 8px 20px rgba(11, 143, 105, 0.25);
}

.poster-icon {
  font-size: 48px;
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
  gap: 5px;
  min-width: 0;
}

.game-title-row h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 800;
  color: var(--text-main);
}

.game-desc {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.45;
}

.feature-pills-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 3px;
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
  padding: 10px 14px;
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
  background: #0b8f69;
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
  background: #0b8f69;
  color: #ffffff;
}
.next-btn:hover {
  background: #087a5a;
}

.preview-btn {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  color: #334155;
}
.preview-btn:hover {
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
  gap: 8px;
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
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.idle-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.launch-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border-radius: 8px;
  background: #0b8f69;
  color: #ffffff;
  font-size: 13px;
  font-weight: 700;
  box-shadow: 0 2px 8px rgba(11, 143, 105, 0.25);
  transition: all 0.15s;
}
.launch-action-btn:hover {
  background: #087a5a;
}

.config-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
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

.preview-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 9px;
  border-radius: 8px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  color: #64748b;
  font-size: 12px;
  font-weight: 500;
}
.preview-action-btn:hover {
  background: #f8fafc;
  color: #1e293b;
}

/* 红蓝对抗专属卡片样式 */
.games-cards-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  min-height: 0;
  flex: 1;
  align-items: start;
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
@media (max-width: 768px) {
  .games-center-page {
    height: auto;
    min-height: 100%;
    overflow: visible;
  }
  .games-cards-grid {
    grid-template-columns: 1fr;
  }
  .game-main-content {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 1080px) {
  .games-cards-grid {
    grid-template-columns: 1fr;
  }

  .game-master-card {
    min-width: 0;
  }
}

@media (max-width: 560px) {
  .games-center-page {
    padding-inline: 12px;
  }

  .games-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 10px;
  }

  .heading-titles p {
    white-space: normal;
  }

  .card-top-bar,
  .idle-status-strip,
  .running-status-strip {
    align-items: flex-start;
    flex-direction: column;
  }

  .badge-group,
  .idle-actions,
  .running-actions {
    flex-wrap: wrap;
  }
}

/* Desktop workbench refinement */
.games-center-page {
  padding: 20px 24px 30px;
  max-width: 1440px;
  gap: 16px;
}

.games-heading {
  align-items: center;
  padding: 0 0 14px;
}

.sub-category {
  color: #0b8f69;
  letter-spacing: 0.08em;
}

.heading-titles h1 {
  font-size: 24px;
  letter-spacing: 0;
}

.heading-titles p {
  max-width: 680px;
  white-space: normal;
}

.game-engine-status {
  border-radius: 6px;
  padding: 7px 10px;
}

.games-cards-grid {
  gap: 14px;
}

.game-master-card {
  border-radius: 8px;
  box-shadow: none;
}

.game-master-card:hover {
  box-shadow: var(--card-shadow-hover);
}

.card-top-bar {
  padding: 9px 12px;
  background: #f8fafc;
}

.game-tag-active,
.game-tag-tech,
.status-indicator-pill,
.feat-pill {
  border-radius: 4px;
}

.game-main-content {
  grid-template-columns: 112px minmax(0, 1fr);
  gap: 16px;
  padding: 16px;
}

.game-poster-box {
  border-radius: 8px;
  box-shadow: none;
}

.poster-icon {
  font-size: 40px;
}

.game-title-row h2 {
  font-size: 15px;
}

.game-desc {
  line-height: 1.55;
}

.feat-pill {
  padding: 4px 7px;
  background: #f8fafc;
}

.game-poster-box {
  background: #e7f5ef;
  color: #087a5a;
}

.game-poster-box .poster-icon {
  color: #087a5a;
  text-shadow: none;
}

.game-poster-box .poster-overlay {
  background: linear-gradient(180deg, transparent 0%, rgba(255, 255, 255, 0.9) 100%);
  color: #111817;
}

.versus-poster {
  background: #f3f4f2 !important;
  color: #111817 !important;
  box-shadow: none !important;
}

.lifecycle-control-panel {
  padding: 11px 14px;
}

.ctrl-btn,
.launch-action-btn,
.config-action-btn,
.preview-action-btn {
  border-radius: 6px;
}

/* Game center: compact management cards, with the action row kept visible. */
.games-center-page {
  padding: 14px 20px 22px;
  gap: 10px;
  max-width: 1360px;
}

.games-heading {
  padding-bottom: 8px;
}

.sub-category,
.heading-titles p {
  display: none;
}

.heading-titles h1 {
  margin: 0;
  font-size: 20px;
}

.game-engine-status {
  padding: 5px 9px;
  font-size: 11px;
}

.games-cards-grid {
  gap: 12px;
  align-items: start;
  align-content: start;
  flex: 0 0 auto;
}

.game-master-card {
  min-height: 0;
  height: auto;
  align-self: start;
  justify-self: stretch;
}

.card-top-bar {
  min-height: 34px;
  padding: 7px 10px;
}

.game-tag-tech {
  display: none;
}

.game-main-content {
  grid-template-columns: 104px minmax(0, 1fr);
  gap: 12px;
  padding: 12px;
  align-items: center;
}

.game-poster-box {
  aspect-ratio: 1.3;
  border-radius: 7px;
}

.poster-icon {
  font-size: 36px;
}

.poster-overlay {
  padding: 6px 8px;
}

.poster-overlay strong {
  font-size: 11px;
}

.poster-overlay small {
  display: none;
}

.game-detail-info {
  gap: 6px;
}

.game-title-row h2 {
  font-size: 15px;
}

.game-desc {
  display: -webkit-box;
  overflow: hidden;
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.feature-pills-row {
  gap: 4px;
  margin-top: 1px;
}

.feat-pill {
  padding: 3px 6px;
  font-size: 10px;
}

.lifecycle-control-panel {
  min-height: 52px;
  padding: 8px 12px;
}

.idle-status-strip,
.running-status-strip {
  gap: 8px;
}

.idle-text {
  min-width: 0;
}

.idle-text strong {
  font-size: 12px;
}

.idle-text small {
  max-width: 260px;
  font-size: 11px;
}

.idle-actions,
.running-actions {
  gap: 5px;
}

.launch-action-btn,
.config-action-btn,
.preview-action-btn,
.ctrl-btn {
  padding: 6px 9px;
  font-size: 11px;
}

@media (max-width: 900px) {
  .games-cards-grid {
    grid-template-columns: 1fr;
    align-content: start;
  }
}

@media (max-width: 560px) {
  .game-main-content {
    grid-template-columns: 88px minmax(0, 1fr);
    padding: 10px;
  }

  .idle-status-strip,
  .running-status-strip {
    align-items: stretch;
    flex-direction: column;
  }

  .idle-actions,
  .running-actions {
    flex-wrap: wrap;
  }
}
</style>
