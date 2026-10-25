<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { liveState } from '@/stores/liveStore';
import { quizProgress, quizRuntimeSettings, quizState } from '@/game/quiz/quizStore';
import { getQuizRank, type QuizOption } from '@/game/quiz/quizRules';
import {
  normalizeQuizTheme,
  publishQuizTheme,
  quizThemes,
  readQuizTheme,
  subscribeQuizTheme,
  type QuizThemeId
} from '@/game/quiz/quizThemes';

const props = defineProps<{ outputOnly?: boolean }>();
const options: QuizOption[] = ['A', 'B', 'C', 'D'];

interface DisplayRankItem {
  id: string;
  rank: number;
  name: string;
  avatar: string;
  points: number;
  score: number;
  streak: number;
  lastDelta: number;
  title: string;
  isReal?: boolean;
}

interface DisplayAnswerItem {
  id: string;
  name: string;
  avatar: string;
  option: QuizOption;
  correct: boolean;
  delta: number;
  streak: number;
  tag: string;
}

function makeSvgAvatar(label: string, bgStart: string, bgEnd: string): string {
  const char = (label || '友').trim().slice(0, 1).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${bgStart}"/>
        <stop offset="100%" stop-color="${bgEnd}"/>
      </linearGradient>
    </defs>
    <rect width="96" height="96" rx="22" fill="url(#g)"/>
    <circle cx="48" cy="36" r="16" fill="rgba(255,255,255,0.22)"/>
    <path d="M20 84c4-16 16-24 28-24s24 8 28 24" fill="rgba(255,255,255,0.18)"/>
    <text x="48" y="58" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-weight="900" font-size="38">${char}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const palettePairs: Array<[string, string]> = [
  ['#f59e0b', '#d97706'],
  ['#10b981', '#059669'],
  ['#3b82f6', '#1d4ed8'],
  ['#ec4899', '#be185d'],
  ['#8b5cf6', '#6d28d9'],
  ['#06b6d4', '#0e7490'],
  ['#f43f5e', '#be123c'],
  ['#84cc16', '#4d7c0f']
];

function getAvatarForUser(name: string, avatar?: string, index = 0): string {
  if (avatar) return avatar;
  const pair = palettePairs[index % palettePairs.length];
  return makeSvgAvatar(name, pair[0], pair[1]);
}

const rankedPlayers = computed<DisplayRankItem[]>(() => {
  return Object.entries(quizState.players)
    .map(([id, player], idx) => ({
      id,
      rank: 0,
      name: player.name,
      avatar: getAvatarForUser(player.name, player.avatar, idx),
      points: player.points || player.score * 15,
      score: player.score,
      streak: player.streak || 0,
      lastDelta: player.lastDelta || 15,
      title: getQuizRank(player.score),
      isReal: true
    }))
    .sort((a, b) => b.points - a.points || b.score - a.score)
    .slice(0, 38)
    .map((item, idx) => ({
      ...item,
      rank: idx + 1
    }));
});

const topThree = computed(() => {
  const list = rankedPlayers.value.slice(0, 3);
  return {
    first: list[0],
    second: list[1],
    third: list[2]
  };
});

// Top 3 之外的 30 名选手 (5列 × 6行 = 30格，加上冠亚季共 33 人同屏展示)
const gridThirtyPlayers = computed(() => rankedPlayers.value.slice(3, 33));
// 手账主题 5列 × 6行 = 30 人同屏展示
const topThirtyPlayers = computed(() => rankedPlayers.value.slice(0, 30));

const answerStats = computed(() =>
  options.map(option => {
    const userIds = Object.keys(quizState.answers).filter(id => quizState.answers[id] === option);
    const total = Object.keys(quizState.answers).length;
    const percent = total ? Math.round((userIds.length / total) * 100) : 0;
    return {
      option,
      text: quizState.question.options[option],
      count: userIds.length,
      percent,
      names: userIds
        .slice(-3)
        .reverse()
        .map(id => quizState.players[id]?.name || '观众'),
      isCorrect: quizState.revealAnswer && option === quizState.question.answer,
      isWrong: quizState.revealAnswer && option !== quizState.question.answer,
      isEliminated: quizState.eliminatedOptions.includes(option)
    };
  })
);

const liveAnswerFeed = computed<DisplayAnswerItem[]>(() => {
  return quizState.recentAnswers.slice(0, 5).map((item, idx) => ({
    id: item.id,
    name: item.name,
    avatar: getAvatarForUser(item.name, item.avatar, idx),
    option: item.option,
    correct: item.correct,
    delta: item.delta || (item.correct ? 15 : 0),
    streak: item.streak || 1,
    tag: item.isFirstBlood ? '首答抢答' : item.correct ? `抢答连胜×${Math.max(1, item.streak)}` : '已作答'
  }));
});

const firstBloodBanner = computed(() => {
  if (quizState.assistMessage) {
    return quizState.assistMessage;
  }
  if (quizState.winner) {
    return `👑 @${quizState.winner.name} 送出${quizState.winner.giftName}直接通关夺魁！`;
  }
  if (quizState.firstBlood) {
    return `🎉 @${quizState.firstBlood.name} 首答抢答成功 +${quizState.firstBlood.delta}分`;
  }
  return '🎯 发送弹幕 A / B / C / D 参与本题抢答';
});

const activeGiftBanner = computed(() => {
  if (quizState.giftEffects.length) {
    const g = quizState.giftEffects[0];
    return {
      userName: g.userName,
      giftName: g.giftName,
      count: g.count,
      effectLabel: g.effectLabel,
      active: true
    };
  }
  return {
    userName: '礼物特权',
    giftName: '小心心 / 热气球',
    count: 1,
    effectLabel: '送小心心自动答对 · 送热气球直通榜首',
    active: false
  };
});

const nextLikeThreshold = computed(
  () =>
    quizRuntimeSettings.likeRules
      .filter(rule => rule.effect !== 'none' && rule.threshold > 0)
      .sort((a, b) => a.threshold - b.threshold)[0]?.threshold || 500
);

const currentLikes = computed(() => quizState.likes);
const likeProgress = computed(() =>
  currentLikes.value > 0
    ? Math.min(100, Math.max(5, ((currentLikes.value % nextLikeThreshold.value) / nextLikeThreshold.value) * 100))
    : 0
);

const displayTime = computed(() =>
  quizState.phase === 'idle' ? quizRuntimeSettings.answerTime : quizState.timeLeft
);
const theme = computed(() => normalizeQuizTheme(quizRuntimeSettings.theme));
const totalParticipantCount = computed(() => Object.keys(quizState.players).length);

function selectTheme(nextTheme: QuizThemeId) {
  quizRuntimeSettings.theme = nextTheme;
  publishQuizTheme(nextTheme);
}

let unsubscribeTheme = () => {};

onMounted(() => {
  const storedTheme = readQuizTheme();
  if (storedTheme) quizRuntimeSettings.theme = storedTheme;
  unsubscribeTheme = subscribeQuizTheme(value => {
    quizRuntimeSettings.theme = value;
  });
});
onBeforeUnmount(() => unsubscribeTheme());
</script>

<template>
  <main class="broadcast-canvas" :class="[`theme-${theme}`, { 'output-only': props.outputOnly }]">
    <!-- 控制台预览悬停快速切换主题浮层 -->
    <nav v-if="!props.outputOnly" class="preview-theme-switcher" aria-label="快速切换直播主题">
      <button
        v-for="item in quizThemes"
        :key="item.id"
        type="button"
        class="switcher-pill"
        :class="{ active: theme === item.id }"
        @click="selectTheme(item.id)"
      >
        {{ item.name }}
      </button>
    </nav>

    <!-- =========================================================================
         THEME 1: 森系荣耀擂台 (arena) - 同屏展示 33 名用户 (冠亚季 3 人 + 5×6 矩阵 30 人)
         ========================================================================= -->
    <div v-if="theme === 'arena'" class="layout-forest">
      <!-- 顶部紧凑状态栏 + 礼物能量条合一 -->
      <header class="forest-topbar">
        <div class="forest-top-left">
          <span class="forest-live-pill">● LIVE 🔊</span>
          <span class="forest-bank-tag">{{ quizRuntimeSettings.bank }} · {{ quizProgress }}</span>
        </div>
        <div class="forest-top-right">
          <span class="forest-gift-chip">🎁 {{ activeGiftBanner.userName }}：{{ activeGiftBanner.effectLabel }}</span>
          <span class="forest-like-chip">❤️ {{ currentLikes }}</span>
        </div>
      </header>

      <!-- 象牙白紧凑题卡 (内嵌题干 + 2×2选项) -->
      <section class="forest-ivory-card">
        <div class="ivory-card-head">
          <span class="ivory-topic-pill">
            <i class="topic-ring"></i>
            <span>{{ quizRuntimeSettings.bank }}</span>
          </span>
          <span class="ivory-first-tag">{{ firstBloodBanner }}</span>
          <div class="ivory-timer-pill" :class="{ urgent: displayTime <= 5 }">
            <span>⏱ 倒计时</span>
            <strong>{{ displayTime }}s</strong>
          </div>
        </div>

        <h1 class="ivory-question-title">{{ quizState.question.title }}</h1>

        <div class="ivory-options-grid">
          <div
            v-for="item in answerStats"
            :key="item.option"
            class="ivory-option-box"
            :class="{
              highlight: item.isCorrect || (!quizState.revealAnswer && item.percent >= 35),
              wrong: item.isWrong,
              eliminated: item.isEliminated
            }"
          >
            <div class="ivory-option-fill" :style="{ width: `${item.percent}%` }"></div>
            <div class="ivory-option-content">
              <span class="ivory-opt-letter">{{ item.option }}</span>
              <span class="ivory-opt-text">{{ item.text }}</span>
              <span v-if="item.isCorrect" class="ivory-opt-tag">✓ 正确</span>
              <span v-else-if="item.isEliminated" class="ivory-opt-tag elim">排除</span>
              <span v-else class="ivory-opt-pct">{{ item.count ? `${item.count}人·${item.percent}%` : `${item.percent}%` }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 5人极速抢答连击卡横排 -->
      <section v-if="liveAnswerFeed.length" class="forest-combo-strip">
        <div
          v-for="(ans, idx) in liveAnswerFeed"
          :key="ans.id"
          class="forest-combo-card"
          :class="{ scored: ans.correct, first: idx === 0 }"
        >
          <div class="combo-card-top">
            <img class="combo-avatar" :src="ans.avatar" alt="" />
            <span class="combo-delta" :class="{ zero: !ans.correct }">
              {{ ans.correct ? `+${ans.delta}` : ans.option }}
            </span>
          </div>
          <strong class="combo-name">{{ ans.name }}</strong>
          <span class="combo-tag">{{ ans.tag }}</span>
        </div>
      </section>
      <div v-else class="canvas-empty-answer-strip">
        <span>💬 暂无人作答 · 直播间发送弹幕 A / B / C / D 参与本题抢答</span>
      </div>

      <!-- 冠亚季军皇冠领奖台 + 5×6 高密度天梯网格 (仅展示真实参与观众) -->
      <template v-if="rankedPlayers.length">
        <section class="forest-podium-row">
          <div v-if="topThree.second" class="podium-card silver">
            <span class="podium-rank-num">2</span>
            <span class="podium-streak">🔥{{ topThree.second.streak }}</span>
            <div class="podium-avatar-wrap">
              <span class="crown-icon">👑</span>
              <img :src="topThree.second.avatar" alt="" />
            </div>
            <strong class="podium-name">{{ topThree.second.name }}</strong>
            <div class="podium-score">{{ topThree.second.points }}<small>分</small></div>
          </div>

          <div v-if="topThree.first" class="podium-card gold">
            <span class="podium-rank-num">1</span>
            <span class="podium-streak">🔥{{ topThree.first.streak }}</span>
            <div class="podium-avatar-wrap">
              <span class="crown-icon">👑</span>
              <img :src="topThree.first.avatar" alt="" />
            </div>
            <strong class="podium-name">{{ topThree.first.name }}</strong>
            <div class="podium-score">{{ topThree.first.points }}<small>分</small></div>
          </div>

          <div v-if="topThree.third" class="podium-card bronze">
            <span class="podium-rank-num">3</span>
            <span class="podium-streak">🔥{{ topThree.third.streak }}</span>
            <div class="podium-avatar-wrap">
              <span class="crown-icon">👑</span>
              <img :src="topThree.third.avatar" alt="" />
            </div>
            <strong class="podium-name">{{ topThree.third.name }}</strong>
            <div class="podium-score">{{ topThree.third.points }}<small>分</small></div>
          </div>
        </section>

        <section v-if="gridThirtyPlayers.length" class="forest-matrix-grid">
          <div v-for="player in gridThirtyPlayers" :key="player.id" class="matrix-cell">
            <div class="cell-head">
              <span class="cell-rank">{{ player.rank }}</span>
              <span class="cell-streak">🔥{{ player.streak }}</span>
            </div>
            <img class="cell-avatar" :src="player.avatar" alt="" />
            <span class="cell-name">{{ player.name }}</span>
            <strong class="cell-score">{{ player.points }}<small>分</small></strong>
          </div>
        </section>
      </template>
      <section v-else class="canvas-empty-leaderboard">
        <div class="empty-board-badge">🏆 实时积分榜</div>
        <strong>榜首虚位以待</strong>
        <p>在评论区发送 A / B / C / D 抢答正确，或送出礼物即可荣登榜单！</p>
      </section>
    </div>

    <!-- =========================================================================
         THEME 2: 手账方格闪词 (classroom) - 同屏展示 30 名用户 (5×6 紧凑白卡网格)
         ========================================================================= -->
    <div v-else-if="theme === 'classroom'" class="layout-notebook">
      <header class="nb-topbar">
        <div class="nb-brand">
          <span class="nb-live-badge">● LIVE</span>
          <strong class="nb-game-name">闪词大作战 · {{ quizRuntimeSettings.bank }}</strong>
        </div>
        <div class="nb-gift-ticker">
          <span>❤️ {{ currentLikes }} · 🎁 {{ activeGiftBanner.userName }}：{{ activeGiftBanner.effectLabel }}</span>
        </div>
      </header>

      <!-- 手账题面卡片 -->
      <section class="nb-question-card">
        <div class="nb-card-meta">
          <span class="nb-level-badge">Lv.6 {{ quizRuntimeSettings.bank.slice(0, 4) }}</span>
          <span class="nb-progress-text">第 {{ quizProgress }} 题</span>
          <div class="nb-timer-circle" :class="{ urgent: displayTime <= 5 }">
            <strong>{{ displayTime }}</strong>
          </div>
          <span class="nb-rule-hint">弹幕发 A / B / C / D 抢答得分...</span>
        </div>

        <h1 class="nb-question-title">
          <span class="nb-highlighter">{{ quizState.question.title }}</span>
        </h1>

        <div class="nb-options-grid">
          <div
            v-for="item in answerStats"
            :key="item.option"
            class="nb-option-item"
            :class="{
              correct: item.isCorrect,
              wrong: item.isWrong,
              eliminated: item.isEliminated
            }"
          >
            <span class="nb-opt-key">{{ item.option }}</span>
            <span class="nb-opt-val">{{ item.text }}</span>
            <span v-if="item.isCorrect" class="nb-opt-mark right">✓</span>
            <span v-else-if="item.isEliminated" class="nb-opt-mark wrong">✕</span>
            <span v-else class="nb-opt-pct">{{ item.count ? `${item.count}人(${item.percent}%)` : `${item.percent}%` }}</span>
          </div>
        </div>
      </section>

      <!-- 紧凑双列实时判卷流 + 悬浮首答抢答胶囊 -->
      <section class="nb-judge-stream">
        <div class="nb-floating-firstblood">
          <span>{{ firstBloodBanner }}</span>
        </div>

        <div v-if="liveAnswerFeed.length" class="nb-judge-rows">
          <div v-for="ans in liveAnswerFeed.slice(0, 4)" :key="ans.id" class="nb-judge-row">
            <div class="nb-row-user">
              <img :src="ans.avatar" alt="" />
              <strong>{{ ans.name }}</strong>
              <span class="nb-row-opt">{{ ans.option }}</span>
            </div>
            <span class="nb-row-mark" :class="ans.correct ? 'ok' : 'fail'">
              {{ ans.correct ? '✓' : '✗' }}
            </span>
          </div>
        </div>
        <div v-else class="canvas-empty-answer-strip light">
          <span>💬 暂无人作答 · 发送弹幕 A / B / C / D 参与本题抢答</span>
        </div>
      </section>

      <!-- 🏆 积分 TOP 30 高密度白卡方格榜 (仅展示真实参与观众) -->
      <section class="nb-leaderboard-card">
        <div class="nb-board-header">
          <span class="nb-board-title">🏆 积分 TOP 30</span>
          <span class="nb-board-meta">{{ totalParticipantCount }} 人在榜 · 弹幕抢答实时上榜</span>
        </div>

        <div v-if="topThirtyPlayers.length" class="nb-top30-grid">
          <div
            v-for="player in topThirtyPlayers"
            :key="player.id"
            class="nb-rank-cell"
            :class="{ podium: player.rank <= 3 }"
          >
            <span class="nb-cell-rank" :class="`r-${player.rank}`">{{ player.rank }}</span>
            <img class="nb-cell-avatar" :src="player.avatar" alt="" />
            <span class="nb-cell-name">{{ player.name }}</span>
            <strong class="nb-cell-points">{{ player.points }}</strong>
          </div>
        </div>
        <div v-else class="canvas-empty-leaderboard light">
          <div class="empty-board-badge">🏆 实时积分榜</div>
          <strong>榜首虚位以待</strong>
          <p>在评论区发送 A / B / C / D 抢答正确，或送出礼物即可荣登榜单！</p>
        </div>
      </section>
    </div>

    <!-- =========================================================================
         THEME 3: 赛博电音派对 (neon) - 同屏展示 33 名用户 (全息三强 + 5×6 霓虹矩阵)
         ========================================================================= -->
    <div v-else-if="theme === 'neon'" class="layout-cyber">
      <header class="cyber-hud-top">
        <div class="cyber-hud-left">
          <span class="cyber-live-tag">⚡ CYBER LIVE</span>
          <span class="cyber-room-tag">{{ quizRuntimeSettings.bank }} · R{{ quizProgress }}</span>
        </div>
        <div class="cyber-hud-right">
          <span class="cyber-energy-pill">🚀 {{ activeGiftBanner.userName }}：{{ activeGiftBanner.effectLabel }}</span>
          <span class="cyber-players-pill">❤️ {{ currentLikes }}</span>
        </div>
      </header>

      <!-- 全息核心题面舱 + 2×2 霓虹音轨选项 -->
      <section class="cyber-question-cockpit">
        <div class="cockpit-top-row">
          <div class="cockpit-kicker">
            <span class="neon-chip">NEON ARENA</span>
            <span class="neon-assist">{{ firstBloodBanner }}</span>
          </div>
          <div class="cockpit-timer-pill" :class="{ urgent: displayTime <= 5 }">
            <span>TIME</span>
            <strong>{{ displayTime }}s</strong>
          </div>
        </div>

        <h1 class="cockpit-title">{{ quizState.question.title }}</h1>

        <div class="cyber-tracks-grid">
          <div
            v-for="item in answerStats"
            :key="item.option"
            class="cyber-track-row"
            :class="[
              `opt-${item.option}`,
              { correct: item.isCorrect, wrong: item.isWrong, eliminated: item.isEliminated }
            ]"
          >
            <div class="track-neon-bar" :style="{ width: `${item.percent}%` }"></div>
            <div class="track-inner">
              <span class="track-key">{{ item.option }}</span>
              <span class="track-text">{{ item.text }}</span>
              <strong class="track-pct">{{ item.isCorrect ? '✓ 正解' : item.isEliminated ? '已排除' : item.count ? `${item.count}人(${item.percent}%)` : `${item.percent}%` }}</strong>
            </div>
          </div>
        </div>
      </section>

      <!-- 实时 5 人全息抢答脉冲带 -->
      <section v-if="liveAnswerFeed.length" class="cyber-avatars-strip">
        <div v-for="ans in liveAnswerFeed" :key="ans.id" class="reactor-user-pill" :class="{ hit: ans.correct }">
          <img :src="ans.avatar" alt="" />
          <div class="reactor-user-meta">
            <strong>{{ ans.name }}</strong>
            <small>{{ ans.tag }}</small>
          </div>
          <b>{{ ans.correct ? `+${ans.delta}` : ans.option }}</b>
        </div>
      </section>
      <div v-else class="canvas-empty-answer-strip">
        <span>💬 暂无人作答 · 直播间发送弹幕 A / B / C / D 参与本题抢答</span>
      </div>

      <!-- 赛博三强领奖台 + 5×6 霓虹战力矩阵 (仅展示真实参与观众) -->
      <template v-if="rankedPlayers.length">
        <section class="cyber-podium-row">
          <div v-if="topThree.second" class="cyber-podium-card top-2">
            <span class="cp-rank">#2</span>
            <img :src="topThree.second.avatar" alt="" />
            <div class="cp-info">
              <strong>{{ topThree.second.name }}</strong>
              <b>{{ topThree.second.points }} <small>PTS</small></b>
            </div>
          </div>
          <div v-if="topThree.first" class="cyber-podium-card top-1">
            <span class="cp-rank">👑 #1</span>
            <img :src="topThree.first.avatar" alt="" />
            <div class="cp-info">
              <strong>{{ topThree.first.name }}</strong>
              <b>{{ topThree.first.points }} <small>PTS</small></b>
            </div>
          </div>
          <div v-if="topThree.third" class="cyber-podium-card top-3">
            <span class="cp-rank">#3</span>
            <img :src="topThree.third.avatar" alt="" />
            <div class="cp-info">
              <strong>{{ topThree.third.name }}</strong>
              <b>{{ topThree.third.points }} <small>PTS</small></b>
            </div>
          </div>
        </section>

        <section v-if="gridThirtyPlayers.length" class="cyber-matrix-grid">
          <div v-for="player in gridThirtyPlayers" :key="player.id" class="cyber-cell">
            <div class="cyber-cell-head">
              <span class="cc-rank">#{{ player.rank }}</span>
              <span class="cc-streak">⚡{{ player.streak }}</span>
            </div>
            <img class="cc-avatar" :src="player.avatar" alt="" />
            <span class="cc-name">{{ player.name }}</span>
            <strong class="cc-pts">{{ player.points }}</strong>
          </div>
        </section>
      </template>
      <section v-else class="canvas-empty-leaderboard">
        <div class="empty-board-badge">⚡ 霓虹战力榜</div>
        <strong>榜首虚位以待</strong>
        <p>在评论区发送 A / B / C / D 抢答正确，或送出礼物即可荣登榜单！</p>
      </section>
    </div>

    <!-- =========================================================================
         THEME 4: 街机像素乱斗 (arcade) - 同屏展示 33 名用户 (三强街机卡 + 5×6 像素格)
         ========================================================================= -->
    <div v-else-if="theme === 'arcade'" class="layout-arcade">
      <header class="arcade-score-strip">
        <div class="arc-stat">
          <span>1UP · R{{ quizProgress }}</span>
          <strong>❤️ {{ currentLikes }}</strong>
        </div>
        <div class="arc-title-badge">🎁 {{ activeGiftBanner.userName }}：{{ activeGiftBanner.effectLabel }}</div>
        <div class="arc-stat right">
          <span>HI-SCORE</span>
          <strong>{{ topThree.first?.points || 0 }}</strong>
        </div>
      </header>

      <!-- 街机 CRT 屏幕题框 + 4色立体街机按键 -->
      <section class="arcade-crt-monitor">
        <div class="crt-top-row">
          <span class="crt-stage-chip">STAGE {{ quizState.questionIndex + 1 }}</span>
          <span class="crt-first-chip">{{ firstBloodBanner }}</span>
          <div class="crt-timer-box" :class="{ urgent: displayTime <= 5 }">
            TIME <b>{{ String(displayTime).padStart(2, '0') }}</b>
          </div>
        </div>

        <h1 class="crt-question-text">{{ quizState.question.title }}</h1>

        <div class="arcade-buttons-grid">
          <div
            v-for="item in answerStats"
            :key="item.option"
            class="arcade-push-btn"
            :class="[
              `btn-${item.option}`,
              { correct: item.isCorrect, wrong: item.isWrong, eliminated: item.isEliminated }
            ]"
          >
            <span class="arc-btn-key">{{ item.option }}</span>
            <div class="arc-btn-body">
              <strong>{{ item.text }}</strong>
              <small>{{ item.isEliminated ? '已排除' : item.count ? `${item.count}人 · ${item.percent}%` : `${item.percent}% 选择` }}</small>
            </div>
            <span v-if="item.isCorrect" class="arc-ko-stamp">WIN!</span>
          </div>
        </div>
      </section>

      <!-- 街机 5 连击横条 -->
      <section v-if="liveAnswerFeed.length" class="arc-hit-list">
        <div v-for="ans in liveAnswerFeed" :key="ans.id" class="arc-hit-chip" :class="{ hit: ans.correct }">
          <img :src="ans.avatar" alt="" />
          <div class="arc-hit-info">
            <strong>{{ ans.name }}</strong>
            <b>{{ ans.correct ? `HIT +${ans.delta}` : 'MISS' }}</b>
          </div>
        </div>
      </section>
      <div v-else class="canvas-empty-answer-strip">
        <span>💬 暂无人作答 · 直播间发送弹幕 A / B / C / D 参与本题抢答</span>
      </div>

      <!-- 街机三强 + 5×6 高分名人堂 (仅展示真实参与观众) -->
      <template v-if="rankedPlayers.length">
        <section class="arc-podium-trio">
          <div v-if="topThree.second" class="arc-champ-card place-2">
            <span class="arc-place-badge">🥈 2ND</span>
            <img :src="topThree.second.avatar" alt="" />
            <div class="arc-champ-meta">
              <strong>{{ topThree.second.name }}</strong>
              <b>{{ topThree.second.points }}</b>
            </div>
          </div>
          <div v-if="topThree.first" class="arc-champ-card place-1">
            <span class="arc-place-badge">🏆 1ST</span>
            <img :src="topThree.first.avatar" alt="" />
            <div class="arc-champ-meta">
              <strong>{{ topThree.first.name }}</strong>
              <b>{{ topThree.first.points }}</b>
            </div>
          </div>
          <div v-if="topThree.third" class="arc-champ-card place-3">
            <span class="arc-place-badge">🥉 3RD</span>
            <img :src="topThree.third.avatar" alt="" />
            <div class="arc-champ-meta">
              <strong>{{ topThree.third.name }}</strong>
              <b>{{ topThree.third.points }}</b>
            </div>
          </div>
        </section>

        <section v-if="gridThirtyPlayers.length" class="arc-challenger-grid">
          <div v-for="p in gridThirtyPlayers" :key="p.id" class="arc-challenger-cell">
            <div class="arc-c-head">
              <span class="arc-c-rank">#{{ p.rank }}</span>
              <span class="arc-c-streak">🔥{{ p.streak }}</span>
            </div>
            <img :src="p.avatar" alt="" />
            <span class="arc-c-name">{{ p.name }}</span>
            <b class="arc-c-score">{{ p.points }}</b>
          </div>
        </section>
      </template>
      <section v-else class="canvas-empty-leaderboard">
        <div class="empty-board-badge">🕹️ HIGH SCORES</div>
        <strong>榜首虚位以待</strong>
        <p>在评论区发送 A / B / C / D 抢答正确，或送出礼物即可荣登榜单！</p>
      </section>
    </div>

    <!-- =========================================================================
         THEME 5: 国潮金榜状元 (scroll) - 同屏展示 33 名用户 (状元榜眼探花 + 5×6 进士榜)
         ========================================================================= -->
    <div v-else class="layout-imperial">
      <header class="imp-plaque-bar">
        <span class="imp-cloud-tag">🏮 殿试 · ❤️ {{ currentLikes }}</span>
        <strong class="imp-main-plaque">金榜题名 · {{ quizRuntimeSettings.bank }}</strong>
        <span class="imp-round-tag">第{{ quizProgress }}题 · ⏱{{ displayTime }}s</span>
      </header>

      <!-- 宣纸圣旨卷轴题面 + 2×2 朱砂印章选项 -->
      <section class="imp-scroll-stage">
        <div class="scroll-roller top"></div>
        <div class="scroll-paper-body">
          <div class="scroll-paper-meta">
            <span class="imp-seal-mini">【御前殿试】</span>
            <span class="imp-first-report">{{ firstBloodBanner }}</span>
            <span class="imp-gift-mini">👑 {{ activeGiftBanner.userName }}：{{ activeGiftBanner.effectLabel }}</span>
          </div>

          <h1 class="imp-question-title">{{ quizState.question.title }}</h1>

          <div class="imp-options-grid">
            <div
              v-for="item in answerStats"
              :key="item.option"
              class="imp-option-tablet"
              :class="{
                correct: item.isCorrect,
                wrong: item.isWrong,
                eliminated: item.isEliminated
              }"
            >
              <span class="imp-seal-letter">{{ item.option }}</span>
              <span class="imp-opt-text">{{ item.text }}</span>
              <span v-if="item.isCorrect" class="imp-imperial-stamp">钦定正解</span>
              <span v-else-if="item.isEliminated" class="imp-imperial-stamp">已排除</span>
              <span v-else class="imp-opt-pct">{{ item.count ? `${item.count}人·${item.percent}%` : `${item.percent}%` }}</span>
            </div>
          </div>
        </div>
        <div class="scroll-roller bottom"></div>
      </section>

      <!-- 五人抢答捷报带 -->
      <section v-if="liveAnswerFeed.length" class="imp-answer-scroll-row">
        <div v-for="ans in liveAnswerFeed" :key="ans.id" class="imp-scholar-pill" :class="{ pass: ans.correct }">
          <img :src="ans.avatar" alt="" />
          <div class="imp-scholar-meta">
            <strong>{{ ans.name }}</strong>
            <b>{{ ans.correct ? `高中+${ans.delta}` : `选${ans.option}` }}</b>
          </div>
        </div>
      </section>
      <div v-else class="canvas-empty-answer-strip">
        <span>💬 暂无人作答 · 直播间发送弹幕 A / B / C / D 参与本题殿试抢答</span>
      </div>

      <!-- 状元 / 榜眼 / 探花 三甲牌匾 + 5×6 进士金榜网格 (仅展示真实参与观众) -->
      <template v-if="rankedPlayers.length">
        <section class="imp-trio-plaques">
          <div v-if="topThree.second" class="imp-trio-card second">
            <span class="imp-trio-title">🥈 榜眼</span>
            <img :src="topThree.second.avatar" alt="" />
            <div class="imp-trio-info">
              <strong>{{ topThree.second.name }}</strong>
              <b>{{ topThree.second.points }}分</b>
            </div>
          </div>

          <div v-if="topThree.first" class="imp-trio-card first">
            <span class="imp-trio-title">👑 状元</span>
            <img :src="topThree.first.avatar" alt="" />
            <div class="imp-trio-info">
              <strong>{{ topThree.first.name }}</strong>
              <b>{{ topThree.first.points }}分</b>
            </div>
          </div>

          <div v-if="topThree.third" class="imp-trio-card third">
            <span class="imp-trio-title">🥉 探花</span>
            <img :src="topThree.third.avatar" alt="" />
            <div class="imp-trio-info">
              <strong>{{ topThree.third.name }}</strong>
              <b>{{ topThree.third.points }}分</b>
            </div>
          </div>
        </section>

        <section v-if="gridThirtyPlayers.length" class="imp-jinshi-grid">
          <div v-for="p in gridThirtyPlayers" :key="p.id" class="imp-jinshi-cell">
            <div class="jinshi-cell-head">
              <span class="jinshi-rank">{{ p.rank }}名</span>
              <span class="jinshi-streak">🔥{{ p.streak }}</span>
            </div>
            <img :src="p.avatar" alt="" />
            <strong class="jinshi-name">{{ p.name }}</strong>
            <b class="jinshi-pts">{{ p.points }}<small>分</small></b>
          </div>
        </section>
      </template>
      <section v-else class="canvas-empty-leaderboard">
        <div class="empty-board-badge">🏮 皇榜金科</div>
        <strong>状元虚位以待</strong>
        <p>在评论区发送 A / B / C / D 抢答正确，或送出礼物即可金榜题名！</p>
      </section>
    </div>
  </main>
