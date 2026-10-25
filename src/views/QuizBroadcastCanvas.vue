<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
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
    .slice(0, 50)
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

const scrollRestPlayers = computed(() => rankedPlayers.value.slice(3));

// 主题5: 底部抽屉折叠展开控制
const drawerOpen = ref(false);
function toggleDrawer() {
  drawerOpen.value = !drawerOpen.value;
}

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
  return quizState.recentAnswers.slice(0, 6).map((item, idx) => ({
    id: item.id,
    name: item.name,
    avatar: getAvatarForUser(item.name, item.avatar, idx),
    option: item.option,
    correct: item.correct,
    delta: item.delta || (item.correct ? 15 : 0),
    streak: item.streak || 1,
    tag: item.isFirstBlood ? '首答抢答' : item.correct ? `连胜×${Math.max(1, item.streak)}` : '已作答'
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
  return '🎯 弹幕发送 A / B / C / D 参与抢答';
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
    effectLabel: '送小心心免淘汰 · 送热气球直通榜首',
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
         THEME 1: 左右非对称竞技流 (arena)
         特点: 左65%主控答题区+爆发喷射弹窗 | 右35%独立纵向滚动榜(前三名固顶+第4名起滚动)
         ========================================================================= -->
    <div v-if="theme === 'arena'" class="layout-asymmetric">
      <!-- 统一显眼玩法指南横幅 -->
      <header class="theme-gameplay-guide">
        <div class="guide-badge">💡 玩法规则</div>
        <div class="guide-text">
          <span>弹幕发送 <b>A / B / C / D</b> 抢答得分</span>
          <span class="sep">|</span>
          <span>点赞累积满 <b>500</b> 排除错误项</span>
          <span class="sep">|</span>
          <span>送 <b>小心心</b> 触发免答特权</span>
        </div>
      </header>

      <div class="asym-body">
        <!-- 左侧 65% 主答题与互动喷射舞台 -->
        <section class="asym-left-stage">
          <!-- 题卡顶部状态 -->
          <div class="asym-stage-top">
            <div class="stage-tag-left">
              <span class="pulse-live">● LIVE</span>
              <span class="bank-pill">{{ quizRuntimeSettings.bank }} · 第 {{ quizProgress }} 题</span>
            </div>
            <div class="stage-timer-circle" :class="{ urgent: displayTime <= 5 }">
              <span class="timer-sec">{{ displayTime }}</span>
              <small>SEC</small>
            </div>
          </div>

          <!-- 核心大题干 -->
          <div class="asym-question-card">
            <h1 class="asym-question-text">{{ quizState.question.title }}</h1>
          </div>

          <!-- 4 个大号选项按键 (带瞬态热度) -->
          <div class="asym-options-grid">
            <div
              v-for="item in answerStats"
              :key="item.option"
              class="asym-opt-box"
              :class="[
                `opt-${item.option}`,
                { correct: item.isCorrect, wrong: item.isWrong, elim: item.isEliminated }
              ]"
            >
              <div class="opt-fill-bar" :style="{ width: `${item.percent}%` }"></div>
              <span class="opt-key-circle">{{ item.option }}</span>
              <span class="opt-label-text">{{ item.text }}</span>
              <span class="opt-stat-pct">{{ item.isCorrect ? '✓ 正确' : item.isEliminated ? '排除' : `${item.percent}%` }}</span>
            </div>
          </div>

          <!-- 答题爆发弹窗流 (当观众提交时瞬间向上喷射气泡) -->
          <div class="asym-burst-wrapper">
            <div class="burst-header">
              <span class="burst-title">⚡ 观众抢答实况</span>
              <span class="burst-note">{{ firstBloodBanner }}</span>
            </div>
            <div v-if="liveAnswerFeed.length" class="asym-burst-lane">
              <div
                v-for="(ans, idx) in liveAnswerFeed"
                :key="ans.id"
                class="asym-burst-pop"
                :class="{ right: ans.correct, lead: idx === 0 }"
              >
                <img :src="ans.avatar" class="burst-avatar" alt="" />
                <div class="burst-info">
                  <strong>{{ ans.name }}</strong>
                  <small>{{ ans.tag }}</small>
                </div>
                <div class="burst-choice" :class="{ ok: ans.correct }">
                  {{ ans.option }}
                </div>
              </div>
            </div>
            <div v-else class="asym-burst-empty">
              <span>💬 评论区发送 A / B / C / D，你的专属抢答弹窗将在此瞬间喷射！</span>
            </div>
          </div>

          <!-- 左侧底栏助力信息 -->
          <footer class="asym-left-footer">
            <div class="asym-gift-tip">🎁 {{ activeGiftBanner.userName }}：{{ activeGiftBanner.effectLabel }}</div>
            <div class="asym-like-tip">❤️ {{ currentLikes }} 点赞</div>
          </footer>
        </section>

        <!-- 右侧 35% 独立垂直排行榜 (前三名固顶，其余纵向滚动) -->
        <aside class="asym-right-sidebar">
          <div class="asym-rank-header">
            <span class="sidebar-title">🏆 实时积分榜</span>
            <span class="sidebar-count">{{ totalParticipantCount }}人在榜</span>
          </div>

          <div v-if="rankedPlayers.length" class="asym-rank-container">
            <!-- 常驻固定前三名 (Top 1 / 2 / 3 永不滚出视野) -->
            <div class="asym-fixed-top3">
              <div v-if="topThree.first" class="top3-fixed-card gold">
                <span class="badge-crown">👑 1</span>
                <img :src="topThree.first.avatar" class="top3-avatar" alt="" />
                <div class="top3-meta">
                  <strong>{{ topThree.first.name }}</strong>
                  <span class="pts">{{ topThree.first.points }} 分</span>
                </div>
              </div>
              <div v-if="topThree.second" class="top3-fixed-card silver">
                <span class="badge-crown">🥈 2</span>
                <img :src="topThree.second.avatar" class="top3-avatar" alt="" />
                <div class="top3-meta">
                  <strong>{{ topThree.second.name }}</strong>
                  <span class="pts">{{ topThree.second.points }} 分</span>
                </div>
              </div>
              <div v-if="topThree.third" class="top3-fixed-card bronze">
                <span class="badge-crown">🥉 3</span>
                <img :src="topThree.third.avatar" class="top3-avatar" alt="" />
                <div class="top3-meta">
                  <strong>{{ topThree.third.name }}</strong>
                  <span class="pts">{{ topThree.third.points }} 分</span>
                </div>
              </div>
            </div>

            <!-- 第 4~50 名平滑纵向无限滚动轨道 -->
            <div class="asym-scroll-section">
              <div class="scroll-ticker-track" :class="{ animate: scrollRestPlayers.length > 5 }">
                <div
                  v-for="p in scrollRestPlayers"
                  :key="p.id"
                  class="asym-ticker-item"
                >
                  <span class="ticker-rank">{{ p.rank }}</span>
                  <img :src="p.avatar" class="ticker-avatar" alt="" />
                  <span class="ticker-name">{{ p.name }}</span>
                  <strong class="ticker-pts">{{ p.points }}</strong>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="asym-rank-empty">
            <div class="empty-icon-trophy">🏆</div>
            <strong>榜首虚位以待</strong>
            <p>在评论区发送 A/B/C/D 抢答或送出礼物，即可立即荣登右侧榜首！</p>
          </div>
        </aside>
      </div>
    </div>

    <!-- =========================================================================
         THEME 2: 三段式手账闪词流 (classroom)
         特点: 顶部大题卡 | 中部实时判卷气泡瀑布 | 底部横向滑动画廊卡片榜
         ========================================================================= -->
    <div v-else-if="theme === 'classroom'" class="layout-notebook-tier">
      <!-- 统一显眼玩法指南横幅 -->
      <header class="theme-gameplay-guide light-guide">
        <div class="guide-badge">📖 答题攻略</div>
        <div class="guide-text">
          <span>直接在公屏打出 <b>A / B / C / D</b></span>
          <span class="sep">|</span>
          <span>系统极速识别判题</span>
          <span class="sep">|</span>
          <span>答对进入底部<b>拍立得学员画廊</b></span>
        </div>
      </header>

      <!-- 顶段 42% 居中沉浸手账白卡 -->
      <section class="nb-tier-top-card">
        <div class="nb-paper-head">
          <span class="nb-tag-round">第 {{ quizProgress }} 题 · {{ quizRuntimeSettings.bank }}</span>
          <div class="nb-time-clock" :class="{ urgent: displayTime <= 5 }">
            <span class="clock-icon">⏳</span>
            <strong>{{ displayTime }}s</strong>
          </div>
        </div>

        <h1 class="nb-card-title">
          <span class="nb-mark-pen">{{ quizState.question.title }}</span>
        </h1>

        <div class="nb-choices-2x2">
          <div
            v-for="item in answerStats"
            :key="item.option"
            class="nb-choice-cell"
            :class="{ ok: item.isCorrect, err: item.isWrong, elim: item.isEliminated }"
          >
            <span class="nb-choice-letter">{{ item.option }}</span>
            <span class="nb-choice-label">{{ item.text }}</span>
            <span v-if="item.isCorrect" class="nb-choice-mark green">✓ 正解</span>
            <span v-else-if="item.isEliminated" class="nb-choice-mark red">✕ 排除</span>
            <span v-else class="nb-choice-pct">{{ item.percent }}%</span>
          </div>
        </div>
      </section>

      <!-- 中段 24% 答题瞬时判卷气泡瀑布 (张三 选了 C ✓ 瞬间弹出) -->
      <section class="nb-tier-mid-waterfall">
        <div class="waterfall-title-strip">
          <span class="wf-badge">📝 即时卷面实况</span>
          <span class="wf-lead">{{ firstBloodBanner }}</span>
        </div>

        <div v-if="liveAnswerFeed.length" class="waterfall-bubble-grid">
          <div
            v-for="ans in liveAnswerFeed"
            :key="ans.id"
            class="wf-stamp-bubble"
            :class="{ pass: ans.correct }"
          >
            <img :src="ans.avatar" class="wf-avatar" alt="" />
            <div class="wf-info">
              <strong>{{ ans.name }}</strong>
              <small>{{ ans.tag }}</small>
            </div>
            <div class="wf-result-stamp">
              <span class="wf-choice-pill">选 {{ ans.option }}</span>
              <b class="wf-mark">{{ ans.correct ? '✓ 答对' : '✗ 答错' }}</b>
            </div>
          </div>
        </div>
        <div v-else class="waterfall-empty-box">
          <span>💬 发送选项 A / B / C / D，你的答题卷纸将在此瞬间“啪”地盖章弹出！</span>
        </div>
      </section>

      <!-- 底段 34% 横向滑动画廊榜 (Carousel 画廊卡片) -->
      <section class="nb-tier-bottom-gallery">
        <div class="gallery-title-bar">
          <div class="gallery-title">
            <span>🖼️ 学霸拍立得画廊</span>
            <small>横向滑动查看全部上榜席位</small>
          </div>
          <span class="gallery-counter">{{ totalParticipantCount }} 人入驻画廊</span>
        </div>

        <div v-if="rankedPlayers.length" class="gallery-cards-track">
          <div
            v-for="p in rankedPlayers"
            :key="p.id"
            class="gallery-polaroid-card"
            :class="{ champion: p.rank === 1, podium: p.rank <= 3 }"
          >
            <div class="polaroid-photo">
              <span class="polaroid-rank-badge">#{{ p.rank }}</span>
              <img :src="p.avatar" alt="" />
            </div>
            <div class="polaroid-footer">
              <strong class="polaroid-name">{{ p.name }}</strong>
              <span class="polaroid-score">{{ p.points }} 分</span>
            </div>
          </div>
        </div>
        <div v-else class="gallery-empty-state">
          <span class="empty-polaroid-icon">📷</span>
          <strong>画廊虚位以待</strong>
          <p>在评论区发送答案或点赞送礼，即可获得专属拍立得学霸卡并在底部轮播展出！</p>
        </div>
      </section>
    </div>

    <!-- =========================================================================
         THEME 3: 赛博中心辐射流 (neon)
         特点: 中央全息能量环与题卡 | 4个选项呈环抱辐射槽 | 底部扇形光柱战力台
         ========================================================================= -->
    <div v-else-if="theme === 'neon'" class="layout-radial-cyber">
      <!-- 统一显眼玩法指南横幅 -->
      <header class="theme-gameplay-guide cyber-guide">
        <div class="guide-badge">⚡ CYBER 规则</div>
        <div class="guide-text">
          <span>终端键入 <b>A / B / C / D</b> 为能量槽注入指令</span>
          <span class="sep">|</span>
          <span>点赞累积光子激活排除力场</span>
          <span class="sep">|</span>
          <span>登顶扇形战力塔</span>
        </div>
      </header>

      <!-- 上半部 60% 辐射式核心控制舱 -->
      <section class="cyber-radial-cockpit">
        <!-- 顶栏状态 -->
        <div class="cockpit-hud-bar">
          <span class="hud-status-blink">SYS: ONLINE · R{{ quizProgress }}</span>
          <span class="hud-center-bank">{{ quizRuntimeSettings.bank }}</span>
          <span class="hud-likes-chip">❤️ {{ currentLikes }} PHOTONS</span>
        </div>

        <!-- 辐射主舞台 (中央环形能量核心 + 选项四向环抱) -->
        <div class="radial-stage-container">
          <!-- 核心圆形舱 -->
          <div class="radial-center-core">
            <div class="core-countdown-ring">
              <svg class="ring-svg" viewBox="0 0 160 160">
                <circle cx="80" cy="80" r="70" class="ring-bg" />
                <circle cx="80" cy="80" r="70" class="ring-pulse" />
              </svg>
              <div class="core-time-number" :class="{ urgent: displayTime <= 5 }">
                <strong>{{ displayTime }}</strong>
                <small>SEC</small>
              </div>
            </div>
            <div class="core-question-display">
              <h1 class="core-q-title">{{ quizState.question.title }}</h1>
            </div>
          </div>

          <!-- 四向辐射按键通道 (左上A、右上B、左下C、右下D) -->
          <div class="radial-wings-grid">
            <div
              v-for="item in answerStats"
              :key="item.option"
              class="radial-wing-channel"
              :class="[
                `wing-${item.option}`,
                { correct: item.isCorrect, wrong: item.isWrong, elim: item.isEliminated }
              ]"
            >
              <div class="wing-fill-plasma" :style="{ height: `${item.percent}%` }"></div>
              <div class="wing-content">
                <span class="wing-letter">{{ item.option }}</span>
                <span class="wing-text">{{ item.text }}</span>
                <b class="wing-stat">{{ item.isCorrect ? '✓ 正解' : item.isEliminated ? 'OFF' : `${item.percent}%` }}</b>
              </div>
            </div>
          </div>
        </div>

        <!-- 全息粒子弹窗流 (观众答题瞬发能量脉冲) -->
        <div class="cyber-pulse-stream">
          <div v-if="liveAnswerFeed.length" class="pulse-capsules-row">
            <div
              v-for="ans in liveAnswerFeed.slice(0, 5)"
              :key="ans.id"
              class="pulse-user-pill"
              :class="{ beam: ans.correct }"
            >
              <img :src="ans.avatar" class="pill-avatar" alt="" />
              <span class="pill-name">{{ ans.name }}</span>
              <span class="pill-ch">注入 {{ ans.option }}</span>
              <b class="pill-hit">{{ ans.correct ? `+${ans.delta}` : 'MIS' }}</b>
            </div>
          </div>
          <div v-else class="pulse-empty-bar">
            <span>⚡ 指令待命：评论区发送 A / B / C / D，粒子流将瞬间充能对应能量槽</span>
          </div>
        </div>
      </section>

      <!-- 下半部 40% 扇形全息仪表战力台 (弧形高低柱体，前三名投影光柱居中拔高) -->
      <section class="cyber-fan-dashboard">
        <div class="fan-header">
          <span class="fan-title">🌐 扇形战力核心矩阵</span>
          <span class="fan-tip">{{ activeGiftBanner.userName }}：{{ activeGiftBanner.effectLabel }}</span>
        </div>

        <div v-if="rankedPlayers.length" class="fan-podium-stage">
          <!-- 扇形战力柱体群 (前三名拔高，其余弧形分布) -->
          <div class="fan-pillars-layout">
            <div
              v-for="p in rankedPlayers.slice(0, 11)"
              :key="p.id"
              class="fan-pillar-cell"
              :class="`rank-col-${p.rank}`"
            >
              <div class="pillar-avatar-holo">
                <span v-if="p.rank === 1" class="holo-crown">👑 #1</span>
                <span v-else class="holo-num">#{{ p.rank }}</span>
                <img :src="p.avatar" alt="" />
              </div>
              <div class="pillar-beam-bar" :style="{ height: `${Math.max(40, 200 - (p.rank - 1) * 16)}px` }"></div>
              <span class="pillar-name">{{ p.name }}</span>
              <strong class="pillar-pts">{{ p.points }}</strong>
            </div>
          </div>
        </div>

        <div v-else class="fan-empty-state">
          <span class="fan-radar-icon">📡</span>
          <strong>战力矩阵虚位以待</strong>
          <p>发送 A/B/C/D 抢答或送出热气球，全息光柱将拔地而起并为您投影战力指数！</p>
        </div>
      </section>
    </div>

    <!-- =========================================================================
         THEME 4: 街机四色名人堂流 (arcade)
         特点: 顶部通关星级 | 中央4色大按键(HIT暴击动效) | 底部像素高分名人堂
         ========================================================================= -->
    <div v-else-if="theme === 'arcade'" class="layout-arcade-hall">
      <!-- 统一显眼玩法指南横幅 -->
      <header class="theme-gameplay-guide arcade-guide">
        <div class="guide-badge">🕹️ 街机规则</div>
        <div class="guide-text">
          <span>公屏发送 <b>A / B / C / D</b> 敲击按键</span>
          <span class="sep">|</span>
          <span>极速答对触发 <b>HIT 暴击分数</b></span>
          <span class="sep">|</span>
          <span>登上底部<b>街机名人堂</b></span>
        </div>
      </header>

      <!-- 顶段 20% 街机通关积分条 -->
      <section class="arcade-stage-header">
        <div class="arcade-stage-meta">
          <span class="arcade-coin-tag">🪙 1UP · STAGE {{ quizState.questionIndex + 1 }}</span>
          <span class="arcade-bank-tag">{{ quizRuntimeSettings.bank }} · 第{{ quizProgress }}题</span>
        </div>
        <div class="arcade-timer-badge" :class="{ urgent: displayTime <= 5 }">
          <span>TIME</span>
          <strong>{{ displayTime }}</strong>
        </div>
      </section>

      <!-- 中段 45% 街机 4 色立体大按键 (HIT 暴击弹窗) -->
      <section class="arcade-crt-console">
        <h1 class="crt-question-heading">{{ quizState.question.title }}</h1>

        <div class="crt-buttons-4col">
          <div
            v-for="item in answerStats"
            :key="item.option"
            class="arcade-3d-btn"
            :class="[
              `btn-color-${item.option}`,
              { correct: item.isCorrect, wrong: item.isWrong, elim: item.isEliminated }
            ]"
          >
            <div class="btn-top-cap">
              <span class="btn-key">{{ item.option }}</span>
              <span class="btn-text">{{ item.text }}</span>
              <span class="btn-stat">{{ item.isCorrect ? 'WIN!' : item.isEliminated ? 'OUT' : `${item.percent}%` }}</span>
            </div>
          </div>
        </div>

        <!-- 击打连击瞬时暴击弹窗 -->
        <div class="crt-hit-combo-bar">
          <div v-if="liveAnswerFeed.length" class="hit-chips-list">
            <div
              v-for="ans in liveAnswerFeed.slice(0, 4)"
              :key="ans.id"
              class="hit-chip-pop"
              :class="{ critical: ans.correct }"
            >
              <img :src="ans.avatar" class="hit-av" alt="" />
              <div class="hit-info">
                <strong>{{ ans.name }}</strong>
                <small>{{ ans.tag }}</small>
              </div>
              <b class="hit-damage">{{ ans.correct ? `HIT +${ans.delta}` : `MISS ${ans.option}` }}</b>
            </div>
          </div>
          <div v-else class="hit-empty-text">
            <span>💥 敲击弹幕发送 A / B / C / D，按键下陷并产生 HIT 暴击伤害！</span>
          </div>
        </div>
      </section>

      <!-- 底段 35% 像素高分名人堂 (TOP 1/2/3 像素奖杯 + 其余高分网格) -->
      <section class="arcade-hall-fame-bottom">
        <div class="hall-header">
          <span class="hall-title">🏆 街机 HIGH SCORES 名人堂</span>
          <span class="hall-meta">{{ totalParticipantCount }} 位玩家在榜</span>
        </div>

        <div v-if="rankedPlayers.length" class="hall-players-grid">
          <div
            v-for="p in rankedPlayers.slice(0, 12)"
            :key="p.id"
            class="hall-cell"
            :class="{ top1: p.rank === 1, top3: p.rank <= 3 }"
          >
            <div class="hall-cell-head">
              <span class="hall-rank">{{ p.rank === 1 ? '👑 1ST' : p.rank === 2 ? '🥈 2ND' : p.rank === 3 ? '🥉 3RD' : `#${p.rank}` }}</span>
              <span class="hall-streak">🔥{{ p.streak }}</span>
            </div>
            <img :src="p.avatar" class="hall-avatar" alt="" />
            <span class="hall-name">{{ p.name }}</span>
            <strong class="hall-pts">{{ p.points }} <small>PTS</small></strong>
          </div>
        </div>
        <div v-else class="hall-empty-state">
          <div class="hall-empty-icon">🕹️</div>
          <strong>名人堂虚位以待</strong>
          <p>公屏发送 A/B/C/D 抢答得分，冲击今日最高分并载入名人堂！</p>
        </div>
      </section>
    </div>

    <!-- =========================================================================
         THEME 5: 全屏沉浸大舞台 + 底部悬浮折叠金榜抽屉 (scroll)
         特点: 75%全屏大舞台圣旨题面 | 弹幕穿梭悬浮气泡 | 底部可展开折叠抽屉金榜
         ========================================================================= -->
    <div v-else class="layout-immersive-scroll">
      <!-- 统一显眼玩法指南横幅 -->
      <header class="theme-gameplay-guide imperial-guide">
        <div class="guide-badge">🏮 殿试试题</div>
        <div class="guide-text">
          <span>公屏进言 <b>A / B / C / D</b> 应试夺魁</span>
          <span class="sep">|</span>
          <span>点赞积攒功名福泽</span>
          <span class="sep">|</span>
          <span>轻触或点击底部<b>金科皇榜抽屉</b>查阅榜单</span>
        </div>
      </header>

      <!-- 75% 沉浸全屏圣旨题卡大舞台 -->
      <section class="imperial-hero-scroll">
        <div class="imperial-plaque-top">
          <span class="plaque-tag">🏮 御前殿试 · 第 {{ quizProgress }} 题</span>
          <div class="plaque-timer" :class="{ urgent: displayTime <= 5 }">
            <span>⏱ 钦定时刻</span>
            <strong>{{ displayTime }}s</strong>
          </div>
        </div>

        <!-- 圣旨卷轴展开题干 -->
        <div class="scroll-canvas-body">
          <div class="scroll-seal-mark">【殿试】</div>
          <h1 class="scroll-hero-title">{{ quizState.question.title }}</h1>
        </div>

        <!-- 四柱御批印章大按键 -->
        <div class="scroll-tablets-grid">
          <div
            v-for="item in answerStats"
            :key="item.option"
            class="imperial-tablet-btn"
            :class="{ ok: item.isCorrect, err: item.isWrong, elim: item.isEliminated }"
          >
            <span class="tablet-seal">{{ item.option }}</span>
            <span class="tablet-text">{{ item.text }}</span>
            <b class="tablet-state">{{ item.isCorrect ? '钦定正解' : item.isEliminated ? '黜退' : `${item.percent}%` }}</b>
          </div>
        </div>

        <!-- 悬浮弹幕飞掠答题气泡 (观众作答穿梭在卷轴之下) -->
        <div class="scroll-danmaku-stream">
          <div v-if="liveAnswerFeed.length" class="danmaku-fly-lane">
            <div
              v-for="ans in liveAnswerFeed"
              :key="ans.id"
              class="danmaku-scholar-tag"
              :class="{ pass: ans.correct }"
            >
              <img :src="ans.avatar" alt="" />
              <span>{{ ans.name }}</span>
              <b>选 {{ ans.option }}</b>
              <small>{{ ans.correct ? '高中' : '惜败' }}</small>
            </div>
          </div>
          <div v-else class="danmaku-empty-hint">
            <span>🏮 发送 A / B / C / D，您的进言将化作金色捷报在卷轴上穿梭！</span>
          </div>
        </div>
      </section>

      <!-- 底部悬浮抽屉式折叠金榜 (平时为精美浮动条，点击可滑动展开全宽金榜) -->
      <section class="imperial-bottom-drawer" :class="{ expanded: drawerOpen }">
        <!-- 抽屉头部触发开关条 -->
        <div class="drawer-trigger-bar" @click="toggleDrawer">
          <div class="drawer-left">
            <span class="drawer-badge">📜 金科皇榜</span>
            <span class="drawer-summary">
              {{ topThree.first ? `状元: ${topThree.first.name} (${topThree.first.points}分)` : '状元虚位以待' }}
            </span>
          </div>
          <div class="drawer-right">
            <span>{{ drawerOpen ? '▼ 收起金榜' : '▲ 展开查阅全榜' }}</span>
            <small>{{ totalParticipantCount }} 人在册</small>
          </div>
        </div>

        <!-- 抽屉展开内容：状元/榜眼/探花三甲金匾 + 进士列榜 -->
        <div class="drawer-content-body">
          <div v-if="rankedPlayers.length" class="drawer-palace-board">
            <div class="drawer-trio-plaques">
              <div v-if="topThree.second" class="drawer-card second">
                <span>🥈 榜眼</span>
                <img :src="topThree.second.avatar" alt="" />
                <strong>{{ topThree.second.name }}</strong>
                <b>{{ topThree.second.points }}分</b>
              </div>
              <div v-if="topThree.first" class="drawer-card first">
                <span>👑 状元</span>
                <img :src="topThree.first.avatar" alt="" />
                <strong>{{ topThree.first.name }}</strong>
                <b>{{ topThree.first.points }}分</b>
              </div>
              <div v-if="topThree.third" class="drawer-card third">
                <span>🥉 探花</span>
                <img :src="topThree.third.avatar" alt="" />
                <strong>{{ topThree.third.name }}</strong>
                <b>{{ topThree.third.points }}分</b>
              </div>
            </div>

            <div v-if="scrollRestPlayers.length" class="drawer-jinshi-scroll">
              <div
                v-for="p in scrollRestPlayers.slice(0, 20)"
                :key="p.id"
                class="drawer-jinshi-row"
              >
                <span class="j-rank">第{{ p.rank }}名</span>
                <img :src="p.avatar" alt="" />
                <span class="j-name">{{ p.name }}</span>
                <strong class="j-pts">{{ p.points }}分</strong>
              </div>
            </div>
          </div>
          <div v-else class="drawer-empty-state">
            <strong>状元榜眼探花虚位以待</strong>
            <p>公屏发送答案抢答或点赞送礼，即可位列金科皇榜！</p>
          </div>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
