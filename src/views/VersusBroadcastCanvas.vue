<script setup lang="ts">
import { computed } from 'vue';
import {
  versusState,
  versusRuntimeSettings,
  versusThemes,
  setVersusTheme,
  type VersusThemeId
} from '@/game/versus/versusStore';

const props = defineProps<{ outputOnly?: boolean }>();

const currentTheme = computed(() => versusRuntimeSettings.theme || 'tug');

function selectTheme(t: VersusThemeId) {
  setVersusTheme(t);
}

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
  return Math.max(8, Math.min(92, Math.round((versusState.redScore / totalScore.value) * 100)));
});
</script>

<template>
  <main class="versus-canvas" :class="[`theme-${currentTheme}`, { 'output-only': props.outputOnly }]">
    <!-- 顶部主题快速切换栏 (OBS采集时不显示) -->
    <nav v-if="!props.outputOnly" class="versus-theme-switcher">
      <button
        v-for="t in versusThemes"
        :key="t.id"
        class="theme-tab-btn"
        :class="{ active: currentTheme === t.id }"
        type="button"
        @click="selectTheme(t.id)"
      >
        {{ t.name }}
      </button>
    </nav>

    <!-- 统一显眼玩法攻略横幅 -->
    <header class="versus-guide-bar">
      <div class="vs-guide-badge">⚔️ 阵营对抗</div>
      <div class="vs-guide-text">
        <span>发送 <b>{{ versusRuntimeSettings.redCommand }}</b> 助攻 {{ versusRuntimeSettings.redTeamName }}</span>
        <span class="sep">|</span>
        <span>发送 <b>{{ versusRuntimeSettings.blueCommand }}</b> 助攻 {{ versusRuntimeSettings.blueTeamName }}</span>
        <span class="sep">|</span>
        <span>送礼触发 <b>{{ versusRuntimeSettings.giftMultiplier }}倍积分暴击</b></span>
      </div>
    </header>

    <!-- =========================================================================
         THEME 1: 能量拔河巨力流 (tug)
         ========================================================================= -->
    <div v-if="currentTheme === 'tug'" class="layout-tug">
      <!-- 顶部拔河大能量槽 (目标分制) -->
      <section class="tug-header-energy">
        <div class="faction-score red">
          <span class="faction-title">🔴 {{ versusRuntimeSettings.redTeamName }}</span>
          <strong class="faction-num">{{ versusState.redScore }}</strong>
          <small>先达 {{ versusState.targetScore }} 分获胜</small>
        </div>

        <div class="versus-tug-track">
          <div class="tug-fill red-fill" :style="{ width: `${redRatio}%` }">
            <span class="tug-pct-label">{{ redRatio }}%</span>
          </div>
          <div class="tug-vs-emblem">VS</div>
          <div class="tug-fill blue-fill" :style="{ width: `${100 - redRatio}%` }">
            <span class="tug-pct-label">{{ 100 - redRatio }}%</span>
          </div>
        </div>

        <div class="faction-score blue">
          <span class="faction-title">🔵 {{ versusRuntimeSettings.blueTeamName }}</span>
          <strong class="faction-num">{{ versusState.blueScore }}</strong>
          <small>先达 {{ versusState.targetScore }} 分获胜</small>
        </div>
      </section>

      <!-- 中部战场大卡 (大按键扣1/扣2 + 实时暴击粒子池) -->
      <section class="tug-middle-stage">
        <div class="versus-btn-grid">
          <!-- 红队战区卡 -->
          <div class="versus-action-card red-card">
            <div class="card-glow-bg"></div>
            <div class="card-big-tag">扣 {{ versusRuntimeSettings.redCommand }} 进红队</div>
            <h2 class="card-hero-num">{{ versusRuntimeSettings.redCommand }}</h2>
            <p class="card-slogan">为{{ versusRuntimeSettings.redTeamName }}贡献 +1 积分</p>
            <div class="card-players-count">当前战将：{{ redPlayers.length }} 人</div>
          </div>

          <!-- 蓝队战区卡 -->
          <div class="versus-action-card blue-card">
            <div class="card-glow-bg"></div>
            <div class="card-big-tag">扣 {{ versusRuntimeSettings.blueCommand }} 进蓝队</div>
            <h2 class="card-hero-num">{{ versusRuntimeSettings.blueCommand }}</h2>
            <p class="card-slogan">为{{ versusRuntimeSettings.blueTeamName }}贡献 +1 积分</p>
            <div class="card-players-count">当前战将：{{ bluePlayers.length }} 人</div>
          </div>
        </div>

        <!-- 实时打击流 -->
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
            <span>💥 公屏发送 {{ versusRuntimeSettings.redCommand }} 或 {{ versusRuntimeSettings.blueCommand }}，立即加入阵营并在大屏触发暴击火花！</span>
          </div>
        </div>
      </section>

      <!-- 底部双阵营荣誉榜 -->
      <section class="tug-bottom-rosters">
        <div class="roster-board red">
          <div class="roster-header">
            <span>🔴 {{ versusRuntimeSettings.redTeamName }}贡献榜</span>
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
          <div v-else class="roster-empty">虚位以待 · 发送 {{ versusRuntimeSettings.redCommand }} 即刻登榜</div>
        </div>

        <div class="roster-board blue">
          <div class="roster-header">
            <span>🔵 {{ versusRuntimeSettings.blueTeamName }}贡献榜</span>
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
          <div v-else class="roster-empty">虚位以待 · 发送 {{ versusRuntimeSettings.blueCommand }} 即刻登榜</div>
        </div>
      </section>
    </div>

    <!-- =========================================================================
         THEME 2: 赛博要塞机甲流 (mecha)
         ========================================================================= -->
    <div v-else-if="currentTheme === 'mecha'" class="layout-mecha">
      <section class="mecha-towers-stage">
        <!-- 红色机甲要塞 -->
        <div class="mecha-fortress red-fortress">
          <div class="fortress-header">
            <span class="fortress-beacon"></span>
            <strong>{{ versusRuntimeSettings.redTeamName }}要塞</strong>
            <span class="fortress-hp-text">{{ versusState.redScore }} / {{ versusState.targetScore }} HP</span>
          </div>
          <div class="fortress-core-gauge">
            <div class="core-plasma-fill red" :style="{ height: `${Math.min(100, (versusState.redScore / versusState.targetScore) * 100)}%` }"></div>
            <div class="core-symbol">🔴</div>
          </div>
          <div class="fortress-cannon-btn">
            <span>发送 [{{ versusRuntimeSettings.redCommand }}] 聚能充能</span>
            <b>+1 护盾火炮</b>
          </div>
        </div>

        <div class="mecha-versus-reactor">
          <div class="reactor-pulse-ring">
            <span class="reactor-vs">VS</span>
          </div>
          <span class="reactor-sub">ENERGY CLASH</span>
        </div>

        <!-- 蓝色机甲要塞 -->
        <div class="mecha-fortress blue-fortress">
          <div class="fortress-header">
            <span class="fortress-beacon blue"></span>
            <strong>{{ versusRuntimeSettings.blueTeamName }}要塞</strong>
            <span class="fortress-hp-text">{{ versusState.blueScore }} / {{ versusState.targetScore }} HP</span>
          </div>
          <div class="fortress-core-gauge">
            <div class="core-plasma-fill blue" :style="{ height: `${Math.min(100, (versusState.blueScore / versusState.targetScore) * 100)}%` }"></div>
            <div class="core-symbol">🔵</div>
          </div>
          <div class="fortress-cannon-btn blue">
            <span>发送 [{{ versusRuntimeSettings.blueCommand }}] 离子充能</span>
            <b>+1 护盾激光</b>
          </div>
        </div>
      </section>

      <!-- 科技战况打击雷达流 -->
      <section class="mecha-radar-stream">
        <div class="radar-header">
          <span>📡 REALTIME TELEMETRY · 机甲武器击发监测</span>
          <small>送礼触发 {{ versusRuntimeSettings.giftMultiplier }} 倍战力充能</small>
        </div>
        <div v-if="versusState.recentHits.length" class="mecha-hits-list">
          <div
            v-for="hit in versusState.recentHits"
            :key="hit.id"
            class="mecha-hit-chip"
            :class="hit.team"
          >
            <span class="chip-dot"></span>
            <span class="chip-name">{{ hit.name }}</span>
            <b class="chip-dmg">{{ hit.team === 'red' ? '赤焰激光' : '极光重炮' }} +{{ hit.pts }}</b>
          </div>
        </div>
        <div v-else class="mecha-empty-radar">
          <span>等待指令输入：发送 {{ versusRuntimeSettings.redCommand }} 或 {{ versusRuntimeSettings.blueCommand }} 激活要塞主炮！</span>
        </div>
      </section>

      <!-- 机甲指挥官双列榜 -->
      <section class="mecha-commanders-grid">
        <div class="mecha-card red">
          <h3>🔴 {{ versusRuntimeSettings.redTeamName }}指挥官</h3>
          <div v-if="redPlayers.length" class="mecha-ranks">
            <div v-for="(p, i) in redPlayers.slice(0, 6)" :key="p.id" class="mecha-row">
              <span>#{{ i + 1 }} {{ p.name }}</span>
              <b>{{ p.score }} 战力</b>
            </div>
          </div>
          <div v-else class="mecha-empty">虚位以待</div>
        </div>

        <div class="mecha-card blue">
          <h3>🔵 {{ versusRuntimeSettings.blueTeamName }}指挥官</h3>
          <div v-if="bluePlayers.length" class="mecha-ranks">
            <div v-for="(p, i) in bluePlayers.slice(0, 6)" :key="p.id" class="mecha-row">
              <span>#{{ i + 1 }} {{ p.name }}</span>
              <b>{{ p.score }} 战力</b>
            </div>
          </div>
          <div v-else class="mecha-empty">虚位以待</div>
        </div>
      </section>
    </div>

    <!-- =========================================================================
         THEME 3: 像素街机格斗流 (arcade)
         ========================================================================= -->
    <div v-else-if="currentTheme === 'arcade'" class="layout-arcade-vs">
      <!-- 街机格斗 HP 血条 -->
      <section class="arcade-fighter-hud">
        <div class="arcade-hp-box red-hp">
          <div class="fighter-tag">1P · {{ versusRuntimeSettings.redTeamName }}</div>
          <div class="hp-bar-outer">
            <div class="hp-bar-inner red" :style="{ width: `${Math.min(100, (versusState.redScore / versusState.targetScore) * 100)}%` }"></div>
          </div>
          <span class="hp-num">{{ versusState.redScore }} PTS</span>
        </div>

        <div class="arcade-ko-clock">
          <span class="ko-badge">KO</span>
          <strong class="ko-target">{{ versusState.targetScore }}</strong>
        </div>

        <div class="arcade-hp-box blue-hp">
          <div class="fighter-tag">2P · {{ versusRuntimeSettings.blueTeamName }}</div>
          <div class="hp-bar-outer">
            <div class="hp-bar-inner blue" :style="{ width: `${Math.min(100, (versusState.blueScore / versusState.targetScore) * 100)}%` }"></div>
          </div>
          <span class="hp-num">{{ versusState.blueScore }} PTS</span>
        </div>
      </section>

      <!-- 街机操控按钮台 -->
      <section class="arcade-punch-deck">
        <div class="arcade-stick-btn red-punch">
          <div class="punch-key">{{ versusRuntimeSettings.redCommand }}</div>
          <div class="punch-label">
            <strong>{{ versusRuntimeSettings.redTeamName }} 连击拳</strong>
            <span>发送 {{ versusRuntimeSettings.redCommand }} 猛击</span>
          </div>
        </div>

        <div class="arcade-stick-btn blue-punch">
          <div class="punch-key">{{ versusRuntimeSettings.blueCommand }}</div>
          <div class="punch-label">
            <strong>{{ versusRuntimeSettings.blueTeamName }} 飞旋踢</strong>
            <span>发送 {{ versusRuntimeSettings.blueCommand }} 猛击</span>
          </div>
        </div>
      </section>

      <!-- 街机连击伤害弹幕 -->
      <section class="arcade-hit-combos">
        <div v-if="versusState.recentHits.length" class="combo-chips-grid">
          <div v-for="hit in versusState.recentHits" :key="hit.id" class="combo-chip" :class="hit.team">
            <span>{{ hit.name }}</span>
            <strong>HIT +{{ hit.pts }}</strong>
          </div>
        </div>
        <div v-else class="arcade-idle-msg">
          <span>🕹️ INSERT COIN / 弹幕输入 {{ versusRuntimeSettings.redCommand }} 或 {{ versusRuntimeSettings.blueCommand }} 开始格斗连击！</span>
        </div>
      </section>

      <!-- 街机高分名人堂榜 -->
      <section class="arcade-hall-fame">
        <div class="hall-column red">
          <h4>🏆 1P 烈焰战神榜</h4>
          <div v-for="(p, i) in redPlayers.slice(0, 5)" :key="p.id" class="hall-row">
            <span>{{ i === 0 ? '👑 1ST' : `#${i + 1}` }} {{ p.name }}</span>
            <b>{{ p.score }}</b>
          </div>
        </div>
        <div class="hall-column blue">
          <h4>🏆 2P 极光武尊榜</h4>
          <div v-for="(p, i) in bluePlayers.slice(0, 5)" :key="p.id" class="hall-row">
            <span>{{ i === 0 ? '👑 1ST' : `#${i + 1}` }} {{ p.name }}</span>
            <b>{{ p.score }}</b>
          </div>
        </div>
      </section>
    </div>

    <!-- =========================================================================
         THEME 4: 巅峰角斗擂台流 (colosseum)
         ========================================================================= -->
    <div v-else class="layout-colosseum">
      <!-- 擂台聚光灯对决顶部 -->
      <section class="ring-top-banner">
        <div class="corner-corner red-corner">
          <span class="corner-glove">🥊</span>
          <strong>{{ versusRuntimeSettings.redTeamName }} (红角)</strong>
          <b class="corner-pts">{{ versusState.redScore }} 分</b>
        </div>

        <div class="ring-center-vs">
          <div class="vs-glow-shield">VS</div>
          <small>争夺金腰带 · 目标 {{ versusState.targetScore }} 分</small>
        </div>

        <div class="corner-corner blue-corner">
          <span class="corner-glove blue">🥊</span>
          <strong>{{ versusRuntimeSettings.blueTeamName }} (蓝角)</strong>
          <b class="corner-pts">{{ versusState.blueScore }} 分</b>
        </div>
      </section>

      <!-- 拳击重拳出击动作台 -->
      <section class="boxing-actions-deck">
        <div class="glove-card red-glove">
          <div class="glove-hero-key">{{ versusRuntimeSettings.redCommand }}</div>
          <h2>红角重拳出击</h2>
          <p>公屏发送 {{ versusRuntimeSettings.redCommand }} 呐喊助威</p>
          <span class="glove-army">战队战将：{{ redPlayers.length }} 人</span>
        </div>

        <div class="glove-card blue-glove">
          <div class="glove-hero-key blue">{{ versusRuntimeSettings.blueCommand }}</div>
          <h2>蓝角迎头痛击</h2>
          <p>公屏发送 {{ versusRuntimeSettings.blueCommand }} 呐喊助威</p>
          <span class="glove-army">战队战将：{{ bluePlayers.length }} 人</span>
        </div>
      </section>

      <!-- 欢呼助威实时火花流 -->
      <section class="cheer-spark-lane">
        <div v-if="versusState.recentHits.length" class="spark-chips-wrap">
          <div v-for="hit in versusState.recentHits" :key="hit.id" class="spark-chip" :class="hit.team">
            <span class="spark-icon">⚡</span>
            <strong>{{ hit.name }}</strong>
            <span>出拳 +{{ hit.pts }}分</span>
          </div>
        </div>
        <div v-else class="spark-empty">
          <span>🥊 擂台铃声已敲响！公屏发送 {{ versusRuntimeSettings.redCommand }} 或 {{ versusRuntimeSettings.blueCommand }} 击打沙袋助威！</span>
        </div>
      </section>

      <!-- 拳王战绩对决榜 -->
      <section class="champions-bottom-board">
        <div class="champ-box red">
          <h4>👑 红角先锋功勋榜</h4>
          <div v-for="(p, i) in redPlayers.slice(0, 5)" :key="p.id" class="champ-row">
            <span>{{ i === 0 ? '🥇 拳王' : `#${i + 1}` }} {{ p.name }}</span>
            <b>{{ p.score }}分</b>
          </div>
        </div>
        <div class="champ-box blue">
          <h4>👑 蓝角先锋功勋榜</h4>
          <div v-for="(p, i) in bluePlayers.slice(0, 5)" :key="p.id" class="champ-row">
            <span>{{ i === 0 ? '🥇 拳王' : `#${i + 1}` }} {{ p.name }}</span>
            <b>{{ p.score }}分</b>
          </div>
        </div>
      </section>
    </div>

    <!-- 获胜胜利弹窗结语 -->
    <div v-if="versusState.winner" class="winner-modal-overlay">
      <div class="winner-modal-box" :class="versusState.winner">
        <div class="winner-trophy">🏆</div>
        <h1>{{ versusState.winner === 'red' ? `${versusRuntimeSettings.redTeamName} 获胜！` : `${versusRuntimeSettings.blueTeamName} 获胜！` }}</h1>
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