</template>

<style scoped>
/* ============================================================================
   1080 × 1920 竖屏移动端黄金比例画布 (高密度 30~33 人同屏榜单，零底部空白)
   ============================================================================ */
.broadcast-canvas {
  position: relative;
  width: 1080px;
  height: 1920px;
  box-sizing: border-box;
  overflow: hidden;
  user-select: none;
  font-family: 'Douyin Sans', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

.preview-theme-switcher {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 60;
  display: flex;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.88);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.18);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.broadcast-canvas:hover .preview-theme-switcher {
  opacity: 1;
}

.switcher-pill {
  padding: 5px 14px;
  border-radius: 999px;
  border: 0;
  background: transparent;
  color: #cbd5e1;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}

.switcher-pill.active {
  background: #10b981;
  color: #ffffff;
}

/* ============================================================================
   THEME 1: 森系荣耀擂台 (layout-forest)
   ============================================================================ */
.layout-forest {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 16px 22px 10px;
  background: radial-gradient(circle at 50% 15%, #1d3c37 0%, #132a26 55%, #0c1b18 100%);
  color: #f8fafc;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.forest-topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.forest-top-left,
.forest-top-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.forest-live-pill {
  padding: 4px 12px;
  border-radius: 999px;
  background: rgba(239, 68, 68, 0.24);
  border: 1px solid rgba(248, 113, 113, 0.45);
  color: #fca5a5;
  font-size: 17px;
  font-weight: 800;
}

.forest-bank-tag,
.forest-like-chip {
  padding: 4px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.14);
  font-size: 17px;
  font-weight: 700;
  color: #e2e8f0;
}

.forest-gift-chip {
  padding: 4px 12px;
  border-radius: 999px;
  background: rgba(180, 83, 9, 0.35);
  border: 1px solid rgba(251, 191, 36, 0.45);
  font-size: 16px;
  font-weight: 700;
  color: #fde68a;
  max-width: 460px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.forest-ivory-card {
  background: linear-gradient(180deg, #fafaf7 0%, #efefea 100%);
  border-radius: 24px;
  padding: 16px 22px 18px;
  color: #1e293b;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.3), inset 0 2px 0 #ffffff;
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex-shrink: 0;
}

.ivory-card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.ivory-topic-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 14px;
  border-radius: 999px;
  background: #3d634d;
  color: #ffffff;
  font-size: 17px;
  font-weight: 800;
}

.topic-ring {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2.5px solid #a7f3d0;
}

.ivory-first-tag {
  font-size: 17px;
  font-weight: 800;
  color: #047857;
  background: #d1fae5;
  padding: 4px 14px;
  border-radius: 999px;
}

.ivory-timer-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 14px;
  border-radius: 999px;
  background: #e2e8f0;
  color: #1e293b;
  font-size: 18px;
  font-weight: 800;
}

.ivory-timer-pill.urgent {
  background: #fee2e2;
  color: #dc2626;
}

.ivory-question-title {
  margin: 0;
  font-size: 40px;
  font-weight: 900;
  color: #1e293b;
  line-height: 1.2;
  text-align: center;
}

.ivory-options-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.ivory-option-box {
  position: relative;
  overflow: hidden;
  border-radius: 14px;
  background: #f8fafc;
  border: 2px solid #cbd5e1;
  padding: 12px 16px;
}

.ivory-option-fill {
  position: absolute;
  inset: 0 auto 0 0;
  background: rgba(148, 163, 184, 0.16);
}

.ivory-option-box.highlight {
  border-color: #b45309;
  background: #fef3c7;
}

.ivory-option-box.highlight .ivory-option-fill {
  background: linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%);
  opacity: 0.78;
}

.ivory-option-box.eliminated {
  opacity: 0.45;
  text-decoration: line-through;
}

.ivory-option-content {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 10px;
}

.ivory-opt-letter {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: #cbd5e1;
  color: #1e293b;
  display: grid;
  place-items: center;
  font-size: 20px;
  font-weight: 900;
  flex-shrink: 0;
}

.ivory-option-box.highlight .ivory-opt-letter {
  background: #b45309;
  color: #ffffff;
}

.ivory-opt-text {
  font-size: 23px;
  font-weight: 800;
  color: #1e293b;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ivory-opt-tag {
  padding: 2px 8px;
  border-radius: 6px;
  background: #15803d;
  color: #ffffff;
  font-size: 15px;
  font-weight: 800;
}

.ivory-opt-tag.elim {
  background: #dc2626;
}

.ivory-opt-pct {
  font-size: 16px;
  font-weight: 800;
  color: #475569;
  flex-shrink: 0;
}

/* 5人极速抢答连击卡 */
.forest-combo-strip {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  flex-shrink: 0;
}

.forest-combo-card {
  background: rgba(20, 48, 43, 0.9);
  border: 1.5px solid rgba(94, 234, 212, 0.22);
  border-radius: 14px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.forest-combo-card.scored {
  background: linear-gradient(160deg, #1d4d3e 0%, #15382e 100%);
  border-color: #34d399;
}

.forest-combo-card.first {
  border-color: #fbbf24;
}

.combo-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.combo-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  border: 1.5px solid rgba(255, 255, 255, 0.45);
}

.combo-delta {
  font-size: 20px;
  font-weight: 900;
  color: #fde047;
}

.combo-delta.zero {
  color: #94a3b8;
}

.combo-name {
  font-size: 16px;
  font-weight: 800;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.combo-tag {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(245, 158, 11, 0.24);
  color: #fcd34d;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 冠亚季军皇冠领奖台 (紧凑高度) */
.forest-podium-row {
  display: grid;
  grid-template-columns: 1fr 1.12fr 1fr;
  gap: 10px;
  align-items: stretch;
  flex-shrink: 0;
}

.podium-card {
  position: relative;
  border-radius: 16px;
  padding: 10px 12px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  border: 2px solid rgba(255, 255, 255, 0.22);
}

.podium-card.silver {
  background: linear-gradient(180deg, rgba(71, 117, 135, 0.78) 0%, rgba(36, 68, 82, 0.92) 100%);
  border-color: #93c5fd;
}

.podium-card.gold {
  background: linear-gradient(180deg, rgba(161, 128, 52, 0.88) 0%, rgba(92, 74, 28, 0.95) 100%);
  border-color: #fde047;
  box-shadow: 0 6px 20px rgba(250, 204, 21, 0.22);
}

.podium-card.bronze {
  background: linear-gradient(180deg, rgba(133, 88, 66, 0.82) 0%, rgba(79, 49, 36, 0.92) 100%);
  border-color: #fdba74;
}

.podium-rank-num {
  position: absolute;
  top: 6px;
  left: 12px;
  font-size: 22px;
  font-weight: 900;
  color: rgba(255, 255, 255, 0.92);
}

.podium-streak {
  position: absolute;
  top: 8px;
  right: 12px;
  font-size: 15px;
  font-weight: 800;
  color: #fde68a;
}

.podium-avatar-wrap {
  position: relative;
  margin-top: 4px;
}

.podium-avatar-wrap img {
  width: 62px;
  height: 62px;
  border-radius: 50%;
  object-fit: cover;
  border: 2.5px solid #ffffff;
}

.podium-card.gold .podium-avatar-wrap img {
  width: 68px;
  height: 68px;
  border-color: #fde047;
}

.crown-icon {
  position: absolute;
  top: -14px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 20px;
}

.podium-name {
  font-size: 19px;
  font-weight: 800;
  color: #ffffff;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.podium-score {
  font-size: 28px;
  font-weight: 900;
  color: #ffffff;
  line-height: 1;
}

.podium-card.gold .podium-score {
  color: #fef08a;
  font-size: 31px;
}

.podium-score small {
  font-size: 15px;
  margin-left: 2px;
}

/* 5×6 紧凑森林天梯矩阵 (30格满铺，格内紧凑无留白) */
.forest-matrix-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  grid-template-rows: repeat(6, 1fr);
  gap: 8px;
}

.matrix-cell {
  background: rgba(34, 72, 60, 0.78);
  border: 1.5px solid rgba(167, 243, 208, 0.24);
  border-radius: 12px;
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
}

.cell-head {
  width: 100%;
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  font-weight: 800;
  color: #cbd5e1;
  line-height: 1;
}

.cell-streak {
  color: #fde68a;
}

.cell-avatar {
  width: 58px;
  height: 58px;
  border-radius: 12px;
  object-fit: cover;
}

.cell-name {
  font-size: 17px;
  font-weight: 700;
  color: #f1f5f9;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.15;
}

.cell-score {
  font-size: 22px;
  font-weight: 900;
  color: #fef08a;
  line-height: 1.1;
}

.cell-score small {
  font-size: 13px;
}

/* ============================================================================
   THEME 2: 手账方格闪词 (layout-notebook)
   ============================================================================ */
.layout-notebook {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 16px 22px 10px;
  background-color: #f4f5ef;
  background-image:
    linear-gradient(to right, rgba(148, 163, 184, 0.16) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(148, 163, 184, 0.16) 1px, transparent 1px);
  background-size: 32px 32px;
  color: #1e293b;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.nb-topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.nb-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.nb-live-badge {
  padding: 4px 12px;
  border-radius: 8px;
  background: #dc2626;
  color: #ffffff;
  font-size: 17px;
  font-weight: 900;
}

.nb-game-name {
  font-size: 24px;
  font-weight: 900;
  color: #0f172a;
}

.nb-gift-ticker {
  padding: 5px 14px;
  border-radius: 999px;
  background: #fef3c7;
  border: 1.5px solid #f59e0b;
  color: #92400e;
  font-size: 16px;
  font-weight: 800;
}

.nb-question-card {
  background: rgba(255, 255, 255, 0.94);
  border: 2px solid #cbd5e1;
  border-radius: 20px;
  padding: 16px 22px;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.05);
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex-shrink: 0;
}

.nb-card-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.nb-level-badge {
  padding: 4px 12px;
  border-radius: 6px;
  background: #d9f99d;
  border: 1.5px solid #84cc16;
  color: #365314;
  font-size: 17px;
  font-weight: 900;
}

.nb-progress-text {
  font-size: 19px;
  font-weight: 800;
  color: #b91c1c;
}

.nb-timer-circle {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: 3.5px solid #1e293b;
  display: grid;
  place-items: center;
  font-size: 20px;
  font-weight: 900;
  color: #0f172a;
}

.nb-timer-circle.urgent {
  border-color: #dc2626;
  color: #dc2626;
}

.nb-rule-hint {
  margin-left: auto;
  font-size: 17px;
  color: #64748b;
  font-weight: 700;
}

.nb-question-title {
  margin: 0;
  font-size: 42px;
  font-weight: 900;
  color: #0f172a;
  line-height: 1.22;
}

.nb-highlighter {
  background: linear-gradient(180deg, transparent 58%, #d9f99d 58%, #bef264 94%, transparent 94%);
  padding: 0 6px;
}

.nb-options-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.nb-option-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 16px;
  border-radius: 12px;
  background: #ffffff;
  border: 1.5px solid #cbd5e1;
}

.nb-option-item.correct {
  background: #ecfccb;
  border-color: #65a30d;
}

.nb-option-item.eliminated {
  opacity: 0.4;
  text-decoration: line-through;
}

.nb-opt-key {
  width: 34px;
  height: 34px;
  border-radius: 7px;
  background: #1e293b;
  color: #ffffff;
  display: grid;
  place-items: center;
  font-size: 19px;
  font-weight: 900;
  flex-shrink: 0;
}

.nb-opt-val {
  font-size: 22px;
  font-weight: 800;
  color: #1e293b;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nb-opt-mark {
  font-size: 24px;
  font-weight: 900;
}

.nb-opt-mark.right {
  color: #16a34a;
}

.nb-opt-mark.wrong {
  color: #dc2626;
}

.nb-opt-pct {
  font-size: 16px;
  font-weight: 800;
  color: #64748b;
  flex-shrink: 0;
}

/* 紧凑双列实时判卷流 + 悬浮首答胶囊 */
.nb-judge-stream {
  position: relative;
  padding: 16px 16px 8px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.8);
  border: 1.5px dashed #cbd5e1;
  flex-shrink: 0;
}

.nb-floating-firstblood {
  position: absolute;
  top: -14px;
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 22px;
  border-radius: 999px;
  background: linear-gradient(90deg, #10b981 0%, #22c55e 100%);
  color: #ffffff;
  font-size: 18px;
  font-weight: 900;
  box-shadow: 0 6px 14px rgba(16, 185, 129, 0.3);
  white-space: nowrap;
}

.nb-judge-rows {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px 16px;
}

.nb-judge-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 8px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.18);
}

