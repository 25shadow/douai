<script setup lang="ts">
import { computed } from 'vue';
import { versusState } from '@/game/versus/versusStore';

const props = defineProps<{ outputOnly?: boolean }>();

const redPlayers = computed(() =>
  Object.values(versusState.players)
    .filter(p => p.team === 'red')
    .sort((a, b) => b.score - a.score)
);

const bluePlayers = computed(() =>
  Object.values(versusState.players)
    .filter(p => p.team === 'blue')
    .sort((a, b) => b.score - a.score)
);

const totalScore = computed(() => versusState.redScore + versusState.blueScore);
const redRatio = computed(() => {
  if (!totalScore.value) return 50;
  return Math.max(10, Math.min(90, Math.round((versusState.redScore / totalScore.value) * 100)));
});
</script>

<template>
  <main class="versus-canvas" :class="{ 'output-only': props.outputOnly }">
    <!-- 玩法指示横幅 -->
    <header class="versus-guide-bar">
      <div class="vs-guide-badge">🕹️ 对抗玩法</div>
      <div class="vs-guide-text">
        <span>发送 <b>1</b> 加入红队助战</span>
        <span class="sep">|</span>
        <span>发送 <b>2</b> 加入蓝队助战</span>
        <span class="sep">|</span>
        <span>送礼触发 <b>5倍积分暴击</b></span>
      </div>
    </header>

    <!-- 顶部拔河大能量槽 (先达200分胜出) -->
    <section class="versus-header-energy">
      <div class="faction-score red">
        <span class="faction-title">🔴 烈焰红队</span>
        <strong class="faction-num">{{ versusState.redScore }}</strong>
        <small>目标 {{ versusState.targetScore }} 分</small>
      </div>

      <div class="versus-tug-track">
        <div class="tug-fill red-fill" :style="{ width: `${redRatio}%` }"></div>
        <div class="tug-vs-emblem">VS</div>
        <div class="tug-fill blue-fill" :style="{ width: `${100 - redRatio}%` }"></div>
      </div>

      <div class="faction-score blue">
        <span class="faction-title">🔵 极光蓝队</span>
        <strong class="faction-num">{{ versusState.blueScore }}</strong>
        <small>目标 {{ versusState.targetScore }} 分</small>
      </div>
    </section>

    <!-- 中部战场大舞台 (大按键扣1/扣2 + 实时暴击动效) -->
    <section class="versus-middle-stage">
      <div class="versus-btn-grid">
        <!-- 红队战区 -->
        <div class="versus-action-card red-card">
          <div class="card-glow-bg"></div>
          <div class="card-big-tag">扣 1 进红队</div>
          <h2 class="card-hero-num">1</h2>
          <p class="card-slogan">为烈焰红队贡献 +1 积分</p>
          <div class="card-players-count">当前红队战将：{{ redPlayers.length }} 人</div>
        </div>

        <!-- 蓝队战区 -->
        <div class="versus-action-card blue-card">
          <div class="card-glow-bg"></div>
          <div class="card-big-tag">扣 2 进蓝队</div>
          <h2 class="card-hero-num">2</h2>
          <p class="card-slogan">为极光蓝队贡献 +1 积分</p>
          <div class="card-players-count">当前蓝队战将：{{ bluePlayers.length }} 人</div>
        </div>
      </div>

      <!-- 实时暴击打击流 (张三 扣1 为红队+1) -->
      <div class="versus-hit-stream">
        <div v-if="versusState.recentHits.length" class="hit-bubbles-row">
          <div
            v-for="hit in versusState.recentHits"
            :key="hit.id"
            class="hit-pop-bubble"
            :class="hit.team"
          >
            <span class="hit-team-dot"></span>
            <strong>{{ hit.name }}</strong>
            <span class="hit-action">扣 {{ hit.choice }}</span>
            <b class="hit-val">+{{ hit.pts }}分</b>
          </div>
        </div>
        <div v-else class="hit-empty-hint">
          <span>💥 公屏发送 1 或 2，立即加入阵营并在大屏触发暴击火花！</span>
        </div>
      </div>
    </section>

    <!-- 底部红蓝双阵营贡献榜对垒 -->
    <section class="versus-bottom-rosters">
      <!-- 红队荣誉榜 -->
      <div class="roster-board red">
        <div class="roster-header">
          <span>🔴 红队贡献榜</span>
          <small>{{ redPlayers.length }} 人在列</small>
        </div>
        <div v-if="redPlayers.length" class="roster-list">
          <div
            v-for="(p, idx) in redPlayers.slice(0, 8)"
            :key="p.id"
            class="roster-item"
            :class="{ mvp: idx === 0 }"
          >
            <span class="r-rank">{{ idx === 0 ? '👑 MVP' : `#${idx + 1}` }}</span>
            <span class="r-name">{{ p.name }}</span>
            <strong class="r-pts">{{ p.score }}分</strong>
          </div>
        </div>
        <div v-else class="roster-empty">虚位以待 · 发送 1 即刻登榜</div>
      </div>

      <!-- 蓝队荣誉榜 -->
      <div class="roster-board blue">
        <div class="roster-header">
          <span>🔵 蓝队贡献榜</span>
          <small>{{ bluePlayers.length }} 人在列</small>
        </div>
        <div v-if="bluePlayers.length" class="roster-list">
          <div
            v-for="(p, idx) in bluePlayers.slice(0, 8)"
            :key="p.id"
            class="roster-item"
            :class="{ mvp: idx === 0 }"
          >
            <span class="r-rank">{{ idx === 0 ? '👑 MVP' : `#${idx + 1}` }}</span>
            <span class="r-name">{{ p.name }}</span>
            <strong class="r-pts">{{ p.score }}分</strong>
          </div>
        </div>
        <div v-else class="roster-empty">虚位以待 · 发送 2 即刻登榜</div>
      </div>
    </section>

    <!-- 获胜胜利弹窗结语 -->
    <div v-if="versusState.winner" class="winner-modal-overlay">
      <div class="winner-modal-box" :class="versusState.winner">
        <div class="winner-trophy">🏆</div>
        <h1>{{ versusState.winner === 'red' ? '烈焰红队 获胜！' : '极光蓝队 获胜！' }}</h1>
        <p>全军出击，勇夺桂冠！感谢本场所有助威观众！</p>
      </div>
    </div>
  </main>
