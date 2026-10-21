<template>
  <section class="console-page">
    <header class="console-heading">
      <div class="heading-copy">
        <span class="eyebrow">LIVE CONTROL ROOM</span>
        <h1>直播控制台</h1>
        <p>直播状态、房间数据、实时互动与 OBS 画面预览。</p>
      </div>
      <div class="heading-status">
        <div class="status-stack">
          <div class="live-status" :class="simulationState.active ? 'simulation' : liveState.connection"><span></span>{{ simulationState.active ? '模拟直播中' : liveState.connectionLabel }}</div>
          <small v-if="simulationState.active" class="simulation-clock">剩余 {{ remainingLabel }}</small>
        </div>
        <div class="room-identity">
          <strong>{{ liveState.liveInfo?.nickname || '等待主播信息' }}</strong>
          <span>房间号 {{ liveState.roomId || '—' }}</span>
        </div>
        <div class="simulation-actions">
          <template v-if="simulationState.active">
            <span class="simulation-indicator">DEMO</span>
            <button class="simulation-btn stop" type="button" @click="stopLiveSimulation">结束模拟</button>
          </template>
          <template v-else>
            <button class="simulation-btn start" type="button" :aria-expanded="showSimulationConfig" :disabled="!canStartSimulation || startingSimulation || !simulationConfigLoaded" :title="canStartSimulation ? '选择游戏并开始本地模拟' : '请先断开真实直播间'" @click="openSimulationSetup">模拟直播</button>
          </template>
        </div>
      </div>
    </header>

    <AppModal :open="showSimulationConfig && !simulationState.active" title="模拟直播设置" description="仅本地演示，不会连接或转发真实直播。" eyebrow="DEMO SETUP" @close="showSimulationConfig = false">
      <fieldset class="game-picker">
        <legend>选择游戏</legend>
        <label class="game-option" :class="{ selected: selectedSimulationGame === 'quiz' }">
          <input v-model="selectedSimulationGame" type="radio" name="simulation-game" value="quiz" />
          <span><strong>知识问答</strong><small>模拟评论答题、点赞助力与礼物效果</small></span>
          <span class="game-status">已实现</span>
        </label>
      </fieldset>
      <div class="simulation-fields">
        <label>模拟时长（分钟）<input v-model.number="simulationDraft.durationMinutes" type="number" min="1" max="180" step="1" /></label>
        <label>起始在线观众<input v-model.number="simulationDraft.audience" type="number" min="1" max="99999" step="10" /></label>
        <label>互动间隔（秒）<input v-model.number="simulationDraft.eventIntervalSeconds" type="number" min="1" max="60" step="1" /></label>
      </div>
      <p v-if="configError" class="config-error" role="alert">{{ configError }}</p>
      <template #footer><small>开始后才会进入模拟直播并运行所选游戏。</small><button class="simulation-btn start" type="button" :disabled="!selectedSimulationGame || !canStartSimulation || startingSimulation" @click="startDemo">{{ startingSimulation ? '准备中…' : '开始模拟' }}</button></template>
    </AppModal>

    <section v-if="quizState.running" class="game-control" aria-label="知识问答游戏控制">
      <div class="game-summary">
        <span class="panel-kicker">KNOWLEDGE QUIZ</span>
        <strong>{{ quizState.status }}</strong>
        <small>{{ quizProgress }} · 剩余 {{ quizState.timeLeft }} 秒</small>
      </div>
      <div class="game-actions">
        <button v-if="quizState.phase === 'waiting'" class="control-btn primary" @click="nextQuestion">下一题</button>
        <button class="control-btn" @click="stopQuiz">结束游戏</button>
      </div>
    </section>

    <div class="metric-grid" aria-label="直播数据">
      <article><span>在线观众</span><strong>{{ format(liveState.audience) }}</strong><small>当前房间</small></article>
      <article><span>累计点赞</span><strong>{{ format(liveState.likes) }}</strong><small>本场互动</small></article>
      <article><span>粉丝数</span><strong>{{ format(liveState.followers) }}</strong><small>主播信息</small></article>
      <article><span>累计观看</span><strong>{{ format(liveState.totalUsers) }}</strong><small>本场数据</small></article>
    </div>

    <div class="console-workspace">
      <section class="feed-panel">
        <header class="panel-header">
          <div><span class="panel-kicker">LIVE INTERACTIONS</span><h2>实时互动</h2></div>
          <span class="feed-count">{{ liveState.activityFeed.length }} 条</span>
        </header>
        <div class="room-strip">
          <div class="room-cover" :style="{ backgroundImage: liveState.liveInfo?.cover ? `url(${liveState.liveInfo.cover})` : undefined }"></div>
          <div class="room-copy">
            <strong>{{ liveState.liveInfo?.title || '直播间信息将在连接后显示' }}</strong>
            <span>弹幕转发 {{ liveState.relayUrl ? '已配置' : '未配置' }}</span>
          </div>
        </div>
        <div class="comment-list" aria-live="polite">
          <div v-for="item in liveState.activityFeed" :key="item.id" class="comment" :class="`event-${item.kind}`">
            <UserAvatar :src="item.userAvatar" :name="item.userName" />
            <div class="event-copy">
              <div class="event-title">
                <strong>{{ item.userName }}</strong>
                <span class="event-kind">{{ item.kind === 'gift' ? '礼物' : item.kind === 'like' ? '点赞' : '评论' }}</span>
              </div>
              <p><img v-if="item.kind === 'gift' && item.giftIcon" class="event-gift-icon" :src="item.giftIcon" alt="" />{{ item.detail }}</p>
            </div>
          </div>
          <div v-if="!liveState.activityFeed.length" class="empty">连接直播间后，评论、礼物和点赞会显示在这里</div>
        </div>
      </section>

      <ObsPreviewPanel />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { liveState, simulationState, startLiveSimulation, stopLiveSimulation } from '@/stores/liveStore';
