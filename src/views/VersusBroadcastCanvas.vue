<script setup lang="ts">
import { computed } from 'vue';
import {
  versusState,
  versusRuntimeSettings,
  versusThemes,
  setVersusTheme,
  type VersusThemeId,
  type VersusOption
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

const displayQuestion = computed(() => {
  return versusState.question || {
    title: '太阳系中体积最大的行星是哪一颗？',
    options: { A: '地球', B: '木星', C: '火星', D: '金星' },
    answer: 'B' as VersusOption
  };
});

const likeGoal = computed(() => versusRuntimeSettings.likeThreshold || 300);
const likeProgressPct = computed(() => {
  return Math.min(100, Math.round(((versusState.totalLikes % likeGoal.value) / likeGoal.value) * 100));
});

function isEliminated(opt: VersusOption): boolean {
  return versusState.eliminatedOptions.includes(opt);
}

function isCorrectRevealed(opt: VersusOption): boolean {
  return versusState.phase === 'revealing' && opt === displayQuestion.value.answer;
}
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
      <div class="vs-guide-badge">⚔️ 答题阵营对抗</div>
      <div class="vs-guide-text">
        <span>发送 <b>{{ versusRuntimeSettings.redCommand }}</b> 入 {{ versusRuntimeSettings.redTeamName }}</span>
        <span class="sep">|</span>
        <span>发送 <b>{{ versusRuntimeSettings.blueCommand }}</b> 入 {{ versusRuntimeSettings.blueTeamName }}</span>
        <span class="sep">|</span>
        <span>发送 <b>A/B/C/D</b> 抢答拉分</span>
        <span class="sep">|</span>
        <span>送礼触发 <b>{{ versusRuntimeSettings.giftMultiplier }}倍暴击</b></span>
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
          <small>目标 {{ versusState.targetScore }} 分</small>
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
          <small>目标 {{ versusState.targetScore }} 分</small>
        </div>
      </section>

      <!-- 全员点赞助力能量条 -->
      <section class="versus-like-bar-container">
        <div class="like-meta-row">
          <span class="like-icon">💖</span>
          <span class="like-text">全员点赞助力：当前 <b>{{ versusState.totalLikes }}</b> 赞 / 满 {{ likeGoal }} 赞自动排除 1 个错项</span>
          <span v-if="versusState.eliminatedOptions.length" class="elim-count-tag">已排除 {{ versusState.eliminatedOptions.length }} 项</span>
        </div>
        <div class="like-track">
          <div class="like-progress" :style="{ width: `${likeProgressPct}%` }"></div>
        </div>
      </section>

      <!-- 中部战场大卡：答题对抗卡片 -->
      <section class="tug-quiz-stage">
        <div class="quiz-battle-card">
          <div class="quiz-card-head">
            <span class="phase-badge" :class="versusState.phase">
              {{ versusState.phase === 'answering' ? '抢答中' : (versusState.phase === 'revealing' ? '公布答案' : '等待出题') }}
            </span>
            <div class="timer-circle">
              <span class="time-sec">{{ versusState.timeLeft }}</span>
              <small>秒</small>
            </div>
            <span class="round-indicator">第 {{ versusState.questionIndex || 1 }} 题</span>
          </div>

          <h2 class="question-headline">{{ displayQuestion.title }}</h2>

          <div class="options-battle-grid">
            <div
              v-for="key in (['A', 'B', 'C', 'D'] as const)"
              :key="key"
              class="battle-option-item"
              :class="{
                eliminated: isEliminated(key),
                revealed: isCorrectRevealed(key)
              }"
            >
              <div class="opt-prefix">{{ key }}</div>
              <div class="opt-text">{{ displayQuestion.options[key] }}</div>
              <span v-if="isEliminated(key)" class="elim-badge">✕ 排除</span>
              <span v-else-if="isCorrectRevealed(key)" class="correct-badge">✓ 正确答案</span>
            </div>
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
              <span class="hit-action">{{ hit.choice }}</span>
              <b v-if="hit.pts > 0" class="hit-val">+{{ hit.pts }}分</b>
            </div>
          </div>
          <div v-else class="hit-empty-hint">
            <span>💥 发送 {{ versusRuntimeSettings.redCommand }} 进红队，发送 {{ versusRuntimeSettings.blueCommand }} 进蓝队，发送 A/B/C/D 抢答拉动拔河能量！</span>
          </div>
        </div>
      </section>

      <!-- 底部双阵营荣誉榜 -->
      <section class="tug-bottom-rosters">
        <div class="roster-board red">
          <div class="roster-header">
            <span>🔴 {{ versusRuntimeSettings.redTeamName }} 战将榜</span>
            <small>{{ redPlayers.length }} 人助攻</small>
          </div>
          <div v-if="redPlayers.length" class="roster-list">
            <div
              v-for="(p, idx) in redPlayers.slice(0, 6)"
              :key="p.id"
              class="roster-item"
              :class="{ mvp: idx === 0 }"
            >
              <span class="r-rank">{{ idx === 0 ? '👑 MVP' : `#${idx + 1}` }}</span>
              <span class="r-name">{{ p.name }}</span>
              <strong class="r-pts">{{ p.score }}分</strong>
            </div>
          </div>
          <div v-else class="roster-empty">虚位以待 · 扣 {{ versusRuntimeSettings.redCommand }} 入队抢答</div>
        </div>

        <div class="roster-board blue">
          <div class="roster-header">
            <span>🔵 {{ versusRuntimeSettings.blueTeamName }} 战将榜</span>
            <small>{{ bluePlayers.length }} 人助攻</small>
          </div>
          <div v-if="bluePlayers.length" class="roster-list">
            <div
              v-for="(p, idx) in bluePlayers.slice(0, 6)"
              :key="p.id"
              class="roster-item"
              :class="{ mvp: idx === 0 }"
            >
              <span class="r-rank">{{ idx === 0 ? '👑 MVP' : `#${idx + 1}` }}</span>
              <span class="r-name">{{ p.name }}</span>
              <strong class="r-pts">{{ p.score }}分</strong>
            </div>
          </div>
          <div v-else class="roster-empty">虚位以待 · 扣 {{ versusRuntimeSettings.blueCommand }} 入队抢答</div>
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
            <strong>{{ versusRuntimeSettings.redTeamName }}</strong>
            <span class="fortress-hp-text">{{ versusState.redScore }} / {{ versusState.targetScore }} HP</span>
          </div>
          <div class="fortress-core-gauge">
            <div class="core-plasma-fill red" :style="{ height: `${Math.min(100, (versusState.redScore / versusState.targetScore) * 100)}%` }"></div>
            <div class="core-symbol">🔴</div>
          </div>
          <div class="fortress-cannon-btn">
            <span>扣 [{{ versusRuntimeSettings.redCommand }}] 入队</span>
            <b>答对发射红光重炮</b>
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
            <strong>{{ versusRuntimeSettings.blueTeamName }}</strong>
            <span class="fortress-hp-text">{{ versusState.blueScore }} / {{ versusState.targetScore }} HP</span>
          </div>
          <div class="fortress-core-gauge">
            <div class="core-plasma-fill blue" :style="{ height: `${Math.min(100, (versusState.blueScore / versusState.targetScore) * 100)}%` }"></div>
            <div class="core-symbol">🔵</div>
          </div>
          <div class="fortress-cannon-btn blue">
            <span>扣 [{{ versusRuntimeSettings.blueCommand }}] 入队</span>
            <b>答对发射离子激光</b>
          </div>
        </div>
      </section>

      <!-- 机甲全员点赞助力能量槽 -->
      <section class="versus-like-bar-container mecha-like">
        <div class="like-meta-row">
          <span class="like-icon">⚡</span>
          <span class="like-text">机甲超载充能：{{ versusState.totalLikes }} / {{ likeGoal }} 赞破译 1 个错误选项</span>
          <span v-if="versusState.eliminatedOptions.length" class="elim-count-tag">已破译 {{ versusState.eliminatedOptions.length }} 项</span>
        </div>
        <div class="like-track">
          <div class="like-progress mecha" :style="{ width: `${likeProgressPct}%` }"></div>
        </div>
      </section>

      <!-- 机甲核心控制台：答题面板 -->
      <section class="mecha-quiz-terminal">
        <div class="mecha-terminal-head">
          <span class="terminal-tag">CYBER TERMINAL · 第 {{ versusState.questionIndex || 1 }} 题</span>
          <div class="mecha-timer-gauge">
            <span>倒计时：<b>{{ versusState.timeLeft }}</b>s</span>
          </div>
        </div>
        <h2 class="mecha-title">{{ displayQuestion.title }}</h2>

        <div class="options-battle-grid mecha-grid">
          <div
            v-for="key in (['A', 'B', 'C', 'D'] as const)"
            :key="key"
            class="battle-option-item mecha-opt"
            :class="{
              eliminated: isEliminated(key),
              revealed: isCorrectRevealed(key)
            }"
          >
            <div class="opt-prefix">{{ key }}</div>
            <div class="opt-text">{{ displayQuestion.options[key] }}</div>
            <span v-if="isEliminated(key)" class="elim-badge">✕ 排除</span>
            <span v-else-if="isCorrectRevealed(key)" class="correct-badge">✓ 破译成功</span>
          </div>
        </div>
      </section>

      <!-- 科技战况打击雷达流 -->
      <section class="mecha-radar-stream">
        <div class="radar-header">
          <span>📡 REALTIME TELEMETRY · 机甲弹幕武器击发监测</span>
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
            <span class="chip-action">{{ hit.choice }}</span>
            <b v-if="hit.pts > 0" class="chip-dmg">+{{ hit.pts }} 战力</b>
          </div>
        </div>
        <div v-else class="mecha-empty-radar">
          <span>等待发射指令：发送 A/B/C/D 破题为所在要塞主炮充能！</span>
        </div>
      </section>

      <!-- 机甲指挥官双列榜 -->
      <section class="mecha-commanders-grid">
        <div class="mecha-card red">
          <h3>🔴 {{ versusRuntimeSettings.redTeamName }} 旗舰榜</h3>
          <div v-if="redPlayers.length" class="mecha-ranks">
            <div v-for="(p, i) in redPlayers.slice(0, 5)" :key="p.id" class="mecha-row">
              <span>#{{ i + 1 }} {{ p.name }}</span>
              <b>{{ p.score }} 战力</b>
            </div>
          </div>
          <div v-else class="mecha-empty">虚位以待 · 扣 {{ versusRuntimeSettings.redCommand }} 登舰</div>
        </div>

        <div class="mecha-card blue">
          <h3>🔵 {{ versusRuntimeSettings.blueTeamName }} 旗舰榜</h3>
          <div v-if="bluePlayers.length" class="mecha-ranks">
            <div v-for="(p, i) in bluePlayers.slice(0, 5)" :key="p.id" class="mecha-row">
              <span>#{{ i + 1 }} {{ p.name }}</span>
              <b>{{ p.score }} 战力</b>
            </div>
          </div>
          <div v-else class="mecha-empty">虚位以待 · 扣 {{ versusRuntimeSettings.blueCommand }} 登舰</div>
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
          <strong class="ko-target">{{ versusState.timeLeft }}</strong>
        </div>

        <div class="arcade-hp-box blue-hp">
          <div class="fighter-tag">2P · {{ versusRuntimeSettings.blueTeamName }}</div>
          <div class="hp-bar-outer">
            <div class="hp-bar-inner blue" :style="{ width: `${Math.min(100, (versusState.blueScore / versusState.targetScore) * 100)}%` }"></div>
          </div>
          <span class="hp-num">{{ versusState.blueScore }} PTS</span>
        </div>
      </section>

      <!-- 街机全员点赞助力条 -->
      <section class="versus-like-bar-container arcade-like">
        <div class="like-meta-row">
          <span class="like-icon">💥</span>
          <span class="like-text">街机全员助威：{{ versusState.totalLikes }} / {{ likeGoal }} 赞排除 1 个错项</span>
          <span v-if="versusState.eliminatedOptions.length" class="elim-count-tag">已封锁 {{ versusState.eliminatedOptions.length }} 项</span>
        </div>
        <div class="like-track">
          <div class="like-progress arcade" :style="{ width: `${likeProgressPct}%` }"></div>
        </div>
      </section>

      <!-- 街机对决答题擂台 -->
      <section class="arcade-quiz-stage">
        <div class="arcade-stage-header">
          <span class="arcade-round-tag">ROUND {{ versusState.questionIndex || 1 }}</span>
          <span class="arcade-guide-text">扣 [{{ versusRuntimeSettings.redCommand }}] 入红队 · 扣 [{{ versusRuntimeSettings.blueCommand }}] 入蓝队 · 发送 A/B/C/D 猛击！</span>
        </div>

        <h2 class="arcade-question-title">{{ displayQuestion.title }}</h2>

        <div class="options-battle-grid arcade-grid">
          <div
            v-for="key in (['A', 'B', 'C', 'D'] as const)"
            :key="key"
            class="battle-option-item arcade-opt"
            :class="{
              eliminated: isEliminated(key),
              revealed: isCorrectRevealed(key)
            }"
          >
            <div class="opt-prefix">{{ key }}</div>
            <div class="opt-text">{{ displayQuestion.options[key] }}</div>
            <span v-if="isEliminated(key)" class="elim-badge">✕ 排除</span>
            <span v-else-if="isCorrectRevealed(key)" class="correct-badge">✓ K.O!</span>
          </div>
        </div>
      </section>

      <!-- 街机连击伤害弹幕 -->
      <section class="arcade-hit-combos">
        <div v-if="versusState.recentHits.length" class="combo-chips-grid">
          <div v-for="hit in versusState.recentHits" :key="hit.id" class="combo-chip" :class="hit.team">
            <span>{{ hit.name }}</span>
            <span class="combo-action">{{ hit.choice }}</span>
            <strong v-if="hit.pts > 0">HIT +{{ hit.pts }}</strong>
          </div>
        </div>
        <div v-else class="arcade-idle-msg">
          <span>🕹️ INSERT COIN / 弹幕输入 A/B/C/D 开始街机答题对决连击！</span>
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
          <strong>{{ versusRuntimeSettings.redTeamName }}</strong>
          <b class="corner-pts">{{ versusState.redScore }} 分</b>
        </div>

        <div class="ring-center-vs">
          <div class="vs-glow-shield">VS</div>
          <small>争夺拳王金腰带 · 目标 {{ versusState.targetScore }} 分</small>
        </div>

        <div class="corner-corner blue-corner">
          <span class="corner-glove blue">🥊</span>
          <strong>{{ versusRuntimeSettings.blueTeamName }}</strong>
          <b class="corner-pts">{{ versusState.blueScore }} 分</b>
        </div>
      </section>

      <!-- 角斗全员点赞助力条 -->
      <section class="versus-like-bar-container colosseum-like">
        <div class="like-meta-row">
          <span class="like-icon">🔥</span>
          <span class="like-text">全场欢呼助力：{{ versusState.totalLikes }} / {{ likeGoal }} 赞排除 1 个错项</span>
          <span v-if="versusState.eliminatedOptions.length" class="elim-count-tag">已封锁 {{ versusState.eliminatedOptions.length }} 项</span>
        </div>
        <div class="like-track">
          <div class="like-progress colosseum" :style="{ width: `${likeProgressPct}%` }"></div>
        </div>
      </section>

      <!-- 拳击擂台中央答题大卡 -->
      <section class="boxing-quiz-card">
        <div class="ring-card-head">
          <span class="round-badge">ROUND {{ versusState.questionIndex || 1 }}</span>
          <div class="timer-badge">⏱️ 倒计时 <b>{{ versusState.timeLeft }}</b> 秒</div>
        </div>

        <h2 class="ring-question-title">{{ displayQuestion.title }}</h2>

        <div class="options-battle-grid colosseum-grid">
          <div
            v-for="key in (['A', 'B', 'C', 'D'] as const)"
            :key="key"
            class="battle-option-item colosseum-opt"
            :class="{
              eliminated: isEliminated(key),
              revealed: isCorrectRevealed(key)
            }"
          >
            <div class="opt-prefix">{{ key }}</div>
            <div class="opt-text">{{ displayQuestion.options[key] }}</div>
            <span v-if="isEliminated(key)" class="elim-badge">✕ 排除</span>
            <span v-else-if="isCorrectRevealed(key)" class="correct-badge">✓ 重拳暴击</span>
          </div>
        </div>
      </section>

      <!-- 欢呼助威实时火花流 -->
      <section class="cheer-spark-lane">
        <div v-if="versusState.recentHits.length" class="spark-chips-wrap">
          <div v-for="hit in versusState.recentHits" :key="hit.id" class="spark-chip" :class="hit.team">
            <span class="spark-icon">⚡</span>
            <strong>{{ hit.name }}</strong>
            <span class="spark-action">{{ hit.choice }}</span>
            <b v-if="hit.pts > 0">+{{ hit.pts }}分</b>
          </div>
        </div>
        <div v-else class="spark-empty">
          <span>🥊 擂台铃声已敲响！发送 A/B/C/D 出拳抢答为角斗战队助威！</span>
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