</template>

<style scoped>
.versus-canvas {
  position: relative;
  width: 1080px;
  height: 1920px;
  background: #09090b;
  color: #ffffff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: 'Douyin Sans', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  user-select: none;
  box-sizing: border-box;
}

.versus-guide-bar {
  width: 100%;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: #18181b;
  border-bottom: 2px solid #3f3f46;
}
.vs-guide-badge {
  padding: 6px 16px;
  border-radius: 999px;
  background: #e11d48;
  color: #ffffff;
  font-size: 20px;
  font-weight: 800;
}
.vs-guide-text {
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 22px;
  font-weight: 700;
  color: #e4e4e7;
}
.vs-guide-text b { color: #fbbf24; }
.vs-guide-text .sep { color: #52525b; }

/* 顶部对决拔河能量槽 */
.versus-header-energy {
  padding: 32px 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 32px;
  background: #18181b;
  border-bottom: 3px solid #27272a;
}
.faction-score {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 160px;
}
.faction-score.blue { align-items: flex-end; }
.faction-title {
  font-size: 26px;
  font-weight: 900;
}
.faction-score.red .faction-title { color: #f43f5e; }
.faction-score.blue .faction-title { color: #38bdf8; }
.faction-num {
  font-size: 56px;
  font-weight: 900;
  line-height: 1.1;
}
.faction-score.red .faction-num { color: #f43f5e; }
.faction-score.blue .faction-num { color: #38bdf8; }
.faction-score small {
  font-size: 18px;
  color: #71717a;
}

.versus-tug-track {
  flex: 1;
  height: 52px;
  border-radius: 999px;
  background: #09090b;
  border: 4px solid #3f3f46;
  position: relative;
  display: flex;
  overflow: hidden;
}
.tug-fill {
  height: 100%;
  transition: width 0.3s ease;
}
.tug-fill.red-fill {
  background: linear-gradient(90deg, #be123c, #f43f5e);
}
.tug-fill.blue-fill {
  background: linear-gradient(90deg, #0284c7, #38bdf8);
}
.tug-vs-emblem {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #fbbf24;
  color: #000;
  font-size: 24px;
  font-weight: 900;
  padding: 4px 16px;
  border-radius: 999px;
  z-index: 10;
  box-shadow: 0 0 16px rgba(251, 191, 36, 0.6);
}

/* 中部大卡片对决舞台 */
.versus-middle-stage {
  flex: 0 0 760px;
  padding: 40px 48px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.versus-btn-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 36px;
}
.versus-action-card {
  position: relative;
  overflow: hidden;
  border-radius: 36px;
  padding: 48px 36px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4);
}
.versus-action-card.red-card {
  background: linear-gradient(180deg, #271116 0%, #17090c 100%);
  border: 4px solid #f43f5e;
}
.versus-action-card.blue-card {
  background: linear-gradient(180deg, #0c1a2d 0%, #060e18 100%);
  border: 4px solid #38bdf8;
}
.card-big-tag {
  font-size: 28px;
  font-weight: 900;
  padding: 8px 24px;
  border-radius: 999px;
  margin-bottom: 20px;
}
.red-card .card-big-tag { background: #f43f5e; color: #fff; }
.blue-card .card-big-tag { background: #38bdf8; color: #000; }
.card-hero-num {
  margin: 0 0 16px;
  font-size: 160px;
  font-weight: 900;
  line-height: 1;
}
.red-card .card-hero-num { color: #f43f5e; text-shadow: 0 0 40px rgba(244, 63, 94, 0.5); }
.blue-card .card-hero-num { color: #38bdf8; text-shadow: 0 0 40px rgba(56, 189, 248, 0.5); }
.card-slogan {
  margin: 0 0 20px;
  font-size: 26px;
  color: #e4e4e7;
  font-weight: 700;
}
.card-players-count {
  font-size: 22px;
  color: #a1a1aa;
}

/* 暴击伤害流 */
.versus-hit-stream {
  min-height: 80px;
  background: #18181b;
  border-radius: 24px;
  padding: 16px 24px;
  display: flex;
  align-items: center;
  border: 2px dashed #3f3f46;
}
.hit-bubbles-row {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  width: 100%;
}
.hit-pop-bubble {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 18px;
  border-radius: 999px;
  background: #27272a;
  border: 2px solid #3f3f46;
  white-space: nowrap;
}
.hit-pop-bubble.red { border-color: #f43f5e; background: rgba(244, 63, 94, 0.15); }
.hit-pop-bubble.blue { border-color: #38bdf8; background: rgba(56, 189, 248, 0.15); }
.hit-team-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
}
.hit-pop-bubble.red .hit-team-dot { background: #f43f5e; }
.hit-pop-bubble.blue .hit-team-dot { background: #38bdf8; }
.hit-action {
  font-size: 20px;
  font-weight: 800;
  color: #fbbf24;
}
.hit-val {
  font-size: 22px;
  font-weight: 900;
  color: #22c55e;
}
.hit-empty-hint {
  width: 100%;
  text-align: center;
  color: #71717a;
  font-size: 24px;
}

/* 底部双阵营名册 */
.versus-bottom-rosters {
  flex: 1;
  padding: 0 48px 48px;
  display: flex;
  gap: 36px;
  min-height: 0;
}
.roster-board {
  flex: 1;
  background: #18181b;
  border: 3px solid #27272a;
  border-radius: 32px;
  padding: 24px;
  display: flex;
  flex-direction: column;
}
.roster-board.red { border-top: 8px solid #f43f5e; }
.roster-board.blue { border-top: 8px solid #38bdf8; }
.roster-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 16px;
  border-bottom: 2px solid #27272a;
  font-size: 26px;
  font-weight: 900;
}
.roster-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 14px;
}
.roster-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 18px;
  border-radius: 16px;
  background: #27272a;
}
.roster-item.mvp {
  background: #3f3f46;
  border: 2px solid #fbbf24;
}
.r-rank {
  font-size: 20px;
  font-weight: 800;
  color: #fbbf24;
}
.r-name {
  flex: 1;
  margin: 0 16px;
  font-size: 22px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.r-pts {
  font-size: 24px;
  font-weight: 900;
  color: #22c55e;
}
.roster-empty {
  flex: 1;
  display: grid;
  place-items: center;
  color: #71717a;
  font-size: 24px;
}

/* 胜负弹窗 */
.winner-modal-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(12px);
  z-index: 100;
  display: grid;
  place-items: center;
}
.winner-modal-box {
  width: 800px;
  border-radius: 40px;
  padding: 60px;
  text-align: center;
  border: 6px solid #fbbf24;
  box-shadow: 0 0 80px rgba(251, 191, 36, 0.5);
}
.winner-modal-box.red { background: linear-gradient(180deg, #be123c, #1c0a0e); }
.winner-modal-box.blue { background: linear-gradient(180deg, #0284c7, #071526); }
.winner-trophy { font-size: 120px; margin-bottom: 20px; }
.winner-modal-box h1 { font-size: 64px; margin: 0 0 20px; font-weight: 900; }
.winner-modal-box p { font-size: 32px; margin: 0; color: #e4e4e7; }
</style>