import { canStartLiveSimulation, defaultLiveSimulationConfig, normalizeSimulationConfig, type SimulationGameId } from '@/services/liveSimulation';
import { nextQuestion, quizProgress, quizRuntimeSettings, quizState, setQuizPreviewConfig, stopQuiz } from '@/game/quiz/quizStore';
import { normalizeQuizTheme, readQuizTheme } from '@/game/quiz/quizThemes';
import { loadConfig, saveConfig } from '@/services/configApi';
import ObsPreviewPanel from './ObsPreviewPanel.vue';
import AppModal from '@/components/AppModal.vue';
import UserAvatar from '@/components/UserAvatar.vue';

const showSimulationConfig = ref(false);
const startingSimulation = ref(false);
const simulationConfigLoaded = ref(false);
const selectedSimulationGame = ref<SimulationGameId | null>(null);
const configError = ref('');
const canStartSimulation = computed(() => canStartLiveSimulation(liveState.connection, simulationState.active));
const simulationDraft = reactive({ ...defaultLiveSimulationConfig });
const remainingLabel = computed(() => {
  const seconds = Math.max(0, simulationState.durationSeconds - simulationState.elapsedSeconds);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
});

onMounted(async () => {
  try {
    const saved = await loadConfig();
    Object.assign(simulationDraft, normalizeSimulationConfig(saved.simulationConfig));
    quizRuntimeSettings.theme = readQuizTheme() || normalizeQuizTheme(saved.quizConfig.theme);
    liveState.roomId = saved.roomId;
    liveState.relayUrl = saved.relayUrl;
  } catch (error) {
    configError.value = error instanceof Error ? error.message : 'SQLite 配置读取失败';
  } finally {
    simulationConfigLoaded.value = true;
  }
});

function openSimulationSetup() {
  selectedSimulationGame.value = null;
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
    if (selectedSimulationGame.value === 'quiz') setQuizPreviewConfig(saved.quizConfig);
    if (startLiveSimulation(selectedSimulationGame.value, config)) showSimulationConfig.value = false;
  } catch (error) {
    configError.value = error instanceof Error ? error.message : '无法启动模拟直播';
  } finally {
    startingSimulation.value = false;
  }
}