/* ============================================================================
   1080 × 1920 竖屏移动端黄金比例画布
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

/* 顶部悬浮切换胶囊 */
.preview-theme-switcher {
  position: absolute;
  top: 14px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  display: flex;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.9);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  opacity: 0;
  transition: opacity 0.2s ease;
}
.broadcast-canvas:hover .preview-theme-switcher {
  opacity: 1;
}
.switcher-pill {
  padding: 6px 14px;
  border-radius: 999px;
  border: 0;
  background: transparent;
  color: #cbd5e1;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}
.switcher-pill.active {
  background: #10b981;
  color: #ffffff;
}

/* 统一显眼玩法指南横幅 (置顶、不挡题、指引明确) */
.theme-gameplay-guide {
  width: 100%;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 0 32px;
  box-sizing: border-box;
  background: rgba(15, 23, 42, 0.75);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  color: #ffffff;
  z-index: 20;
}
.guide-badge {
  padding: 6px 16px;
  border-radius: 999px;
  background: #10b981;
  color: #ffffff;
  font-size: 20px;
  font-weight: 800;
  letter-spacing: 0.05em;
  white-space: nowrap;
}
.guide-text {
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 22px;
  font-weight: 600;
  color: #e2e8f0;
  white-space: nowrap;
}
.guide-text b {
  color: #fbbf24;
}
.guide-text .sep {
  color: rgba(255, 255, 255, 0.3);
}

.theme-gameplay-guide.light-guide {
  background: rgba(255, 255, 255, 0.92);
  border-bottom: 2px solid #e2e8f0;
  color: #1e293b;
}
.theme-gameplay-guide.light-guide .guide-badge {
  background: #0284c7;
}
.theme-gameplay-guide.light-guide .guide-text {
  color: #334155;
}
.theme-gameplay-guide.light-guide .guide-text b {
  color: #0284c7;
}

.theme-gameplay-guide.cyber-guide {
  background: rgba(10, 10, 26, 0.9);
  border-bottom: 2px solid #06b6d4;
}
.theme-gameplay-guide.cyber-guide .guide-badge {
  background: #06b6d4;
  color: #020617;
}
.theme-gameplay-guide.cyber-guide .guide-text b {
  color: #38bdf8;
}

.theme-gameplay-guide.arcade-guide {
  background: #18181b;
  border-bottom: 3px solid #e11d48;
}
.theme-gameplay-guide.arcade-guide .guide-badge {
  background: #e11d48;
}
.theme-gameplay-guide.arcade-guide .guide-text b {
  color: #f43f5e;
}

.theme-gameplay-guide.imperial-guide {
  background: #2b110a;
  border-bottom: 2px solid #b45309;
}
.theme-gameplay-guide.imperial-guide .guide-badge {
  background: #b45309;
}
.theme-gameplay-guide.imperial-guide .guide-text b {
  color: #fde047;
}

/* ============================================================================
   THEME 1: 左右非对称竞技流 (layout-asymmetric)
   左65%主交互区 + 右35%独立垂直滚动排行榜
   ============================================================================ */
.layout-asymmetric {
  width: 1080px;
  height: 1920px;
  background: radial-gradient(circle at 30% 20%, #1e3a34 0%, #091a16 60%, #030a08 100%);
  color: #ffffff;
  display: flex;
  flex-direction: column;
}
.asym-body {
  flex: 1;
  display: flex;
  min-height: 0;
  padding: 24px 28px 28px;
  gap: 24px;
  box-sizing: border-box;
}

/* 左侧 65% 主舞台 */
.asym-left-stage {
  flex: 0 0 648px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 0;
}
.asym-stage-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.stage-tag-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.pulse-live {
  background: rgba(16, 185, 129, 0.2);
  color: #34d399;
  border: 1px solid #10b981;
  padding: 6px 16px;
  border-radius: 999px;
  font-size: 20px;
  font-weight: 800;
}
.bank-pill {
  font-size: 24px;
  color: #cbd5e1;
  font-weight: 700;
}
.stage-timer-circle {
  width: 90px;
  height: 90px;
  border-radius: 50%;
  background: #112822;
  border: 4px solid #10b981;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  box-shadow: 0 0 20px rgba(16, 185, 129, 0.4);
}
.stage-timer-circle.urgent {
  border-color: #ef4444;
  color: #f87171;
  animation: pulse-border 1s infinite;
}
.timer-sec {
  font-size: 38px;
  font-weight: 900;
  line-height: 1;
}
.stage-timer-circle small {
  font-size: 14px;
  opacity: 0.7;
}

.asym-question-card {
  background: rgba(255, 255, 255, 0.06);
  border: 2px solid rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(12px);
  border-radius: 24px;
  padding: 32px 36px;
  min-height: 180px;
  display: flex;
  align-items: center;
}
.asym-question-text {
  margin: 0;
  font-size: 40px;
  font-weight: 800;
  line-height: 1.45;
  color: #f8fafc;
}

.asym-options-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.asym-opt-box {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 22px 24px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.08);
  border: 2px solid rgba(255, 255, 255, 0.16);
}
.asym-opt-box.correct {
  border-color: #10b981;
  background: rgba(16, 185, 129, 0.25);
}
.asym-opt-box.wrong {
  border-color: #ef4444;
  opacity: 0.6;
}
.asym-opt-box.elim {
  opacity: 0.3;
  text-decoration: line-through;
}
.opt-fill-bar {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  background: rgba(16, 185, 129, 0.3);
  z-index: 1;
  transition: width 0.3s ease;
}
.opt-key-circle {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: #10b981;
  display: grid;
  place-items: center;
  font-size: 28px;
  font-weight: 900;
  color: #ffffff;
  z-index: 2;
  flex-shrink: 0;
}
.opt-label-text {
  flex: 1;
  font-size: 28px;
  font-weight: 700;
  color: #f8fafc;
  z-index: 2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.opt-stat-pct {
  font-size: 24px;
  font-weight: 800;
  color: #34d399;
  z-index: 2;
}

/* 答题爆发弹窗流 */
.asym-burst-wrapper {
  flex: 1;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 24px;
  border: 2px dashed rgba(255, 255, 255, 0.15);
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.burst-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
.burst-title {
  font-size: 24px;
  font-weight: 800;
  color: #10b981;
}
.burst-note {
  font-size: 20px;
  color: #94a3b8;
}
.asym-burst-lane {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 14px;
}
.asym-burst-pop {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 18px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.14);
  animation: burstUp 0.35s cubic-bezier(0.18, 1, 0.3, 1);
}
@keyframes burstUp {
  0% { transform: translateY(20px) scale(0.9); opacity: 0; }
  100% { transform: translateY(0) scale(1); opacity: 1; }
}
.asym-burst-pop.right {
  background: rgba(16, 185, 129, 0.18);
  border-color: rgba(16, 185, 129, 0.4);
}
.burst-avatar {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  object-fit: cover;
}
.burst-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.burst-info strong {
  font-size: 24px;
  color: #ffffff;
}
.burst-info small {
  font-size: 18px;
  color: #94a3b8;
}
.burst-choice {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: #334155;
  color: #ffffff;
  display: grid;
  place-items: center;
  font-size: 26px;
  font-weight: 900;
}
.burst-choice.ok {
  background: #10b981;
}
.asym-burst-empty {
  flex: 1;
  display: grid;
  place-items: center;
  text-align: center;
  padding: 30px;
  color: #94a3b8;
  font-size: 24px;
  line-height: 1.6;
}
.asym-left-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 10px;
  font-size: 22px;
  color: #cbd5e1;
}

/* 右侧 35% 独立垂直排行榜 */
.asym-right-sidebar {
  flex: 1;
  background: rgba(15, 23, 42, 0.7);
  border: 2px solid rgba(255, 255, 255, 0.15);
  border-radius: 28px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  box-sizing: border-box;
}
.asym-rank-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 16px;
  border-bottom: 2px solid rgba(255, 255, 255, 0.1);
}
.sidebar-title {
  font-size: 28px;
  font-weight: 900;
  color: #f8fafc;
}
.sidebar-count {
  font-size: 20px;
  color: #10b981;
  font-weight: 700;
}
.asym-rank-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  gap: 16px;
  padding-top: 16px;
}