/* 顶部主题快速切换栏 */
.versus-theme-switcher {
  position: absolute;
  top: 14px;
  right: 20px;
  z-index: 100;
  display: flex;
  gap: 8px;
  background: rgba(0, 0, 0, 0.7);
  padding: 6px 12px;
  border-radius: 999px;
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.15);
}
.theme-tab-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 15px;
  font-weight: 700;
  padding: 6px 14px;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.theme-tab-btn.active {
  background: #f43f5e;
  color: #ffffff;
  box-shadow: 0 0 12px rgba(244, 63, 94, 0.5);
}

/* 统一显眼玩法攻略横幅 */
.versus-guide-bar {
  width: 100%;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 0 32px;
  gap: 16px;
  background: #18181b;
  border-bottom: 2px solid #3f3f46;
  box-sizing: border-box;
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
  font-size: 20px;
  font-weight: 700;
  color: #e4e4e7;
}
.vs-guide-text b { color: #fbbf24; }
.vs-guide-text .sep { color: #52525b; }

/* ============================================================================
   THEME 1: 能量拔河流
   ============================================================================ */
.layout-tug {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.tug-header-energy {
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
  min-width: 180px;
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
  display: flex;
  align-items: center;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.red-fill {
  background: linear-gradient(90deg, #be123c, #f43f5e);
  justify-content: flex-start;
  padding-left: 16px;
}
.blue-fill {
  background: linear-gradient(90deg, #0284c7, #38bdf8);
  justify-content: flex-end;
  padding-right: 16px;
}
.tug-pct-label {
  font-size: 20px;
  font-weight: 900;
  color: #ffffff;
}
.tug-vs-emblem {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 50px;
  height: 50px;
  background: #09090b;
  border: 3px solid #fbbf24;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 20px;
  font-weight: 900;
  color: #fbbf24;
  z-index: 10;
  box-shadow: 0 0 16px rgba(251, 191, 36, 0.5);
}

.tug-middle-stage {
  padding: 32px 48px;
  display: flex;
  flex-direction: column;
  gap: 28px;
}
.versus-btn-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 28px;
}
.versus-action-card {
  position: relative;
  overflow: hidden;
  border-radius: 32px;
  padding: 36px 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
}
.red-card {
  background: linear-gradient(180deg, #1f1315 0%, #09090b 100%);
  border: 4px solid #f43f5e;
}
.blue-card {
  background: linear-gradient(180deg, #0c1a24 0%, #09090b 100%);
  border: 4px solid #38bdf8;
}
.card-big-tag {
  font-size: 24px;
  font-weight: 900;
  padding: 6px 20px;
  border-radius: 999px;
  margin-bottom: 16px;
}
.red-card .card-big-tag { background: #f43f5e; color: #ffffff; }
.blue-card .card-big-tag { background: #38bdf8; color: #020617; }
.card-hero-num {
  font-size: 96px;
  font-weight: 900;
  line-height: 1;
  margin: 8px 0;
}
.red-card .card-hero-num { color: #f43f5e; text-shadow: 0 0 30px rgba(244, 63, 94, 0.6); }
.blue-card .card-hero-num { color: #38bdf8; text-shadow: 0 0 30px rgba(56, 189, 248, 0.6); }
.card-slogan {
  font-size: 22px;
  font-weight: 700;
  color: #e4e4e7;
  margin: 0 0 12px;
}
.card-players-count {
  font-size: 18px;
  color: #a1a1aa;
}

.versus-hit-stream {
  min-height: 80px;
  background: #18181b;
  border: 2px dashed #3f3f46;
  border-radius: 20px;
  padding: 14px 20px;
  display: flex;
  align-items: center;
}
.hit-bubbles-row {
  display: flex;
  gap: 14px;
  overflow-x: auto;
  width: 100%;
}
.hit-pop-bubble {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  border-radius: 999px;
  font-size: 18px;
  background: #27272a;
  white-space: nowrap;
}
.hit-pop-bubble.red { border: 2px solid #f43f5e; }
.hit-pop-bubble.blue { border: 2px solid #38bdf8; }
.hit-team-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.hit-pop-bubble.red .hit-team-dot { background: #f43f5e; }
.hit-pop-bubble.blue .hit-team-dot { background: #38bdf8; }
.hit-empty-hint {
  width: 100%;
  text-align: center;
  color: #71717a;
  font-size: 20px;
}

.tug-bottom-rosters {
  flex: 1;
  padding: 0 48px 36px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 28px;
  min-height: 0;
}
.roster-board {
  background: #18181b;
  border-radius: 28px;
  padding: 24px 28px;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.roster-board.red { border: 3px solid rgba(244, 63, 94, 0.4); }
.roster-board.blue { border: 3px solid rgba(56, 189, 248, 0.4); }
.roster-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 16px;
  border-bottom: 2px solid #27272a;
  margin-bottom: 14px;
  font-size: 22px;
  font-weight: 900;
}
.roster-header small { font-size: 16px; color: #71717a; font-weight: normal; }
.roster-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.roster-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: #27272a;
  border-radius: 12px;
  font-size: 18px;
}
.roster-item.mvp {
  background: rgba(251, 191, 36, 0.15);
  border: 1px solid #fbbf24;
}
.r-rank { font-weight: 800; color: #fbbf24; }
.r-name { flex: 1; margin: 0 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.r-pts { color: #22c55e; font-weight: 900; }
.roster-empty {
  flex: 1;
  display: grid;
  place-items: center;
  color: #71717a;
  font-size: 18px;
}

/* ============================================================================
   THEME 2: 赛博要塞机甲流
   ============================================================================ */
.layout-mecha {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 24px 36px 36px;
  gap: 24px;
  background: radial-gradient(circle at 50% 30%, #0d1527 0%, #030712 100%);
}
.mecha-towers-stage {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}
.mecha-fortress {
  flex: 1;
  background: rgba(15, 23, 42, 0.85);
  border: 3px solid #334155;
  border-radius: 28px;
  padding: 24px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.mecha-fortress.red-fortress { border-color: #f43f5e; box-shadow: 0 0 30px rgba(244, 63, 94, 0.2); }
.mecha-fortress.blue-fortress { border-color: #38bdf8; box-shadow: 0 0 30px rgba(56, 189, 248, 0.2); }
.fortress-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  margin-bottom: 16px;
}
.fortress-header strong { font-size: 24px; }
.fortress-hp-text { font-size: 16px; color: #94a3b8; font-weight: 800; }
.fortress-core-gauge {
  width: 140px;
  height: 240px;
  background: #020617;
  border: 3px solid #334155;
  border-radius: 20px;
  position: relative;
  display: flex;
  align-items: flex-end;
  overflow: hidden;
  margin-bottom: 20px;
}
.core-plasma-fill {
  width: 100%;
  transition: height 0.3s ease;
}
.core-plasma-fill.red { background: linear-gradient(0deg, #e11d48, #f43f5e); }
.core-plasma-fill.blue { background: linear-gradient(0deg, #0284c7, #38bdf8); }
.core-symbol {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 48px;
}
.fortress-cannon-btn {
  width: 100%;
  background: #1e293b;
  border: 2px solid #f43f5e;
  border-radius: 16px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 18px;
}
.fortress-cannon-btn.blue { border-color: #38bdf8; }
.fortress-cannon-btn b { color: #fbbf24; font-size: 20px; margin-top: 4px; }

.mecha-versus-reactor {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.reactor-pulse-ring {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: #020617;
  border: 3px solid #fbbf24;
  display: grid;
  place-items: center;
  box-shadow: 0 0 20px rgba(251, 191, 36, 0.6);
}
.reactor-vs { font-size: 24px; font-weight: 900; color: #fbbf24; }
.reactor-sub { font-size: 12px; color: #64748b; font-weight: 800; letter-spacing: 2px; }

.mecha-radar-stream {
  background: rgba(15, 23, 42, 0.75);
  border: 2px solid #334155;
  border-radius: 20px;
  padding: 16px 20px;
}
.radar-header {
  display: flex;
  justify-content: space-between;
  font-size: 16px;
  font-weight: 800;
  color: #38bdf8;
  margin-bottom: 12px;
}
.mecha-hits-list {
  display: flex;
  gap: 12px;
  overflow-x: auto;
}
.mecha-hit-chip {
  padding: 8px 14px;
  border-radius: 10px;
  background: #1e293b;
  border: 1px solid #475569;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  white-space: nowrap;
}
.mecha-hit-chip.red { border-color: #f43f5e; color: #fca5a5; }
.mecha-hit-chip.blue { border-color: #38bdf8; color: #bae6fd; }
.mecha-empty-radar { text-align: center; color: #64748b; font-size: 18px; padding: 8px; }

.mecha-commanders-grid {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  min-height: 0;
}
.mecha-card {
  background: rgba(15, 23, 42, 0.85);
  border: 2px solid #334155;
  border-radius: 24px;
  padding: 18px 24px;
  display: flex;
  flex-direction: column;
}
.mecha-card h3 { margin: 0 0 12px; font-size: 20px; }
.mecha-ranks { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
.mecha-row { display: flex; justify-content: space-between; padding: 8px 12px; background: #1e293b; border-radius: 8px; font-size: 16px; }

/* ============================================================================
   THEME 3: 像素街机格斗流
   ============================================================================ */
.layout-arcade-vs {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 24px 36px 36px;
  gap: 24px;
  background: #18181b;
}
.arcade-fighter-hud {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  background: #09090b;
  border: 3px solid #3f3f46;
  border-radius: 24px;
  padding: 20px 28px;
}
.arcade-hp-box { flex: 1; display: flex; flex-direction: column; gap: 8px; }
.fighter-tag { font-size: 20px; font-weight: 900; }
.red-hp .fighter-tag { color: #f43f5e; }
.blue-hp .fighter-tag { color: #38bdf8; text-align: right; }
.hp-bar-outer { width: 100%; height: 26px; background: #27272a; border: 2px solid #52525b; border-radius: 6px; overflow: hidden; }
.hp-bar-inner { height: 100%; transition: width 0.3s ease; }
.hp-bar-inner.red { background: #e11d48; }
.hp-bar-inner.blue { background: #0284c7; }
.hp-num { font-size: 24px; font-weight: 900; color: #fbbf24; }
.blue-hp .hp-num { text-align: right; }
.arcade-ko-clock { display: flex; flex-direction: column; align-items: center; }
.ko-badge { font-size: 32px; font-weight: 900; color: #ef4444; }
.ko-target { font-size: 16px; color: #a1a1aa; }

.arcade-punch-deck {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}
.arcade-stick-btn {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 24px 28px;
  border-radius: 24px;
  background: #09090b;
  border: 4px solid #3f3f46;
  box-shadow: 0 10px 0 rgba(0, 0, 0, 0.4);
}
.red-punch { border-color: #f43f5e; }
.blue-punch { border-color: #38bdf8; }
.punch-key {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 36px;
  font-weight: 900;
  color: #fff;
}
.red-punch .punch-key { background: #e11d48; }
.blue-punch .punch-key { background: #0284c7; }
.punch-label strong { display: block; font-size: 24px; }
.punch-label span { font-size: 16px; color: #a1a1aa; }

.arcade-hit-combos {
  background: #09090b;
  border: 2px dashed #3f3f46;
  border-radius: 20px;
  padding: 14px 20px;
  min-height: 70px;
  display: flex;
  align-items: center;
}
.combo-chips-grid { display: flex; gap: 12px; overflow-x: auto; width: 100%; }
.combo-chip {
  padding: 8px 14px;
  border-radius: 8px;
  background: #27272a;
  border: 1px solid #52525b;
  display: flex;
  gap: 8px;
  font-size: 16px;
  white-space: nowrap;
}
.combo-chip.red strong { color: #f43f5e; }
.combo-chip.blue strong { color: #38bdf8; }
.arcade-idle-msg { width: 100%; text-align: center; color: #71717a; font-size: 18px; }

.arcade-hall-fame {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  min-height: 0;
}
.hall-column {
  background: #09090b;
  border: 2px solid #3f3f46;
  border-radius: 20px;
  padding: 18px 24px;
  display: flex;
  flex-direction: column;
}
.hall-column h4 { margin: 0 0 12px; font-size: 20px; color: #fbbf24; }
.hall-row { display: flex; justify-content: space-between; padding: 8px 12px; background: #18181b; border-radius: 8px; font-size: 16px; margin-bottom: 6px; }

/* ============================================================================
   THEME 4: 巅峰角斗擂台流
   ============================================================================ */
.layout-colosseum {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 24px 36px 36px;
  gap: 24px;
  background: radial-gradient(circle at 50% 25%, #2a1b14 0%, #0a0604 100%);
}
.ring-top-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  background: rgba(254, 243, 199, 0.08);
  border: 3px solid #b45309;
  border-radius: 28px;
  padding: 20px 32px;
}
.corner-corner { display: flex; flex-direction: column; align-items: flex-start; }
.blue-corner { align-items: flex-end; }
.corner-glove { font-size: 36px; margin-bottom: 4px; }
.corner-corner strong { font-size: 22px; }
.corner-pts { font-size: 36px; color: #f59e0b; }
.ring-center-vs { display: flex; flex-direction: column; align-items: center; }
.vs-glow-shield { font-size: 32px; font-weight: 900; color: #f59e0b; text-shadow: 0 0 20px rgba(245, 158, 11, 0.8); }
.ring-center-vs small { font-size: 14px; color: #a1a1aa; }

.boxing-actions-deck {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}
.glove-card {
  background: rgba(255, 255, 255, 0.05);
  border: 3px solid #f43f5e;
  border-radius: 28px;
  padding: 32px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.blue-glove { border-color: #38bdf8; }
.glove-hero-key {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: #f43f5e;
  color: #fff;
  display: grid;
  place-items: center;
  font-size: 40px;
  font-weight: 900;
  margin-bottom: 12px;
}
.glove-hero-key.blue { background: #38bdf8; color: #020617; }
.glove-card h2 { margin: 0 0 8px; font-size: 26px; }
.glove-card p { margin: 0 0 10px; font-size: 18px; color: #e2e8f0; }
.glove-army { font-size: 16px; color: #94a3b8; }

.cheer-spark-lane {
  background: rgba(0, 0, 0, 0.4);
  border: 2px dashed #b45309;
  border-radius: 18px;
  padding: 14px 20px;
  min-height: 60px;
  display: flex;
  align-items: center;
}
.spark-chips-wrap { display: flex; gap: 12px; overflow-x: auto; width: 100%; }
.spark-chip {
  padding: 8px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  white-space: nowrap;
}
.spark-chip.red { border-color: #f43f5e; color: #fca5a5; }
.spark-chip.blue { border-color: #38bdf8; color: #bae6fd; }
.spark-empty { width: 100%; text-align: center; color: #a1a1aa; font-size: 18px; }

.champions-bottom-board {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  min-height: 0;
}
.champ-box {
  background: rgba(0, 0, 0, 0.5);
  border: 2px solid #b45309;
  border-radius: 20px;
  padding: 18px 24px;
  display: flex;
  flex-direction: column;
}
.champ-box h4 { margin: 0 0 12px; font-size: 20px; color: #fde047; }
.champ-row { display: flex; justify-content: space-between; padding: 8px 12px; background: rgba(255, 255, 255, 0.04); border-radius: 8px; font-size: 16px; margin-bottom: 6px; }

/* 胜利结语弹窗 */
.winner-modal-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(16px);
  display: grid;
  place-items: center;
  z-index: 200;
}
.winner-modal-box {
  background: #18181b;
  border-radius: 36px;
  padding: 48px 56px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  border: 6px solid #fbbf24;
  box-shadow: 0 0 80px rgba(251, 191, 36, 0.4);
}
.winner-trophy { font-size: 96px; margin-bottom: 16px; }
.winner-modal-box h1 { font-size: 48px; margin: 0 0 12px; }
.winner-modal-box p { font-size: 22px; color: #a1a1aa; margin: 0; }
</style>