function format(value: number) {
  return value ? new Intl.NumberFormat('zh-CN', { notation: 'compact' }).format(value) : '—';
}
</script>

<style scoped>
.console-page{width:min(100%,1480px);margin:0 auto;padding:30px clamp(20px,3vw,42px) 40px}
.console-heading{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:20px}
.eyebrow,.panel-kicker{color:var(--accent-2);font-size:9px;letter-spacing:.12em;font-weight:750}
.console-heading h1{margin:7px 0 5px;font-size:26px}
.console-heading p{margin:0;color:var(--muted);font-size:12px}
.heading-status{display:flex;align-items:center;gap:13px}
.status-stack{display:grid;justify-items:end;gap:4px}
.live-status{display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--line);border-radius:5px;color:var(--muted);font-size:11px;white-space:nowrap}
.live-status span{width:7px;height:7px;border-radius:50%;background:var(--muted)}
.live-status.live{color:var(--accent)}
.live-status.live span{background:var(--accent);box-shadow:0 0 10px var(--accent)}
.live-status.simulation{border-color:rgba(210,177,111,.3);color:var(--accent-2)}
.live-status.simulation span{background:var(--accent-2);box-shadow:0 0 9px rgba(210,177,111,.5)}
.simulation-clock{color:var(--muted);font-size:9px;font-variant-numeric:tabular-nums}
.room-identity{display:grid;gap:4px;padding-left:14px;border-left:1px solid var(--line)}
.room-identity strong{font-size:11px}
.room-identity span{color:var(--muted);font-size:10px}
.simulation-actions{display:flex;align-items:center;gap:6px;padding-left:12px;border-left:1px solid var(--line)}
.simulation-btn{min-height:31px;padding:6px 9px;border:1px solid var(--line);border-radius:4px;color:var(--ink);background:transparent;font-size:10px;white-space:nowrap}
.simulation-btn:hover:not(:disabled){border-color:var(--accent)}
.simulation-btn:disabled{opacity:.45;cursor:not-allowed}
.simulation-btn.start{border-color:var(--accent);color:#14211e;background:var(--accent);font-weight:700}
.simulation-btn.stop{border-color:rgba(220,125,105,.5);color:#e5a093}
.simulation-indicator{color:var(--accent-2);font:9px ui-monospace,monospace;letter-spacing:.08em}
.simulation-config>footer{display:flex;align-items:center;justify-content:space-between;gap:14px}
.simulation-config footer small{color:var(--muted);font-size:10px}
.simulation-fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:12px 0}
.simulation-fields label{display:grid;gap:5px;color:var(--muted);font-size:10px}
.simulation-fields input{width:100%;height:32px;padding:0 8px;border:1px solid var(--line);border-radius:4px;color:var(--ink);background:#111917;font-size:11px}
.game-picker{display:grid;gap:7px;margin:14px 0 0;padding:0;border:0}
.game-picker legend{margin-bottom:6px;color:var(--muted);font-size:10px}
.game-option{display:flex;align-items:center;gap:10px;min-height:54px;padding:9px 11px;border:1px solid var(--line);border-radius:4px;cursor:pointer}
.game-option.selected{border-color:var(--accent);background:rgba(137,207,189,.07)}
.game-option input{accent-color:var(--accent)}
.game-option>span:nth-of-type(1){display:grid;gap:3px}
.game-option strong{color:var(--ink);font-size:11px}
.game-option small,.game-status{color:var(--muted);font-size:9px}
.game-status{margin-left:auto}
.config-error{margin:10px 0;color:#e5968b;font-size:10px}
.game-control{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:14px;padding:11px 13px;border:1px solid var(--line);border-left:2px solid var(--accent-2);border-radius:5px;background:var(--panel)}
.game-summary{display:grid;gap:4px}
.game-summary strong{font-size:12px}
.game-summary small{color:var(--muted);font-size:10px}
.game-actions{display:flex;gap:7px}
.control-btn{padding:7px 10px;border:1px solid var(--line);border-radius:4px;color:var(--ink);background:transparent;font-size:10px}
.control-btn.primary{border-color:var(--accent);color:#13201d;background:var(--accent);font-weight:700}
.metric-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}
.metric-grid article{min-width:0;padding:13px 15px;border:1px solid var(--line);border-radius:5px;background:var(--panel)}
.metric-grid span,.metric-grid small{display:block;color:var(--muted);font-size:10px}
.metric-grid strong{display:block;margin:8px 0 4px;font-size:22px;font-variant-numeric:tabular-nums}
.console-workspace{display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,310px);align-items:start;gap:12px;margin-top:12px}
.feed-panel{min-width:0;min-height:500px;padding:16px;border:1px solid var(--line);border-radius:6px;background:var(--panel)}
.panel-header{display:flex;align-items:center;justify-content:space-between}
.panel-header h2{margin:5px 0 12px;font-size:16px}
.feed-count{color:var(--muted);font-size:10px}
.room-strip{display:flex;align-items:center;gap:10px;margin-bottom:8px;padding:8px;border:1px solid var(--line);border-radius:4px;background:rgba(255,255,255,.015)}
.room-cover{flex:0 0 42px;width:42px;height:32px;border-radius:3px;background:linear-gradient(145deg,#294137,#151c19);background-size:cover;background-position:center}
.room-copy{display:grid;gap:4px;min-width:0}
.room-copy strong{overflow:hidden;color:var(--ink);font-size:10px;text-overflow:ellipsis;white-space:nowrap}
.room-copy span{color:var(--muted);font-size:9px}
.comment-list{display:grid;max-height:460px;overflow:auto;align-content:start}
.comment{display:grid;grid-template-columns:28px minmax(0,1fr);align-items:center;gap:9px;min-height:53px;padding:8px 4px;border-bottom:1px solid rgba(188,213,201,.08)}
.event-gift-icon{display:inline-block;width:18px;height:18px;margin-right:5px;border-radius:3px;object-fit:contain;vertical-align:middle}
.event-copy{min-width:0}
.event-title{display:flex;align-items:center;gap:7px}
.comment strong{font-size:11px}
.event-kind{padding:2px 5px;border:1px solid var(--line);border-radius:3px;color:var(--muted);font-size:9px;line-height:1.2}
.event-gift .event-kind{border-color:rgba(210,177,111,.35);color:var(--accent-2)}
.event-like .event-kind{border-color:rgba(137,207,189,.35);color:var(--accent)}
.comment p{margin:3px 0 0;color:var(--muted);font-size:11px;overflow-wrap:anywhere}
.empty{padding:45px 10px;text-align:center;color:var(--muted);font-size:11px}
@media(max-width:1060px){.console-workspace{grid-template-columns:minmax(0,1fr) minmax(245px,290px)}.console-page{padding-right:20px;padding-left:20px}}
@media(max-width:880px){.console-workspace{grid-template-columns:minmax(0,1fr)}.preview-panel{display:grid;grid-template-columns:minmax(180px,260px) minmax(0,1fr);align-items:start;column-gap:16px}.preview-heading{grid-column:1/-1}.preview-frame{grid-row:2 / span 2;width:min(100%,260px)}.source-details{margin-top:0;padding-top:0;border-top:0}}
@media(max-width:900px){.heading-status{gap:8px}.simulation-actions{padding-left:8px}.room-identity{padding-left:9px}}
@media(max-width:620px){.console-heading{align-items:flex-start;flex-direction:column}.heading-status{width:100%;justify-content:space-between;flex-wrap:wrap}.room-identity{margin-left:auto}.simulation-actions{padding-left:0;border-left:0}.simulation-config>footer{align-items:stretch;flex-direction:column}.simulation-config>footer .simulation-btn{width:100%}.simulation-fields{grid-template-columns:1fr}.metric-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.game-control{align-items:flex-start;flex-direction:column}.game-actions{width:100%}.game-actions .control-btn{flex:1}.console-workspace{display:flex;flex-direction:column}.preview-panel{display:block;order:-1;width:100%}.preview-frame{width:min(100%,280px)}.source-details{margin-top:14px;padding-top:13px;border-top:1px solid var(--line)}.feed-panel{min-height:320px}}
</style>