/* 常驻固定前三名 */
.asym-fixed-top3 {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.top3-fixed-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 18px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.08);
  border: 2px solid rgba(255, 255, 255, 0.16);
}
.top3-fixed-card.gold {
  background: linear-gradient(90deg, rgba(245, 158, 11, 0.25), rgba(245, 158, 11, 0.05));
  border-color: #f59e0b;
}
.top3-fixed-card.silver {
  background: linear-gradient(90deg, rgba(148, 163, 184, 0.25), rgba(148, 163, 184, 0.05));
  border-color: #cbd5e1;
}
.top3-fixed-card.bronze {
  background: linear-gradient(90deg, rgba(217, 119, 6, 0.25), rgba(217, 119, 6, 0.05));
  border-color: #b45309;
}
.badge-crown {
  font-size: 22px;
  font-weight: 900;
}
.top3-avatar {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  border: 2px solid #ffffff;
  object-fit: cover;
}
.top3-meta {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.top3-meta strong {
  font-size: 24px;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.top3-meta .pts {
  font-size: 22px;
  font-weight: 800;
  color: #fbbf24;
}

/* 第4名起平滑滚动区域 */
.asym-scroll-section {
  flex: 1;
  overflow: hidden;
  position: relative;
  border-top: 1px dashed rgba(255, 255, 255, 0.12);
  padding-top: 10px;
}
.scroll-ticker-track {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.scroll-ticker-track.animate {
  animation: tickerScroll 24s linear infinite;
}
@keyframes tickerScroll {
  0% { transform: translateY(0); }
  100% { transform: translateY(-50%); }
}
.asym-ticker-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
}
.ticker-rank {
  font-size: 20px;
  font-weight: 800;
  color: #94a3b8;
  width: 32px;
}
.ticker-avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  object-fit: cover;
}
.ticker-name {
  flex: 1;
  font-size: 20px;
  color: #e2e8f0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ticker-pts {
  font-size: 20px;
  color: #10b981;
  font-weight: 800;
}

.asym-rank-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 40px 20px;
  color: #94a3b8;
}
.empty-icon-trophy {
  font-size: 72px;
  margin-bottom: 16px;
}
.asym-rank-empty strong {
  font-size: 32px;
  color: #f8fafc;
  margin-bottom: 12px;
}
.asym-rank-empty p {
  font-size: 22px;
  line-height: 1.5;
  margin: 0;
}