.nb-row-user {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.nb-row-user img {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
}

.nb-row-user strong {
  font-size: 18px;
  font-weight: 800;
  color: #1e293b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nb-row-opt {
  padding: 1px 8px;
  border-radius: 4px;
  background: #e2e8f0;
  color: #475569;
  font-size: 14px;
  font-weight: 700;
}

.nb-row-mark {
  font-size: 24px;
  font-weight: 900;
}

.nb-row-mark.ok {
  color: #16a34a;
}

.nb-row-mark.fail {
  color: #ef4444;
}

/* TOP 30 白卡方格榜 (5列×6行，满铺无底部空白) */
.nb-leaderboard-card {
  flex: 1;
  min-height: 0;
  background: rgba(255, 255, 255, 0.94);
  border: 2px solid #cbd5e1;
  border-radius: 20px;
  padding: 12px 14px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nb-board-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.nb-board-title {
  font-size: 22px;
  font-weight: 900;
  color: #0f172a;
}

.nb-board-meta {
  font-size: 17px;
  font-weight: 700;
  color: #475569;
}

.nb-top30-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  grid-template-rows: repeat(6, 1fr);
  gap: 8px;
}

.nb-rank-cell {
  position: relative;
  background: #f8fafc;
  border: 1.5px solid #e2e8f0;
  border-radius: 12px;
  padding: 6px 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
}

.nb-rank-cell.podium {
  background: #fefce8;
  border-color: #facc15;
}

.nb-cell-rank {
  position: absolute;
  top: 4px;
  right: 8px;
  font-size: 14px;
  font-weight: 800;
  color: #64748b;
}

.nb-cell-rank.r-1,
.nb-cell-rank.r-2,
.nb-cell-rank.r-3 {
  color: #b45309;
  font-weight: 900;
}

.nb-cell-avatar {
  width: 64px;
  height: 64px;
  border-radius: 12px;
  object-fit: cover;
}

.nb-cell-name {
  font-size: 17px;
  font-weight: 800;
  color: #334155;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.15;
}

.nb-cell-points {
  font-size: 24px;
  font-weight: 900;
  color: #0f172a;
  line-height: 1.05;
}

/* ============================================================================
   THEME 3: 赛博电音派对 (layout-cyber)
   ============================================================================ */
.layout-cyber {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 16px 22px 10px;
  background:
    radial-gradient(circle at 20% 15%, rgba(255, 42, 133, 0.28) 0%, transparent 45%),
    radial-gradient(circle at 80% 25%, rgba(0, 245, 212, 0.24) 0%, transparent 45%),
    linear-gradient(180deg, #0b0418 0%, #14072b 55%, #070210 100%);
  color: #f8fafc;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cyber-hud-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.cyber-hud-left,
.cyber-hud-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cyber-live-tag {
  padding: 4px 12px;
  border-radius: 6px;
  background: #ff2a85;
  color: #ffffff;
  font-size: 17px;
  font-weight: 900;
}

.cyber-room-tag,
.cyber-energy-pill,
.cyber-players-pill {
  padding: 4px 12px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(0, 245, 212, 0.35);
  color: #e2e8f0;
  font-size: 16px;
  font-weight: 800;
}

.cyber-question-cockpit {
  padding: 16px 22px;
  border-radius: 20px;
  background: rgba(19, 9, 43, 0.88);
  border: 2px solid #00f5d4;
  box-shadow: 0 0 24px rgba(0, 245, 212, 0.18);
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex-shrink: 0;
}

.cockpit-top-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.cockpit-kicker {
  display: flex;
  align-items: center;
  gap: 10px;
}

.neon-chip {
  padding: 3px 10px;
  border-radius: 6px;
  background: rgba(0, 245, 212, 0.2);
  color: #00f5d4;
  font-size: 15px;
  font-weight: 900;
}

.neon-assist {
  font-size: 17px;
  font-weight: 800;
  color: #fde047;
}

.cockpit-timer-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 14px;
  border-radius: 999px;
  border: 2px solid #00f5d4;
  color: #00f5d4;
  font-size: 18px;
  font-weight: 900;
}

.cockpit-timer-pill.urgent {
  border-color: #ff2a85;
  color: #ff2a85;
}

.cockpit-title {
  margin: 0;
  font-size: 38px;
  font-weight: 900;
  line-height: 1.2;
  color: #ffffff;
  text-align: center;
}

.cyber-tracks-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.cyber-track-row {
  position: relative;
  overflow: hidden;
  border-radius: 14px;
  background: rgba(30, 14, 62, 0.85);
  border: 1.5px solid rgba(255, 255, 255, 0.16);
  padding: 11px 16px;
}

.track-neon-bar {
  position: absolute;
  inset: 0 auto 0 0;
  background: linear-gradient(90deg, rgba(0, 245, 212, 0.32), rgba(255, 42, 133, 0.32));
}

.cyber-track-row.correct {
  border-color: #00f5d4;
  box-shadow: 0 0 18px rgba(0, 245, 212, 0.4);
}

.track-inner {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 12px;
}

.track-key {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: #00f5d4;
  color: #090418;
  display: grid;
  place-items: center;
  font-size: 20px;
  font-weight: 900;
  flex-shrink: 0;
}

.opt-B .track-key { background: #ff2a85; color: #ffffff; }
.opt-C .track-key { background: #facc15; color: #090418; }
.opt-D .track-key { background: #a855f7; color: #ffffff; }

.track-text {
  font-size: 22px;
  font-weight: 800;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track-pct {
  font-size: 19px;
  font-weight: 900;
  color: #00f5d4;
}

.cyber-avatars-strip {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  flex-shrink: 0;
}

.reactor-user-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 12px;
  background: rgba(25, 11, 52, 0.85);
  border: 1px solid rgba(0, 245, 212, 0.28);
}

.reactor-user-pill.hit {
  border-color: #00f5d4;
}

.reactor-user-pill img {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  flex-shrink: 0;
}

.reactor-user-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.reactor-user-meta strong {
  font-size: 15px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.reactor-user-meta small {
  font-size: 11px;
  color: #94a3b8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.reactor-user-pill b {
  font-size: 17px;
  color: #00f5d4;
}

/* 赛博三强 + 5×6 霓虹矩阵 */
.cyber-podium-row {
  display: grid;
  grid-template-columns: 1fr 1.12fr 1fr;
  gap: 10px;
  flex-shrink: 0;
}

.cyber-podium-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 16px;
  background: rgba(25, 12, 54, 0.9);
  border: 2px solid rgba(0, 245, 212, 0.45);
}

.cyber-podium-card.top-1 {
  border-color: #facc15;
  background: linear-gradient(135deg, rgba(250, 204, 21, 0.22), rgba(255, 42, 133, 0.22));
  box-shadow: 0 0 20px rgba(250, 204, 21, 0.25);
}

.cyber-podium-card.top-3 {
  border-color: #ff2a85;
}

.cp-rank {
  font-size: 20px;
  font-weight: 900;
  color: #facc15;
}

.cyber-podium-card img {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 2px solid #00f5d4;
  flex-shrink: 0;
}

.cp-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.cp-info strong {
  font-size: 19px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cp-info b {
  font-size: 25px;
  color: #00f5d4;
}

.cp-info b small {
  font-size: 13px;
}

.cyber-matrix-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  grid-template-rows: repeat(6, 1fr);
  gap: 8px;
}

.cyber-cell {
  background: rgba(20, 9, 44, 0.85);
  border: 1.5px solid rgba(168, 85, 247, 0.35);
  border-radius: 12px;
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
}

.cyber-cell-head {
  width: 100%;
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  font-weight: 800;
  color: #a855f7;
  line-height: 1;
}

.cc-streak {
  color: #00f5d4;
}

.cc-avatar {
  width: 58px;
  height: 58px;
  border-radius: 50%;
  border: 1.5px solid rgba(0, 245, 212, 0.5);
  object-fit: cover;
}

.cc-name {
  font-size: 17px;
  font-weight: 700;
  color: #f8fafc;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.15;
}

.cc-pts {
  font-size: 22px;
  font-weight: 900;
  color: #00f5d4;
  line-height: 1.1;
}

/* ============================================================================
   THEME 4: 街机像素乱斗 (layout-arcade)
   ============================================================================ */
.layout-arcade {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 16px 22px 10px;
  background: linear-gradient(180deg, #161936 0%, #0e1024 100%);
  color: #ffffff;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.arcade-score-strip {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 18px;
  border-radius: 14px;
  background: #1f244d;
  border: 3px solid #ffd60a;
  flex-shrink: 0;
}

.arc-stat {
  display: flex;
  align-items: center;
  gap: 10px;
}

.arc-stat span {
  font-size: 15px;
  font-weight: 900;
  color: #93c5fd;
}

.arc-stat strong {
  font-size: 22px;
  font-weight: 900;
  color: #ffd60a;
}

.arc-title-badge {
  font-size: 24px;
  font-weight: 900;
  color: #ffffff;
}

.arcade-crt-monitor {
  background: #1d2247;
  border: 4px solid #60a5fa;
  border-radius: 22px;
  padding: 16px 22px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex-shrink: 0;
}

.crt-top-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.crt-stage-chip {
  padding: 4px 12px;
  border-radius: 6px;
  background: #ff3b30;
  font-size: 17px;
  font-weight: 900;
}

.crt-first-chip {
  font-size: 17px;
  font-weight: 800;
  color: #fde047;
}

.crt-timer-box {
  padding: 4px 14px;
  border-radius: 8px;
  background: #090b1a;
  border: 2px solid #ffd60a;
  font-size: 19px;
  font-weight: 900;
  color: #ffd60a;
}

.crt-question-text {
  margin: 0;
  font-size: 38px;
  font-weight: 900;
  text-align: center;
  line-height: 1.22;
}

.arcade-buttons-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.arcade-push-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 14px;
  background: #283061;
  border: 3px solid #93c5fd;
}

.arcade-push-btn.correct {
  background: #14532d;
  border-color: #4ade80;
}

.arc-btn-key {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  font-size: 22px;
  font-weight: 900;
  color: #ffffff;
  background: #ff3b30;
  flex-shrink: 0;
}

.btn-B .arc-btn-key { background: #0a84ff; }
.btn-C .arc-btn-key { background: #30d158; }
.btn-D .arc-btn-key { background: #ff9f0a; }

.arc-btn-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.arc-btn-body strong {
  font-size: 21px;
  font-weight: 900;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.arc-btn-body small {
  font-size: 13px;
  color: #cbd5e1;
}

.arc-ko-stamp {
  padding: 4px 10px;
  border-radius: 6px;
  background: #ffd60a;
  color: #000000;
  font-size: 16px;
  font-weight: 900;
}

.arc-hit-list {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  flex-shrink: 0;
}

.arc-hit-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 12px;
  background: #1f244d;
  border: 2px solid #f59e0b;
}

.arc-hit-chip img {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  flex-shrink: 0;
}

.arc-hit-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.arc-hit-info strong {
  font-size: 15px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.arc-hit-info b {
  font-size: 14px;
  color: #4ade80;
}

.arc-podium-trio {
  display: grid;
  grid-template-columns: 1fr 1.12fr 1fr;
  gap: 10px;
  flex-shrink: 0;
}

.arc-champ-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 16px;
  background: #252b5c;
  border: 3px solid #94a3b8;
}

.arc-champ-card.place-1 {
  border-color: #ffd60a;
  background: #3b2f13;
}

.arc-place-badge {
  font-size: 17px;
  font-weight: 900;
  color: #ffd60a;
}

.arc-champ-card img {
  width: 54px;
  height: 54px;
  border-radius: 10px;
  flex-shrink: 0;
}

.arc-champ-meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.arc-champ-meta strong {
  font-size: 18px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.arc-champ-meta b {
  font-size: 24px;
  color: #ffd60a;
}

.arc-challenger-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  grid-template-rows: repeat(6, 1fr);
  gap: 8px;
}

.arc-challenger-cell {
  background: #1a1f42;
  border: 2px solid rgba(147, 197, 253, 0.32);
  border-radius: 12px;
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
}

.arc-c-head {
  width: 100%;
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  font-weight: 900;
  line-height: 1;
}

.arc-c-rank {
  color: #93c5fd;
}

.arc-c-streak {
  color: #fde68a;
}

.arc-challenger-cell img {
  width: 58px;
  height: 58px;
  border-radius: 10px;
  object-fit: cover;
}

.arc-c-name {
  font-size: 17px;
  font-weight: 700;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.15;
}

.arc-c-score {
  font-size: 22px;
  font-weight: 900;
  color: #ffd60a;
  line-height: 1.1;
}

/* ============================================================================
   THEME 5: 国潮金榜状元 (layout-imperial)
   ============================================================================ */
.layout-imperial {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 16px 22px 10px;
  background: radial-gradient(circle at 50% 15%, #5c1116 0%, #2b0709 60%, #140304 100%);
  color: #fef3c7;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.imp-plaque-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 20px;
  border-radius: 14px;
  background: linear-gradient(90deg, #3b0a0d 0%, #591116 50%, #3b0a0d 100%);
  border: 2px solid #e5b869;
  flex-shrink: 0;
}

.imp-cloud-tag,
.imp-round-tag {
  font-size: 17px;
  font-weight: 800;
  color: #fde68a;
}

.imp-main-plaque {
  font-size: 24px;
  font-weight: 900;
  color: #fde047;
  letter-spacing: 0.05em;
}

.imp-scroll-stage {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.scroll-roller {
  height: 10px;
  border-radius: 999px;
  background: linear-gradient(90deg, #78350f 0%, #f59e0b 50%, #78350f 100%);
}

.scroll-paper-body {
  margin: 0 10px;
  padding: 14px 20px;
  background: linear-gradient(180deg, #fcf5e5 0%, #f3e5c8 100%);
  border-left: 3px solid #d97706;
  border-right: 3px solid #d97706;
  color: #29150c;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.scroll-paper-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.imp-seal-mini {
  padding: 2px 10px;
  border-radius: 4px;
  background: #b91c1c;
  color: #ffffff;
  font-size: 16px;
  font-weight: 900;
}

.imp-first-report {
  font-size: 17px;
  font-weight: 800;
  color: #991b1b;
}

.imp-gift-mini {
  font-size: 15px;
  font-weight: 800;
  color: #92400e;
  max-width: 340px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.imp-question-title {
  margin: 0;
  font-size: 38px;
  font-weight: 900;
  text-align: center;
  color: #1c0d06;
  line-height: 1.22;
}

.imp-options-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.imp-option-tablet {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.76);
  border: 1.5px solid #d6b37c;
}

.imp-option-tablet.correct {
  background: #fef08a;
  border-color: #b91c1c;
}

.imp-seal-letter {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: #b91c1c;
  color: #fef3c7;
  display: grid;
  place-items: center;
  font-size: 19px;
  font-weight: 900;
  flex-shrink: 0;
}

.imp-opt-text {
  flex: 1;
  font-size: 22px;
  font-weight: 800;
  color: #29150c;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.imp-imperial-stamp {
  padding: 2px 8px;
  border: 1.5px solid #b91c1c;
  border-radius: 4px;
  color: #b91c1c;
  font-size: 15px;
  font-weight: 900;
}

.imp-opt-pct {
  font-size: 17px;
  font-weight: 800;
  color: #92400e;
}

.imp-answer-scroll-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  flex-shrink: 0;
}

.imp-scholar-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 12px;
  background: rgba(69, 10, 10, 0.85);
  border: 1.5px solid rgba(229, 184, 105, 0.45);
}

.imp-scholar-pill img {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  flex-shrink: 0;
}

.imp-scholar-meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.imp-scholar-meta strong {
  font-size: 15px;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.imp-scholar-meta b {
  font-size: 14px;
  color: #fde047;
}

/* 三甲牌匾 + 5×6 进士金榜 */
.imp-trio-plaques {
  display: grid;
  grid-template-columns: 1fr 1.12fr 1fr;
  gap: 10px;
  flex-shrink: 0;
}

.imp-trio-card {
  border-radius: 16px;
  padding: 10px 14px;
  background: linear-gradient(180deg, #4c0d12 0%, #2a0609 100%);
  border: 2px solid #d97706;
  display: flex;
  align-items: center;
  gap: 10px;
}

.imp-trio-card.first {
  background: linear-gradient(180deg, #7c1d1d 0%, #450a0a 100%);
  border-color: #fde047;
  box-shadow: 0 6px 20px rgba(250, 204, 21, 0.22);
}

.imp-trio-title {
  padding: 3px 10px;
  border-radius: 8px;
  background: rgba(253, 224, 71, 0.18);
  color: #fde047;
  font-size: 16px;
  font-weight: 900;
  white-space: nowrap;
}

.imp-trio-card img {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  border: 2px solid #fde047;
  flex-shrink: 0;
}

.imp-trio-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.imp-trio-info strong {
  font-size: 18px;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.imp-trio-info b {
  font-size: 24px;
  color: #fde047;
}

.imp-jinshi-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  grid-template-rows: repeat(6, 1fr);
  gap: 8px;
}

.imp-jinshi-cell {
  background: rgba(60, 10, 14, 0.82);
  border: 1.5px solid rgba(229, 184, 105, 0.38);
  border-radius: 12px;
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
}

.jinshi-cell-head {
  width: 100%;
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  font-weight: 900;
  line-height: 1;
}

.jinshi-rank {
  color: #fbbf24;
}

.jinshi-streak {
  color: #fde68a;
}

.imp-jinshi-cell img {
  width: 58px;
  height: 58px;
  border-radius: 50%;
  border: 1.5px solid #e5b869;
  object-fit: cover;
}

.jinshi-name {
  font-size: 17px;
  font-weight: 700;
  color: #ffffff;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.15;
}

.jinshi-pts {
  font-size: 22px;
  font-weight: 900;
  color: #fde047;
  line-height: 1.1;
}

.jinshi-pts small {
  font-size: 13px;
}

/* 零虚拟数据：无人作答与无人上榜时的真实空状态提示样式 */
.canvas-empty-answer-strip {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 26px 36px;
  border-radius: 22px;
  background: rgba(15, 23, 42, 0.48);
  border: 2px dashed rgba(255, 255, 255, 0.22);
  color: rgba(255, 255, 255, 0.85);
  font-size: 28px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.canvas-empty-answer-strip.light {
  background: rgba(255, 255, 255, 0.72);
  border-color: rgba(15, 23, 42, 0.18);
  color: #475569;
}

.canvas-empty-leaderboard {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 22px;
  padding: 60px 48px;
  border-radius: 28px;
  background: rgba(15, 23, 42, 0.45);
  border: 2px dashed rgba(255, 255, 255, 0.2);
  color: #f8fafc;
}

.canvas-empty-leaderboard.light {
  background: rgba(248, 250, 252, 0.9);
  border-color: rgba(15, 23, 42, 0.15);
  color: #1e293b;
}

.empty-board-badge {
  padding: 12px 32px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  font-size: 28px;
  font-weight: 800;
}

.canvas-empty-leaderboard.light .empty-board-badge {
  background: #e2e8f0;
  color: #334155;
}

.canvas-empty-leaderboard strong {
  font-size: 46px;
  font-weight: 900;
}

.canvas-empty-leaderboard p {
  margin: 0;
  max-width: 760px;
  font-size: 28px;
  line-height: 1.6;
  opacity: 0.8;
}
</style>