/* 统一玩法攻略横幅 */
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
  flex-shrink: 0;
}
.vs-guide-badge {
  background: linear-gradient(135deg, #ef4444 0%, #3b82f6 100%);
  color: #ffffff;
  font-size: 16px;
  font-weight: 800;
  padding: 6px 14px;
  border-radius: 6px;
  letter-spacing: 0.05em;
}
.vs-guide-text {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 17px;
  color: #e4e4e7;
}
.vs-guide-text b {
  color: #fbbf24;
  font-size: 18px;
}
.vs-guide-text .sep {
  color: #52525b;
}

/* 全员点赞助力进度条 */
.versus-like-bar-container {
  margin: 16px 36px 0;
  padding: 14px 20px;
  background: rgba(24, 24, 27, 0.85);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
}
.like-meta-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.like-icon {
  font-size: 20px;
}
.like-text {
  font-size: 16px;
  color: #e4e4e7;
  flex: 1;
}
.like-text b {
  color: #f43f5e;
  font-size: 18px;
}
.elim-count-tag {
  font-size: 13px;
  font-weight: 700;
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.15);
  padding: 2px 10px;
  border-radius: 4px;
  border: 1px solid rgba(251, 191, 36, 0.3);
}
.like-track {
  width: 100%;
  height: 10px;
  background: #27272a;
  border-radius: 5px;
  overflow: hidden;
}
.like-progress {
  height: 100%;
  background: linear-gradient(90deg, #ec4899 0%, #f43f5e 100%);
  border-radius: 5px;
  transition: width 0.3s ease;
}
.like-progress.mecha {
  background: linear-gradient(90deg, #06b6d4 0%, #3b82f6 100%);
}
.like-progress.arcade {
  background: linear-gradient(90deg, #f59e0b 0%, #ef4444 100%);
}
.like-progress.colosseum {
  background: linear-gradient(90deg, #8b5cf6 0%, #ec4899 100%);
}

/* =========================================================================
   THEME 1: 能量拔河巨力流
   ========================================================================= */
.layout-tug {
  display: flex;
  flex-direction: column;
  height: calc(100% - 64px);
  padding: 20px 36px 36px;
  box-sizing: border-box;
  gap: 20px;
}

.tug-header-energy {
  display: grid;
  grid-template-columns: 220px 1fr 220px;
  align-items: center;
  gap: 16px;
  background: #18181b;
  padding: 20px 24px;
  border-radius: 16px;
  border: 1px solid #27272a;
  flex-shrink: 0;
}
.faction-score {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.faction-score.red {
  text-align: left;
}
.faction-score.blue {
  text-align: right;
}
.faction-title {
  font-size: 18px;
  font-weight: 700;
  color: #a1a1aa;
}
.faction-score.red .faction-title { color: #f87171; }
.faction-score.blue .faction-title { color: #60a5fa; }
.faction-num {
  font-size: 48px;
  font-weight: 900;
  line-height: 1;
}
.faction-score.red .faction-num { color: #ef4444; }
.faction-score.blue .faction-num { color: #3b82f6; }
.faction-score small {
  font-size: 13px;
  color: #71717a;
}

.versus-tug-track {
  position: relative;
  height: 44px;
  background: #27272a;
  border-radius: 22px;
  display: flex;
  overflow: hidden;
  border: 2px solid #3f3f46;
}
.tug-fill {
  height: 100%;
  display: flex;
  align-items: center;
  transition: width 0.3s ease;
}
.red-fill {
  background: linear-gradient(90deg, #dc2626 0%, #ef4444 100%);
  justify-content: flex-start;
  padding-left: 14px;
}
.blue-fill {
  background: linear-gradient(90deg, #3b82f6 0%, #2563eb 100%);
  justify-content: flex-end;
  padding-right: 14px;
}
.tug-pct-label {
  font-size: 15px;
  font-weight: 900;
  color: #ffffff;
}
.tug-vs-emblem {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: #18181b;
  border: 2px solid #fbbf24;
  color: #fbbf24;
  font-size: 14px;
  font-weight: 900;
  display: grid;
  place-items: center;
  box-shadow: 0 0 10px rgba(251, 191, 36, 0.4);
}

/* 核心对决题目卡片 */
.tug-quiz-stage {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
}

.quiz-battle-card {
  background: radial-gradient(circle at 50% 0%, #27272a 0%, #18181b 100%);
  border-radius: 20px;
  border: 2px solid rgba(255, 255, 255, 0.12);
  padding: 28px 32px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.5);
}

.quiz-card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.phase-badge {
  font-size: 14px;
  font-weight: 800;
  padding: 6px 14px;
  border-radius: 6px;
  background: #3f3f46;
  color: #e4e4e7;
}
.phase-badge.answering {
  background: #ef4444;
  color: #ffffff;
  box-shadow: 0 0 12px rgba(239, 68, 68, 0.5);
}
.phase-badge.revealing {
  background: #10b981;
  color: #ffffff;
  box-shadow: 0 0 12px rgba(16, 185, 129, 0.5);
}

.timer-circle {
  display: flex;
  align-items: baseline;
  gap: 4px;
  background: rgba(0, 0, 0, 0.5);
  padding: 6px 16px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}
.time-sec {
  font-size: 28px;
  font-weight: 900;
  color: #fbbf24;
}
.timer-circle small {
  font-size: 14px;
  color: #a1a1aa;
}
.round-indicator {
  font-size: 15px;
  color: #a1a1aa;
  font-weight: 700;
}

.question-headline {
  margin: 0;
  font-size: 32px;
  font-weight: 900;
  line-height: 1.4;
  color: #ffffff;
  text-align: center;
  padding: 8px 0;
}

.options-battle-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.battle-option-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16px;
  background: #27272a;
  border: 2px solid #3f3f46;
  border-radius: 14px;
  padding: 18px 20px;
  transition: all 0.2s ease;
}
.opt-prefix {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: #3f3f46;
  color: #ffffff;
  font-size: 20px;
  font-weight: 900;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.opt-text {
  font-size: 22px;
  font-weight: 700;
  color: #f4f4f5;
  flex: 1;
}

.battle-option-item.eliminated {
  opacity: 0.35;
  border-color: #ef4444;
  background: #271d1e;
  text-decoration: line-through;
}
.elim-badge {
  font-size: 13px;
  font-weight: 800;
  color: #ef4444;
  background: rgba(239, 68, 68, 0.2);
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid #ef4444;
}

.battle-option-item.revealed {
  background: rgba(16, 185, 129, 0.2);
  border-color: #10b981;
  box-shadow: 0 0 20px rgba(16, 185, 129, 0.4);
}
.battle-option-item.revealed .opt-prefix {
  background: #10b981;
}
.correct-badge {
  font-size: 14px;
  font-weight: 800;
  color: #10b981;
  background: rgba(16, 185, 129, 0.2);
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid #10b981;
}

/* 实时打击流 */
.versus-hit-stream {
  min-height: 52px;
  display: flex;
  align-items: center;
}
.hit-bubbles-row {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  width: 100%;
}
.hit-pop-bubble {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 999px;
  background: #18181b;
  border: 1px solid #3f3f46;
  font-size: 15px;
  white-space: nowrap;
}
.hit-pop-bubble.red {
  border-color: #ef4444;
  background: rgba(239, 68, 68, 0.15);
}
.hit-pop-bubble.blue {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.15);
}
.hit-team-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.hit-pop-bubble.red .hit-team-dot { background: #ef4444; }
.hit-pop-bubble.blue .hit-team-dot { background: #3b82f6; }
.hit-val {
  color: #fbbf24;
  font-weight: 800;
}
.hit-empty-hint {
  font-size: 15px;
  color: #71717a;
  text-align: center;
  width: 100%;
}

/* 底部双榜 */
.tug-bottom-rosters {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  height: 380px;
  flex-shrink: 0;
}
.roster-board {
  background: #18181b;
  border-radius: 16px;
  border: 1px solid #27272a;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
}
.roster-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 12px;
  border-bottom: 1px solid #27272a;
  font-size: 16px;
  font-weight: 800;
}
.roster-board.red .roster-header { color: #f87171; }
.roster-board.blue .roster-header { color: #60a5fa; }
.roster-header small {
  color: #71717a;
  font-size: 13px;
  font-weight: normal;
}
.roster-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
  overflow-y: auto;
}
.roster-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  background: #27272a;
  font-size: 15px;
}
.roster-item.mvp {
  background: rgba(251, 191, 36, 0.15);
  border: 1px solid rgba(251, 191, 36, 0.4);
}
.r-rank {
  font-weight: 800;
  color: #a1a1aa;
  width: 50px;
}
.roster-item.mvp .r-rank {
  color: #fbbf24;
}
.r-name {
  flex: 1;
  color: #f4f4f5;
  font-weight: 600;
}
.r-pts {
  color: #fbbf24;
  font-weight: 800;
}
.roster-empty {
  margin: auto;
  font-size: 14px;
  color: #52525b;
}

/* =========================================================================
   THEME 2: 赛博要塞机甲流
   ========================================================================= */
.layout-mecha {
  display: flex;
  flex-direction: column;
  height: calc(100% - 64px);
  padding: 20px 36px 36px;
  box-sizing: border-box;
  gap: 16px;
}
.mecha-towers-stage {
  display: grid;
  grid-template-columns: 1fr 140px 1fr;
  align-items: center;
  gap: 16px;
  background: #0f172a;
  border-radius: 16px;
  border: 1px solid #1e293b;
  padding: 16px 24px;
  flex-shrink: 0;
}
.mecha-fortress {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.fortress-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 800;
}
.fortress-header strong {
  flex: 1;
}
.fortress-hp-text {
  font-size: 14px;
  color: #38bdf8;
  font-family: monospace;
}
.fortress-core-gauge {
  height: 28px;
  background: #1e293b;
  border-radius: 6px;
  position: relative;
  overflow: hidden;
  border: 1px solid #334155;
}
.core-plasma-fill {
  height: 100%;
  transition: width 0.3s ease;
}
.core-plasma-fill.red {
  background: linear-gradient(90deg, #dc2626 0%, #ef4444 100%);
  width: 100%;
}
.core-plasma-fill.blue {
  background: linear-gradient(90deg, #0284c7 0%, #38bdf8 100%);
  width: 100%;
}
.core-symbol {
  position: absolute;
  top: 50%;
  left: 8px;
  transform: translateY(-50%);
  font-size: 14px;
}
.fortress-cannon-btn {
  font-size: 12px;
  color: #94a3b8;
  display: flex;
  justify-content: space-between;
}
.mecha-versus-reactor {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.reactor-pulse-ring {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #0284c7;
  display: grid;
  place-items: center;
  box-shadow: 0 0 16px rgba(2, 132, 199, 0.6);
}
.reactor-vs {
  font-size: 18px;
  font-weight: 900;
  color: #ffffff;
}
.reactor-sub {
  font-size: 10px;
  color: #38bdf8;
  letter-spacing: 0.1em;
}

.mecha-quiz-terminal {
  flex: 1;
  background: #0f172a;
  border-radius: 16px;
  border: 1px solid #1e293b;
  padding: 24px 28px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.mecha-terminal-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.terminal-tag {
  font-size: 13px;
  color: #38bdf8;
  font-family: monospace;
  letter-spacing: 0.08em;
}
.mecha-timer-gauge span {
  font-size: 15px;
  color: #94a3b8;
}
.mecha-timer-gauge b {
  font-size: 24px;
  color: #38bdf8;
}
.mecha-title {
  margin: 0;
  font-size: 28px;
  font-weight: 800;
  text-align: center;
  color: #f8fafc;
}

.mecha-opt {
  background: #1e293b;
  border-color: #334155;
}

.mecha-radar-stream {
  background: #0f172a;
  border-radius: 12px;
  padding: 12px 18px;
  border: 1px solid #1e293b;
  flex-shrink: 0;
}
.radar-header {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #64748b;
  margin-bottom: 8px;
}
.mecha-hits-list {
  display: flex;
  gap: 10px;
  overflow-x: auto;
}
.mecha-hit-chip {
  padding: 6px 12px;
  border-radius: 6px;
  background: #1e293b;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}
.mecha-hit-chip.red { border-left: 3px solid #ef4444; }
.mecha-hit-chip.blue { border-left: 3px solid #38bdf8; }
.chip-dmg { color: #38bdf8; }
.mecha-empty-radar { font-size: 13px; color: #64748b; text-align: center; }

.mecha-commanders-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  height: 280px;
  flex-shrink: 0;
}
.mecha-card {
  background: #0f172a;
  border-radius: 12px;
  border: 1px solid #1e293b;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
}
.mecha-card h3 {
  margin: 0 0 10px;
  font-size: 15px;
  font-weight: 800;
}
.mecha-card.red h3 { color: #f87171; }
.mecha-card.blue h3 { color: #38bdf8; }
.mecha-ranks {
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
}
.mecha-row {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  padding: 6px 10px;
  background: #1e293b;
  border-radius: 6px;
}
.mecha-row b { color: #38bdf8; }
.mecha-empty { margin: auto; font-size: 13px; color: #64748b; }

/* =========================================================================
   THEME 3: 像素街机格斗流
   ========================================================================= */
.layout-arcade-vs {
  display: flex;
  flex-direction: column;
  height: calc(100% - 64px);
  padding: 20px 36px 36px;
  box-sizing: border-box;
  gap: 16px;
}
.arcade-fighter-hud {
  display: grid;
  grid-template-columns: 1fr 120px 1fr;
  align-items: center;
  gap: 16px;
  background: #1c1917;
  border-radius: 14px;
  border: 2px solid #44403c;
  padding: 16px 20px;
  flex-shrink: 0;
}
.arcade-hp-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.blue-hp { text-align: right; }
.fighter-tag {
  font-size: 15px;
  font-weight: 900;
  color: #fbbf24;
}
.hp-bar-outer {
  height: 22px;
  background: #292524;
  border: 2px solid #78716c;
  border-radius: 4px;
  overflow: hidden;
}
.hp-bar-inner {
  height: 100%;
  transition: width 0.3s ease;
}
.hp-bar-inner.red {
  background: linear-gradient(90deg, #dc2626 0%, #f59e0b 100%);
}
.hp-bar-inner.blue {
  background: linear-gradient(90deg, #3b82f6 0%, #06b6d4 100%);
  float: right;
}
.hp-num {
  font-size: 13px;
  font-weight: 800;
  font-family: monospace;
  color: #a8a29e;
}
.arcade-ko-clock {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #292524;
  border: 2px solid #ef4444;
  border-radius: 8px;
  padding: 4px 8px;
}
.ko-badge {
  font-size: 12px;
  font-weight: 900;
  color: #ef4444;
}
.ko-target {
  font-size: 26px;
  font-weight: 900;
  color: #fbbf24;
  font-family: monospace;
}

.arcade-quiz-stage {
  flex: 1;
  background: #1c1917;
  border-radius: 16px;
  border: 2px solid #44403c;
  padding: 24px 28px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.arcade-stage-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.arcade-round-tag {
  font-size: 15px;
  font-weight: 900;
  color: #ef4444;
  background: rgba(239, 68, 68, 0.2);
  padding: 4px 10px;
  border-radius: 4px;
}
.arcade-guide-text {
  font-size: 13px;
  color: #fbbf24;
}
.arcade-question-title {
  margin: 0;
  font-size: 28px;
  font-weight: 900;
  color: #f5f5f4;
  text-align: center;
}
.arcade-opt {
  background: #292524;
  border-color: #57534e;
}

.arcade-hit-combos {
  background: #1c1917;
  border-radius: 10px;
  padding: 10px 16px;
  border: 1px solid #44403c;
  flex-shrink: 0;
}
.combo-chips-grid {
  display: flex;
  gap: 10px;
  overflow-x: auto;
}
.combo-chip {
  padding: 6px 12px;
  border-radius: 6px;
  background: #292524;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}
.combo-chip.red { border-left: 3px solid #ef4444; }
.combo-chip.blue { border-left: 3px solid #3b82f6; }
.combo-chip strong { color: #f59e0b; }
.arcade-idle-msg { font-size: 13px; color: #78716c; text-align: center; }

.arcade-hall-fame {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  height: 280px;
  flex-shrink: 0;
}
.hall-column {
  background: #1c1917;
  border-radius: 12px;
  border: 1px solid #44403c;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
}
.hall-column h4 {
  margin: 0 0 10px;
  font-size: 15px;
  font-weight: 900;
}
.hall-column.red h4 { color: #f87171; }
.hall-column.blue h4 { color: #60a5fa; }
.hall-row {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  padding: 6px 10px;
  background: #292524;
  border-radius: 6px;
  margin-bottom: 6px;
}
.hall-row b { color: #fbbf24; }

/* =========================================================================
   THEME 4: 巅峰角斗擂台流
   ========================================================================= */
.layout-colosseum {
  display: flex;
  flex-direction: column;
  height: calc(100% - 64px);
  padding: 20px 36px 36px;
  box-sizing: border-box;
  gap: 16px;
}
.ring-top-banner {
  display: grid;
  grid-template-columns: 1fr 140px 1fr;
  align-items: center;
  gap: 16px;
  background: #1e1b4b;
  border-radius: 16px;
  border: 1px solid #312e81;
  padding: 16px 20px;
  flex-shrink: 0;
}
.corner-corner {
  display: flex;
  align-items: center;
  gap: 10px;
}
.blue-corner {
  justify-content: flex-end;
}
.corner-glove {
  font-size: 24px;
}
.corner-pts {
  font-size: 22px;
  color: #fbbf24;
}
.ring-center-vs {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.vs-glow-shield {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #dc2626;
  color: #ffffff;
  display: grid;
  place-items: center;
  font-size: 18px;
  font-weight: 900;
  box-shadow: 0 0 16px rgba(220, 38, 38, 0.6);
}
.ring-center-vs small {
  font-size: 10px;
  color: #a5b4fc;
}

.boxing-quiz-card {
  flex: 1;
  background: #1e1b4b;
  border-radius: 16px;
  border: 1px solid #312e81;
  padding: 24px 28px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.ring-card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.round-badge {
  font-size: 14px;
  font-weight: 800;
  background: #4338ca;
  color: #ffffff;
  padding: 4px 10px;
  border-radius: 4px;
}
.timer-badge {
  font-size: 15px;
  color: #e0e7ff;
}
.timer-badge b {
  font-size: 22px;
  color: #fbbf24;
}
.ring-question-title {
  margin: 0;
  font-size: 28px;
  font-weight: 800;
  text-align: center;
  color: #ffffff;
}
.colosseum-opt {
  background: #312e81;
  border-color: #4338ca;
}

.cheer-spark-lane {
  background: #1e1b4b;
  border-radius: 10px;
  padding: 10px 16px;
  border: 1px solid #312e81;
  flex-shrink: 0;
}
.spark-chips-wrap {
  display: flex;
  gap: 10px;
  overflow-x: auto;
}
.spark-chip {
  padding: 6px 12px;
  border-radius: 6px;
  background: #312e81;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}
.spark-chip.red { border-left: 3px solid #ef4444; }
.spark-chip.blue { border-left: 3px solid #38bdf8; }
.spark-chip b { color: #fbbf24; }
.spark-empty { font-size: 13px; color: #a5b4fc; text-align: center; }

.champions-bottom-board {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  height: 280px;
  flex-shrink: 0;
}
.champ-box {
  background: #1e1b4b;
  border-radius: 12px;
  border: 1px solid #312e81;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
}
.champ-box h4 {
  margin: 0 0 10px;
  font-size: 15px;
  font-weight: 800;
}
.champ-box.red h4 { color: #f87171; }
.champ-box.blue h4 { color: #60a5fa; }
.champ-row {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  padding: 6px 10px;
  background: #312e81;
  border-radius: 6px;
  margin-bottom: 6px;
}
.champ-row b { color: #fbbf24; }

/* 获胜胜利弹窗 */
.winner-modal-overlay {
  position: absolute;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.85);
  display: grid;
  place-items: center;
  backdrop-filter: blur(8px);
}
.winner-modal-box {
  background: #18181b;
  border: 2px solid #fbbf24;
  border-radius: 24px;
  padding: 40px 60px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  box-shadow: 0 0 60px rgba(251, 191, 36, 0.4);
}
.winner-modal-box.red {
  border-color: #ef4444;
  box-shadow: 0 0 60px rgba(239, 68, 68, 0.4);
}
.winner-modal-box.blue {
  border-color: #3b82f6;
  box-shadow: 0 0 60px rgba(59, 130, 246, 0.4);
}
.winner-trophy {
  font-size: 72px;
}
.winner-modal-box h1 {
  margin: 0;
  font-size: 42px;
  font-weight: 900;
  color: #ffffff;
}
.winner-modal-box p {
  margin: 0;
  font-size: 18px;
  color: #a1a1aa;
}
</style>