/* ============================================================================
   THEME 2: 三段式手账闪词流 (layout-notebook-tier)
   大题卡 + 判卷气泡瀑布 + 底部横向滑动画廊榜
   ============================================================================ */
.layout-notebook-tier {
  width: 1080px;
  height: 1920px;
  background: #f8fafc;
  color: #0f172a;
  display: flex;
  flex-direction: column;
  padding: 0 0 24px;
}

/* 上段 42% 大题卡 */
.nb-tier-top-card {
  margin: 20px 32px 0;
  background: #ffffff;
  border: 3px solid #e2e8f0;
  border-radius: 32px;
  padding: 36px 40px;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.06);
}
.nb-paper-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}
.nb-tag-round {
  font-size: 24px;
  font-weight: 800;
  color: #0284c7;
  background: #e0f2fe;
  padding: 6px 18px;
  border-radius: 999px;
}
.nb-time-clock {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #f1f5f9;
  padding: 8px 20px;
  border-radius: 999px;
  font-size: 28px;
  font-weight: 900;
  color: #0f172a;
}
.nb-time-clock.urgent {
  background: #fee2e2;
  color: #ef4444;
}
.nb-card-title {
  margin: 0 0 32px;
  font-size: 46px;
  font-weight: 900;
  line-height: 1.35;
}
.nb-mark-pen {
  background: linear-gradient(180deg, transparent 65%, #fef08a 65%);
}
.nb-choices-2x2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.nb-choice-cell {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px 24px;
  border: 2px solid #e2e8f0;
  border-radius: 20px;
  background: #f8fafc;
}
.nb-choice-cell.ok {
  border-color: #10b981;
  background: #ecfdf5;
}
.nb-choice-cell.err {
  border-color: #ef4444;
  background: #fef2f2;
}
.nb-choice-letter {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #0284c7;
  color: #ffffff;
  display: grid;
  place-items: center;
  font-size: 24px;
  font-weight: 900;
  flex-shrink: 0;
}
.nb-choice-label {
  flex: 1;
  font-size: 26px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.nb-choice-mark {
  font-size: 22px;
  font-weight: 800;
}
.nb-choice-mark.green { color: #10b981; }
.nb-choice-mark.red { color: #ef4444; }
.nb-choice-pct {
  font-size: 22px;
  font-weight: 800;
  color: #64748b;
}

/* 中段 24% 判卷气泡瀑布 */
.nb-tier-mid-waterfall {
  margin: 20px 32px 0;
  background: #f1f5f9;
  border: 2px dashed #cbd5e1;
  border-radius: 28px;
  padding: 20px 28px;
  display: flex;
  flex-direction: column;
  min-height: 230px;
}
.waterfall-title-strip {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}
.wf-badge {
  font-size: 22px;
  font-weight: 800;
  color: #0284c7;
}
.wf-lead {
  font-size: 20px;
  color: #64748b;
}
.waterfall-bubble-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.wf-stamp-bubble {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 16px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
}
.wf-stamp-bubble.pass {
  border-color: #a7f3d0;
  background: #f0fdf4;
}
.wf-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
}
.wf-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.wf-info strong {
  font-size: 22px;
  color: #0f172a;
}
.wf-info small {
  font-size: 16px;
  color: #64748b;
}
.wf-result-stamp {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
.wf-choice-pill {
  font-size: 18px;
  font-weight: 700;
  color: #0284c7;
}
.wf-mark {
  font-size: 20px;
  font-weight: 900;
}
.wf-stamp-bubble.pass .wf-mark { color: #10b981; }
.waterfall-empty-box {
  flex: 1;
  display: grid;
  place-items: center;
  text-align: center;
  color: #64748b;
  font-size: 24px;
}

/* 底段 34% 横向滑动画廊榜 */
.nb-tier-bottom-gallery {
  flex: 1;
  margin: 20px 32px 0;
  background: #ffffff;
  border: 3px solid #e2e8f0;
  border-radius: 32px;
  padding: 24px 28px;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.gallery-title-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.gallery-title span {
  font-size: 26px;
  font-weight: 900;
  color: #0f172a;
}
.gallery-title small {
  margin-left: 10px;
  font-size: 18px;
  color: #94a3b8;
}
.gallery-counter {
  font-size: 22px;
  font-weight: 800;
  color: #0284c7;
}
.gallery-cards-track {
  flex: 1;
  display: flex;
  gap: 20px;
  overflow-x: auto;
  padding-bottom: 12px;
}
.gallery-polaroid-card {
  flex: 0 0 170px;
  background: #f8fafc;
  border: 2px solid #e2e8f0;
  border-radius: 20px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.04);
}
.gallery-polaroid-card.champion {
  border-color: #f59e0b;
  background: #fffbeb;
}
.polaroid-photo {
  position: relative;
  width: 140px;
  height: 140px;
  border-radius: 14px;
  overflow: hidden;
  margin-bottom: 12px;
}
.polaroid-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.polaroid-rank-badge {
  position: absolute;
  top: 8px;
  left: 8px;
  background: rgba(0, 0, 0, 0.65);
  color: #ffffff;
  font-size: 18px;
  font-weight: 900;
  padding: 2px 8px;
  border-radius: 8px;
}
.gallery-polaroid-card.champion .polaroid-rank-badge {
  background: #f59e0b;
}
.polaroid-footer {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.polaroid-name {
  font-size: 22px;
  color: #0f172a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 140px;
}
.polaroid-score {
  font-size: 20px;
  font-weight: 800;
  color: #0284c7;
}
.gallery-empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #64748b;
}
.empty-polaroid-icon {
  font-size: 64px;
  margin-bottom: 12px;
}
.gallery-empty-state strong {
  font-size: 30px;
  color: #0f172a;
  margin-bottom: 8px;
}
.gallery-empty-state p {
  font-size: 22px;
  margin: 0;
  max-width: 600px;
}

/* ============================================================================
   THEME 3: 赛博中心辐射流 (layout-radial-cyber)
   中央全息能量环 + 四向辐射选项槽 + 底部扇形仪表战力台
   ============================================================================ */
.layout-radial-cyber {
  width: 1080px;
  height: 1920px;
  background: #020617;
  color: #ffffff;
  display: flex;
  flex-direction: column;
}
.cyber-radial-cockpit {
  flex: 0 0 1140px;
  display: flex;
  flex-direction: column;
  padding: 24px 32px;
  box-sizing: border-box;
}
.cockpit-hud-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 22px;
  font-weight: 800;
  color: #38bdf8;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(56, 189, 248, 0.2);
}
.hud-likes-chip {
  color: #ec4899;
}
.radial-stage-container {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 中央能量核心 */
.radial-center-core {
  position: relative;
  z-index: 10;
  width: 520px;
  height: 520px;
  border-radius: 50%;
  background: radial-gradient(circle, #0f172a 40%, #030712 100%);
  border: 4px solid #06b6d4;
  box-shadow: 0 0 60px rgba(6, 182, 212, 0.35);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  text-align: center;
  box-sizing: border-box;
}
.core-countdown-ring {
  position: absolute;
  top: 20px;
  width: 100px;
  height: 100px;
}
.ring-svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}
.ring-bg {
  fill: none;
  stroke: rgba(255, 255, 255, 0.1);
  stroke-width: 8;
}
.ring-pulse {
  fill: none;
  stroke: #06b6d4;
  stroke-width: 8;
  stroke-dasharray: 440;
  stroke-dashoffset: 80;
}
.core-time-number {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  line-height: 1;
}
.core-time-number strong {
  font-size: 34px;
  font-weight: 900;
  color: #38bdf8;
}
.core-time-number small {
  font-size: 12px;
  color: #94a3b8;
}
.core-question-display {
  margin-top: 60px;
}
.core-q-title {
  font-size: 36px;
  font-weight: 800;
  line-height: 1.4;
  color: #f8fafc;
  margin: 0;
}

/* 四角环抱按键 */
.radial-wings-grid {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 20px;
  pointer-events: none;
}
.radial-wing-channel {
  pointer-events: auto;
  position: relative;
  overflow: hidden;
  border: 2px solid rgba(56, 189, 248, 0.25);
  border-radius: 28px;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(8px);
  padding: 24px;
  display: flex;
  align-items: flex-end;
}
.radial-wing-channel.correct {
  border-color: #10b981;
  box-shadow: 0 0 30px rgba(16, 185, 129, 0.4);
}
.radial-wing-channel.wrong {
  border-color: #ef4444;
}
.wing-fill-plasma {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(0deg, rgba(6, 182, 212, 0.4), transparent);
  z-index: 1;
  transition: height 0.3s ease;
}
.wing-content {
  position: relative;
  z-index: 2;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.wing-letter {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: #06b6d4;
  color: #020617;
  display: grid;
  place-items: center;
  font-size: 28px;
  font-weight: 900;
}
.wing-text {
  flex: 1;
  margin: 0 16px;
  font-size: 26px;
  font-weight: 700;
  color: #f8fafc;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.wing-stat {
  font-size: 24px;
  color: #38bdf8;
}

/* 粒子脉冲流 */
.cyber-pulse-stream {
  margin-top: 16px;
  min-height: 80px;
  display: flex;
  align-items: center;
}
.pulse-capsules-row {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  width: 100%;
}
.pulse-user-pill {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  border-radius: 999px;
  background: rgba(56, 189, 248, 0.1);
  border: 1px solid rgba(56, 189, 248, 0.3);
  white-space: nowrap;
}
.pill-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
}
.pill-name {
  font-size: 20px;
  font-weight: 700;
}
.pill-ch {
  font-size: 18px;
  color: #38bdf8;
}
.pill-hit {
  font-size: 18px;
  color: #10b981;
}
.pulse-empty-bar {
  width: 100%;
  text-align: center;
  color: #64748b;
  font-size: 22px;
}

/* 下半部 40% 扇形全息仪表战力台 */
.cyber-fan-dashboard {
  flex: 1;
  background: radial-gradient(ellipse at bottom, #0e1e38 0%, #020617 80%);
  border-top: 3px solid #06b6d4;
  padding: 24px 32px 32px;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}
.fan-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}
.fan-title {
  font-size: 28px;
  font-weight: 900;
  color: #38bdf8;
}
.fan-tip {
  font-size: 20px;
  color: #94a3b8;
}
.fan-podium-stage {
  flex: 1;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.fan-pillars-layout {
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  gap: 10px;
}
.fan-pillar-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}
.pillar-avatar-holo {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 8px;
}
.pillar-avatar-holo img {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  border: 2px solid #06b6d4;
  box-shadow: 0 0 16px rgba(6, 182, 212, 0.6);
}
.holo-crown {
  font-size: 18px;
  color: #f59e0b;
  font-weight: 900;
}
.holo-num {
  font-size: 16px;
  color: #38bdf8;
}
.pillar-beam-bar {
  width: 32px;
  border-radius: 8px 8px 0 0;
  background: linear-gradient(180deg, #38bdf8, #0369a1);
  box-shadow: 0 0 20px rgba(56, 189, 248, 0.5);
}
.pillar-name {
  font-size: 18px;
  color: #cbd5e1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 80px;
  margin-top: 8px;
}
.pillar-pts {
  font-size: 20px;
  font-weight: 800;
  color: #38bdf8;
}
.fan-empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #64748b;
}
.fan-radar-icon {
  font-size: 64px;
  margin-bottom: 12px;
}
.fan-empty-state strong {
  font-size: 32px;
  color: #38bdf8;
  margin-bottom: 8px;
}
.fan-empty-state p {
  font-size: 22px;
  margin: 0;
}

/* ============================================================================
   THEME 4: 街机四色名人堂流 (layout-arcade-hall)
   顶部通关积分条 + 4色3D立体大按键 + 像素高分名人堂
   ============================================================================ */
.layout-arcade-hall {
  width: 1080px;
  height: 1920px;
  background: #18181b;
  color: #ffffff;
  display: flex;
  flex-direction: column;
}

/* 顶段 18% 街机通关积分条 */
.arcade-stage-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 36px;
  background: #27272a;
  border-bottom: 3px solid #3f3f46;
}
.arcade-stage-meta {
  display: flex;
  align-items: center;
  gap: 16px;
}
.arcade-coin-tag {
  background: #fbbf24;
  color: #000;
  font-size: 22px;
  font-weight: 900;
  padding: 6px 18px;
  border-radius: 999px;
}
.arcade-bank-tag {
  font-size: 24px;
  font-weight: 800;
  color: #e4e4e7;
}
.arcade-timer-badge {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #09090b;
  border: 2px solid #52525b;
  padding: 6px 18px;
  border-radius: 12px;
}
.arcade-timer-badge span {
  font-size: 16px;
  color: #a1a1aa;
}
.arcade-timer-badge strong {
  font-size: 32px;
  font-weight: 900;
  color: #22c55e;
}
.arcade-timer-badge.urgent strong {
  color: #ef4444;
}

/* 中段 45% CRT 街机按键 */
.arcade-crt-console {
  flex: 0 0 760px;
  margin: 20px 32px 0;
  background: #09090b;
  border: 4px solid #3f3f46;
  border-radius: 28px;
  padding: 28px 36px;
  display: flex;
  flex-direction: column;
}
.crt-question-heading {
  margin: 0 0 28px;
  font-size: 40px;
  font-weight: 900;
  line-height: 1.4;
  color: #f8fafc;
}
.crt-buttons-4col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}
.arcade-3d-btn {
  border-radius: 20px;
  box-shadow: 0 8px 0 rgba(0, 0, 0, 0.4);
  cursor: pointer;
  transition: transform 0.1s;
}
.btn-top-cap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 22px 24px;
  border-radius: 18px;
}
.btn-color-A .btn-top-cap { background: #e11d48; color: #ffffff; }
.btn-color-B .btn-top-cap { background: #0284c7; color: #ffffff; }
.btn-color-C .btn-top-cap { background: #16a34a; color: #ffffff; }
.btn-color-D .btn-top-cap { background: #d97706; color: #ffffff; }
.btn-key {
  font-size: 32px;
  font-weight: 900;
}
.btn-text {
  flex: 1;
  margin: 0 16px;
  font-size: 26px;
  font-weight: 800;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.btn-stat {
  font-size: 22px;
  font-weight: 900;
}

/* 暴击伤害弹窗流 */
.crt-hit-combo-bar {
  margin-top: 24px;
  min-height: 70px;
  display: flex;
  align-items: center;
}
.hit-chips-list {
  display: flex;
  gap: 14px;
  width: 100%;
}
.hit-chip-pop {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border-radius: 12px;
  background: #27272a;
  border: 1px solid #52525b;
}
.hit-chip-pop.critical {
  border-color: #fbbf24;
  background: #3f3f46;
}
.hit-av {
  width: 40px;
  height: 40px;
  border-radius: 50%;
}
.hit-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.hit-info strong {
  font-size: 20px;
}
.hit-info small {
  font-size: 14px;
  color: #94a3b8;
}
.hit-damage {
  font-size: 20px;
  font-weight: 900;
  color: #fbbf24;
}
.hit-empty-text {
  width: 100%;
  text-align: center;
  color: #71717a;
  font-size: 22px;
}

/* 底段 37% 街机名人堂 */
.arcade-hall-fame-bottom {
  flex: 1;
  margin: 20px 32px 28px;
  background: #27272a;
  border: 3px solid #3f3f46;
  border-radius: 28px;
  padding: 24px 32px;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.hall-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 16px;
  border-bottom: 2px solid #3f3f46;
}
.hall-title {
  font-size: 26px;
  font-weight: 900;
  color: #fbbf24;
}
.hall-meta {
  font-size: 20px;
  color: #a1a1aa;
}
.hall-players-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  padding-top: 18px;
  overflow-y: auto;
}
.hall-cell {
  background: #18181b;
  border: 2px solid #3f3f46;
  border-radius: 16px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.hall-cell.top1 {
  border-color: #fbbf24;
  background: rgba(251, 191, 36, 0.1);
}
.hall-cell.top3 {
  border-color: #e4e4e7;
}
.hall-cell-head {
  width: 100%;
  display: flex;
  justify-content: space-between;
  font-size: 16px;
  font-weight: 900;
  margin-bottom: 8px;
}
.hall-rank { color: #fbbf24; }
.hall-streak { color: #f43f5e; }
.hall-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  margin-bottom: 8px;
}
.hall-name {
  font-size: 18px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}
.hall-pts {
  font-size: 20px;
  font-weight: 900;
  color: #22c55e;
}
.hall-empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #71717a;
}
.hall-empty-icon {
  font-size: 64px;
  margin-bottom: 12px;
}
.hall-empty-state strong {
  font-size: 28px;
  color: #fbbf24;
  margin-bottom: 8px;
}
.hall-empty-state p {
  font-size: 20px;
  margin: 0;
}

/* ============================================================================
   THEME 5: 全屏沉浸大舞台 + 底部悬浮抽屉金榜 (layout-immersive-scroll)
   75%超大题卡舞台 + 弹幕穿梭 + 底部折叠抽屉
   ============================================================================ */
.layout-immersive-scroll {
  width: 1080px;
  height: 1920px;
  background: radial-gradient(circle at 50% 30%, #3e1b10 0%, #1e0904 80%);
  color: #ffffff;
  display: flex;
  flex-direction: column;
  position: relative;
}

/* 75% 沉浸全屏题卡大舞台 */
.imperial-hero-scroll {
  flex: 1;
  padding: 32px 48px;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}
.imperial-plaque-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
}
.plaque-tag {
  font-size: 28px;
  font-weight: 900;
  color: #fde047;
}
.plaque-timer {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(254, 224, 71, 0.15);
  border: 2px solid #b45309;
  padding: 8px 24px;
  border-radius: 999px;
  font-size: 24px;
}
.plaque-timer strong {
  font-size: 36px;
  font-weight: 900;
  color: #fde047;
}
.plaque-timer.urgent strong {
  color: #ef4444;
}

/* 圣旨大卷轴 */
.scroll-canvas-body {
  position: relative;
  background: #fbf5e8;
  border: 6px solid #854d0e;
  border-radius: 36px;
  padding: 48px 56px;
  color: #451a03;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
  margin-bottom: 36px;
  min-height: 280px;
  display: flex;
  align-items: center;
}
.scroll-seal-mark {
  position: absolute;
  top: 24px;
  right: 28px;
  font-size: 24px;
  color: #dc2626;
  border: 3px solid #dc2626;
  padding: 4px 12px;
  border-radius: 8px;
  transform: rotate(-10deg);
  font-weight: 900;
}
.scroll-hero-title {
  margin: 0;
  font-size: 52px;
  font-weight: 900;
  line-height: 1.4;
}

/* 四柱印章大按键 */
.scroll-tablets-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}
.imperial-tablet-btn {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 26px 32px;
  border-radius: 24px;
  background: rgba(254, 243, 199, 0.12);
  border: 3px solid #b45309;
}
.imperial-tablet-btn.ok {
  border-color: #22c55e;
  background: rgba(34, 197, 94, 0.25);
}
.tablet-seal {
  width: 58px;
  height: 58px;
  border-radius: 50%;
  background: #b45309;
  color: #fef08a;
  display: grid;
  place-items: center;
  font-size: 32px;
  font-weight: 900;
  flex-shrink: 0;
}
.tablet-text {
  flex: 1;
  font-size: 32px;
  font-weight: 800;
  color: #fef08a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tablet-state {
  font-size: 26px;
  font-weight: 900;
  color: #fde047;
}

/* 弹幕飞掠气泡 */
.scroll-danmaku-stream {
  margin-top: 36px;
  min-height: 80px;
  display: flex;
  align-items: center;
}
.danmaku-fly-lane {
  display: flex;
  gap: 16px;
  width: 100%;
}
.danmaku-scholar-tag {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 20px;
  border-radius: 999px;
  background: rgba(254, 224, 71, 0.2);
  border: 1px solid #ca8a04;
  white-space: nowrap;
}
.danmaku-scholar-tag.pass {
  background: rgba(34, 197, 94, 0.25);
  border-color: #22c55e;
}
.danmaku-scholar-tag img {
  width: 44px;
  height: 44px;
  border-radius: 50%;
}
.danmaku-scholar-tag span {
  font-size: 22px;
  font-weight: 700;
}
.danmaku-scholar-tag b {
  font-size: 20px;
  color: #fde047;
}
.danmaku-scholar-tag small {
  font-size: 18px;
  color: #22c55e;
}
.danmaku-empty-hint {
  width: 100%;
  text-align: center;
  color: #ca8a04;
  font-size: 24px;
}

/* 底部悬浮抽屉式折叠金榜 */
.imperial-bottom-drawer {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 50;
  background: #2b110a;
  border-top: 4px solid #b45309;
  border-radius: 36px 36px 0 0;
  box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.7);
  transition: transform 0.35s cubic-bezier(0.18, 1, 0.3, 1);
  transform: translateY(calc(100% - 90px));
}
.imperial-bottom-drawer.expanded {
  transform: translateY(0);
}
.drawer-trigger-bar {
  height: 90px;
  padding: 0 40px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
}
.drawer-left {
  display: flex;
  align-items: center;
  gap: 16px;
}
.drawer-badge {
  font-size: 26px;
  font-weight: 900;
  color: #fde047;
}
.drawer-summary {
  font-size: 22px;
  color: #cbd5e1;
}
.drawer-right {
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 22px;
  font-weight: 800;
  color: #fde047;
}
.drawer-content-body {
  height: 600px;
  padding: 24px 40px 40px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}
.drawer-trio-plaques {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}
.drawer-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px;
  border-radius: 20px;
  background: rgba(254, 224, 71, 0.1);
  border: 2px solid #b45309;
}
.drawer-card.first {
  background: rgba(254, 224, 71, 0.25);
  border-color: #fde047;
}
.drawer-card span {
  font-size: 20px;
  font-weight: 900;
  color: #fde047;
  margin-bottom: 8px;
}
.drawer-card img {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  margin-bottom: 8px;
}
.drawer-card strong {
  font-size: 22px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 140px;
}
.drawer-card b {
  font-size: 20px;
  color: #fde047;
}
.drawer-jinshi-scroll {
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.drawer-jinshi-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.05);
}
.j-rank {
  font-size: 18px;
  color: #ca8a04;
  font-weight: 800;
}
.drawer-jinshi-row img {
  width: 40px;
  height: 40px;
  border-radius: 50%;
}
.j-name {
  flex: 1;
  font-size: 20px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.j-pts {
  font-size: 20px;
  color: #fde047;
}
.drawer-empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #ca8a04;
}
.drawer-empty-state strong {
  font-size: 32px;
  color: #fde047;
  margin-bottom: 8px;
}
.drawer-empty-state p {
  font-size: 22px;
  margin: 0;
}
</style>
