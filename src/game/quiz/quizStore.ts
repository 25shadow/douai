import { computed, reactive, watch } from 'vue';
import type { DyMessage } from '../../core/type.ts';
import { CastMethod } from '../../core/type.ts';
import { speak, speakSequence, clearVoiceOwner } from '../../voice/voiceManager.ts';
import type { VoiceScene } from '../../voice/voiceConfig.ts';
import { soundEffects } from '../../utils/soundEffects.ts';
import {
  getGiftEffect,
  getQuizRank,
  parseLikeCount,
  parseQuizAnswer,
  submitQuizAnswer,
  defaultGiftRules,
  defaultLikeRules,
  type QuizAnswerRecord,
  type GiftRule,
  type LikeRule,
  type QuizOption
} from './quizRules.ts';
import { selectQuizQuestions } from './questionBanks.ts';
import { normalizeQuizTheme, type QuizThemeId } from './quizThemes.ts';

export interface QuizConfig {
  theme: QuizThemeId;
  bank: string;
  count: number;
  answerTime: number;
  revealTime: number;
  interval: number;
  countdown: number;
  voice: boolean;
  autoNext: boolean;
  likes: boolean;
  gameDurationMinutes: number;
  likeRules: LikeRule[];
  giftRules: GiftRule[];
  customBanks?: Record<string, QuizQuestion[]>;
  customQuestions?: QuizQuestion[];
}

export interface QuizQuestion {
  title: string;
  options: Record<QuizOption, string>;
  answer: QuizOption;
}

const defaultConfig: QuizConfig = {
  theme: 'arena', bank: '基础知识题库', count: 3, answerTime: 30, revealTime: 5, interval: 3, countdown: 5,
  voice: true, autoNext: true, likes: true, gameDurationMinutes: 60,
  likeRules: defaultLikeRules.map(rule => ({ ...rule })),
  giftRules: defaultGiftRules.map(rule => ({ ...rule })),
  customQuestions: []
};
export const quizRuntimeSettings = reactive<QuizConfig>({ ...defaultConfig });

export interface QuizPlayerProfile {
  name: string;
  avatar?: string;
  score: number;
  points: number;
  streak: number;
  lastDelta: number;
  lastOption?: QuizOption;
  lastCorrect?: boolean;
}

export interface QuizRecentAnswer {
  id: string;
  name: string;
  avatar?: string;
  option: QuizOption;
  correct: boolean;
  delta: number;
  streak: number;
  isFirstBlood?: boolean;
}

export interface QuizGiftEffectBanner {
  id: string;
  userName: string;
  userAvatar?: string;
  giftName: string;
  giftIcon?: string;
  count: number;
  effectLabel: string;
}

export const quizState = reactive({
  running: false,
  phase: 'idle' as 'idle' | 'countdown' | 'answering' | 'reveal' | 'break' | 'waiting' | 'ended',
  status: '等待开始',
  questionIndex: 0,
  question: {
    title: '太阳系中最大的行星是哪一颗？',
    options: { A: '地球', B: '木星', C: '火星', D: '金星' },
    answer: 'B' as QuizOption
  },
  timeLeft: 0,
  correctCount: 0,
  likes: 0,
  eliminatedOptions: [] as QuizOption[],
  assistMessage: '',
  winner: null as null | { name: string; giftName: string; avatar?: string },
  revealAnswer: false,
  answers: {} as QuizAnswerRecord,
  players: {} as Record<string, QuizPlayerProfile>,
  recentAnswers: [] as QuizRecentAnswer[],
  firstBlood: null as null | { name: string; avatar?: string; delta: number; streak: number },
  giftEffects: [] as QuizGiftEffectBanner[]
});

let config = { ...defaultConfig };
let questions: QuizQuestion[] = [];
let timer: number | undefined;
let durationTimer: number | undefined;
let appliedLikeRules: number[] = [];
export const quizProgress = computed(() => `${Math.min(quizState.questionIndex + 1, config.count)} / ${questions.length || config.count}`);

// ==================== 跨窗口 (主控台 <-> 游戏画面窗口) 实时状态同步 ====================
const QUIZ_SYNC_STORAGE_KEY = 'douai:quiz-live-state-v1';
const QUIZ_SYNC_CHANNEL_NAME = 'douai:quiz-live-sync-v1';

const isGameDisplayWindow =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location?.search || '').get('display') === 'game';

let syncChannel: BroadcastChannel | null = null;
let isApplyingRemoteState = false;

interface QuizSyncSnapshot {
  state: typeof quizState;
  settings: QuizConfig;
  questionTotal: number;
  updatedAt: number;
}

function createSyncSnapshot(): QuizSyncSnapshot {
  return JSON.parse(
    JSON.stringify({
      state: quizState,
      settings: quizRuntimeSettings,
      questionTotal: questions.length || config.count,
      updatedAt: Date.now()
    })
  ) as QuizSyncSnapshot;
}

function applySyncSnapshot(snapshot: QuizSyncSnapshot | null | undefined) {
  if (!snapshot || !snapshot.state || !snapshot.settings) return;
  isApplyingRemoteState = true;
  try {
    Object.assign(quizRuntimeSettings, snapshot.settings);
    config = {
      ...defaultConfig,
      ...snapshot.settings,
      theme: normalizeQuizTheme(snapshot.settings.theme)
    };
    Object.assign(quizState, snapshot.state);
  } finally {
    isApplyingRemoteState = false;
  }
}

function publishQuizSyncState() {
  if (typeof window === 'undefined' || isGameDisplayWindow || isApplyingRemoteState) return;
  try {
    const snapshot = createSyncSnapshot();
    window.localStorage.setItem(QUIZ_SYNC_STORAGE_KEY, JSON.stringify(snapshot));
    syncChannel?.postMessage({ type: 'SYNC_STATE', payload: snapshot });
  } catch {
    // Ignore storage quota or serialization errors
  }
}

if (typeof window !== 'undefined') {
  try {
    if ('BroadcastChannel' in window) {
      syncChannel = new BroadcastChannel(QUIZ_SYNC_CHANNEL_NAME);
      syncChannel.addEventListener('message', (event: MessageEvent) => {
        const data = event.data as { type?: string; payload?: QuizSyncSnapshot } | undefined;
        if (!data) return;
        if (data.type === 'SYNC_STATE' && isGameDisplayWindow && data.payload) {
          applySyncSnapshot(data.payload);
        } else if (data.type === 'REQUEST_STATE' && !isGameDisplayWindow) {
          publishQuizSyncState();
        }
      });
    }
  } catch {
    syncChannel = null;
  }

  if (isGameDisplayWindow) {
    try {
      const raw = window.localStorage.getItem(QUIZ_SYNC_STORAGE_KEY);
      if (raw) {
        applySyncSnapshot(JSON.parse(raw) as QuizSyncSnapshot);
      }
    } catch {
      // Ignore invalid stored snapshot
    }
    window.addEventListener('storage', (event: StorageEvent) => {
      if (event.key === QUIZ_SYNC_STORAGE_KEY && event.newValue) {
        try {
          applySyncSnapshot(JSON.parse(event.newValue) as QuizSyncSnapshot);
        } catch {
          // Ignore invalid JSON
        }
      }
    });
    syncChannel?.postMessage({ type: 'REQUEST_STATE' });
  } else {
    // 主窗口启动时同步当前真实状态（未运行则覆盖掉旧缓存）
    publishQuizSyncState();
    watch(
      [quizState, quizRuntimeSettings],
      () => {
        publishQuizSyncState();
      },
      { deep: true }
    );
  }
}

function clearTimer() {
  if (timer !== undefined) window.clearInterval(timer);
  timer = undefined;
  if (durationTimer !== undefined) window.clearInterval(durationTimer);
  durationTimer = undefined;
}

function announce(text: string, scene: VoiceScene = 'system') {
  if (config.voice) speak(text, { scene, owner: 'quiz' });
}

function ensurePlayer(userId: string, name?: string, avatar?: string) {
  const player = quizState.players[userId] || {
    name: name || '观众',
    avatar,
    score: 0,
    points: 0,
    streak: 0,
    lastDelta: 0
  };
  if (name) player.name = name;
  if (avatar) player.avatar = avatar;
  quizState.players[userId] = player;
  return player;
}

function addCorrectAnswer(
  userId: string,
  name?: string,
  avatar?: string,
  scene: VoiceScene = 'answer',
  announceVoice = true
) {
  const player = ensurePlayer(userId, name, avatar);
  const isFirstBlood = !quizState.firstBlood;
  const delta = isFirstBlood ? 15 : 10 + Math.min(20, player.streak * 2);
  player.score += 1;
  player.streak += 1;
  player.points += delta;
  player.lastDelta = delta;
  player.lastCorrect = true;
  if (isFirstBlood) {
    quizState.firstBlood = { name: player.name, avatar: player.avatar, delta, streak: player.streak };
  }
  quizState.correctCount += 1;
  quizState.status = `${player.name} 答对了`;
  if (announceVoice) {
    announce(`${player.name} 答对了，当前段位${getQuizRank(player.score)}`, scene);
  }
  return { delta, isFirstBlood, streak: player.streak };
}

function openQuestion() {
  clearVoiceOwner('quiz');
  quizState.phase = 'answering';
  quizState.status = `第 ${quizState.questionIndex + 1} 题`;
  quizState.timeLeft = Math.max(5, config.answerTime);
  quizState.likes = 0;
  quizState.eliminatedOptions = [];
  appliedLikeRules = [];
  quizState.assistMessage = '';
  quizState.answers = {};
  quizState.recentAnswers = [];
  quizState.firstBlood = null;
  announce(`第 ${quizState.questionIndex + 1} 题，${quizState.question.title}`, 'quiz');
}

function finishGame(status: string) {
  clearVoiceOwner('quiz');
  if (quizState.phase === 'answering' || quizState.phase === 'reveal') quizState.revealAnswer = true;
  clearTimer();
  quizState.running = false;
  quizState.phase = 'ended';
  quizState.timeLeft = 0;
  quizState.status = status;
  announce(status);
}

function prepareNextQuestion() {
  clearVoiceOwner('quiz');
  if (quizState.questionIndex + 1 >= questions.length) {
    finishGame(`本轮完成，共答对 ${quizState.correctCount} 题`);
    return false;
  }
  quizState.questionIndex += 1;
  quizState.question = questions[quizState.questionIndex];
  quizState.winner = null;
  quizState.revealAnswer = false;
  quizState.phase = config.interval > 0 ? 'break' : 'answering';
  quizState.timeLeft = config.interval > 0 ? config.interval : Math.max(5, config.answerTime);
  quizState.status = config.interval > 0 ? '下一题即将开始' : `第 ${quizState.questionIndex + 1} 题`;
  if (config.interval === 0) openQuestion();
  return true;
}

function tick() {
  if (quizState.timeLeft > 1) {
    quizState.timeLeft -= 1;
    if (quizState.phase === 'answering' && quizState.timeLeft <= 3) {
      try { soundEffects.playCountdown(); } catch { /* ignore */ }
    }
    return;
  }

  if (quizState.phase === 'countdown') {
    openQuestion();
    return;
  }
  if (quizState.phase === 'break') {
    openQuestion();
    return;
  }
  if (quizState.phase === 'answering') {
    clearVoiceOwner('quiz', ['answer', 'gift', 'like', 'quiz']);
    quizState.phase = 'reveal';
    quizState.revealAnswer = true;
    quizState.timeLeft = Math.max(1, config.revealTime);
    quizState.status = `正确答案：${quizState.question.answer}`;
    announce(`本题正确答案是${quizState.question.answer}`, 'quiz');
    return;
  }
  if (quizState.phase === 'reveal') {
    if (config.autoNext) {
      if (prepareNextQuestion()) {
        if (!timer) timer = window.setInterval(tick, 1000);
      }
    } else {
      quizState.phase = 'waiting';
      quizState.status = '本题结束，等待手动进入下一题';
      clearTimer();
    }
  }
}

export function startQuiz(nextConfig?: Partial<QuizConfig>) {
  clearVoiceOwner('quiz');
  const mergedSource = {
    ...defaultConfig,
    ...quizRuntimeSettings,
    ...nextConfig
  };
  config = {
    ...mergedSource,
    theme: normalizeQuizTheme(mergedSource.theme),
    likeRules: mergedSource.likeRules || defaultConfig.likeRules,
    giftRules: mergedSource.giftRules || defaultConfig.giftRules
  };
  Object.assign(quizRuntimeSettings, config);
  questions = selectQuizQuestions(config.bank, config.count, config.customQuestions || [], Math.random, config.customBanks || {});
  clearTimer();
  if (!questions.length) {
    quizState.running = false;
    quizState.phase = 'idle';
    quizState.status = '所选题库为空，请选择内置题库或使用 AI 生成';
    return;
  }
  quizState.running = true;
  quizState.phase = config.countdown > 0 ? 'countdown' : 'answering';
  quizState.status = config.countdown > 0 ? '即将开始' : '答题中';
  quizState.questionIndex = 0;
  quizState.question = questions[0];
  quizState.timeLeft = config.countdown > 0 ? config.countdown : Math.max(5, config.answerTime);
  quizState.correctCount = 0;
  quizState.likes = 0;
  quizState.eliminatedOptions = [];
  appliedLikeRules = [];
  quizState.assistMessage = '';
  quizState.winner = null;
  quizState.revealAnswer = false;
  quizState.answers = {};
  quizState.players = {};
  quizState.recentAnswers = [];
  quizState.firstBlood = null;
  quizState.giftEffects = [];

  if (config.countdown > 0) announce('知识问答即将开始', 'system');
  if (config.countdown === 0) {
    if (config.voice) speakSequence([
      { text: '知识问答开始', options: { scene: 'system', owner: 'quiz' } },
      { text: `第一题，${quizState.question.title}`, options: { scene: 'quiz', owner: 'quiz' } }
    ]);
  }
  timer = window.setInterval(tick, 1000);
  if (config.gameDurationMinutes > 0) {
    let remaining = Math.floor(config.gameDurationMinutes * 60);
    durationTimer = window.setInterval(() => {
      remaining -= 1;
      if (remaining <= 0 && quizState.running) finishGame('达到设置的游戏时长，本场结束');
    }, 1000);
  }
}

export function setQuizPreviewConfig(nextConfig: Partial<QuizConfig>) {
  if (quizState.running || quizState.phase !== 'idle') return;
  config = {
    ...defaultConfig,
    ...nextConfig,
    theme: normalizeQuizTheme(nextConfig.theme),
    likeRules: nextConfig.likeRules || defaultConfig.likeRules,
    giftRules: nextConfig.giftRules || defaultConfig.giftRules
  };
  Object.assign(quizRuntimeSettings, config);
  const preview = selectQuizQuestions(config.bank, 1, config.customQuestions || [], Math.random, config.customBanks || {});
  if (preview.length) quizState.question = preview[0];
}

export function stopQuiz() {
  if (!quizState.running) return;
  finishGame('游戏已结束');
}

export function nextQuestion() {
  if (!quizState.running || !['answering', 'waiting'].includes(quizState.phase)) return;
  if (!prepareNextQuestion()) return;
  if (!timer) timer = window.setInterval(tick, 1000);
}

function submitAnswer(
  userId: string,
  name: string | undefined,
  avatar: string | undefined,
  answer: QuizOption,
  scene: VoiceScene = 'answer',
  forceOverride = false,
  announceVoice = true
) {
  if (forceOverride && quizState.answers[userId]) {
    delete quizState.answers[userId];
  }
  const result = submitQuizAnswer(quizState.answers, userId, answer, quizState.question.answer);
  if (!result.accepted) return false;
  const player = ensurePlayer(userId, name, avatar);
  player.lastOption = answer;
  if (result.correct) {
    try { soundEffects.playCorrect(); } catch { /* ignore */ }
    const info = addCorrectAnswer(userId, name, avatar, scene, announceVoice);
    quizState.recentAnswers.unshift({
      id: `${userId}-${Date.now()}`,
      name: player.name,
      avatar: player.avatar,
      option: answer,
      correct: true,
      delta: info.delta,
      streak: info.streak,
      isFirstBlood: info.isFirstBlood
    });
  } else {
    try { soundEffects.playWrong(); } catch { /* ignore */ }
    player.streak = 0;
    player.lastDelta = 0;
    player.lastCorrect = false;
    quizState.status = `${player.name} 已提交答案`;
    quizState.recentAnswers.unshift({
      id: `${userId}-${Date.now()}`,
      name: player.name,
      avatar: player.avatar,
      option: answer,
      correct: false,
      delta: 0,
      streak: 0
    });
  }
  quizState.recentAnswers.splice(8);
  return true;
}

function handleLike(message: DyMessage) {
  if (!quizState.running || quizState.phase !== 'answering' || !config.likes) return;
  quizState.likes += parseLikeCount(message.content);
  config.likeRules.forEach((rule, index) => {
    if (rule.effect === 'none' || rule.threshold <= 0 || quizState.likes < rule.threshold || appliedLikeRules.includes(index)) return;
    appliedLikeRules.push(index);
    if (rule.effect === 'eliminate') {
      const wrongOptions = (Object.keys(quizState.question.options) as QuizOption[])
        .filter(option => option !== quizState.question.answer && !quizState.eliminatedOptions.includes(option));
      const count = Math.max(1, Math.min(wrongOptions.length, Math.floor(rule.amount) || 1));
      const eliminated = wrongOptions.sort(() => Math.random() - 0.5).slice(0, count);
      quizState.eliminatedOptions.push(...eliminated);
      if (eliminated.length) {
        quizState.assistMessage = `❤️ 全员点赞达成 ${rule.threshold} 赞！已排除错误选项【${eliminated.join('、')}】`;
        announce(`全员点赞达成${rule.threshold}赞，已排除错误选项${eliminated.join('、')}`, 'like');
      }
      return;
    }
    quizState.timeLeft += Math.max(1, Math.floor(rule.amount) || 1);
    quizState.assistMessage = `❤️ 全员点赞达成 ${rule.threshold} 赞！答题时间延长 ${rule.amount} 秒`;
    announce(`全员点赞达成${rule.threshold}赞，答题时间延长${rule.amount}秒`, 'like');
  });
}

let lastGiftSignature = '';
let lastGiftTimestamp = 0;

function handleGift(message: DyMessage) {
  if (!quizState.running || !message.gift) return;
  const userId = message.user?.id || message.user?.name;
  if (!userId) return;
  const name = message.user?.name || '观众';
  const avatar = message.user?.avatar;
  const count = Math.max(1, Number(message.gift.count || 1));
  const giftName = message.gift.name || '礼物';

  const sig = `${userId}:${giftName}:${count}`;
  const now = Date.now();
  if (sig === lastGiftSignature && now - lastGiftTimestamp < 400) return;
  lastGiftSignature = sig;
  lastGiftTimestamp = now;

  try { soundEffects.playGift(); } catch { /* ignore */ }

  const unitPrice = Math.max(1, Number(message.gift.price) || 1);
  const price = unitPrice * count;
  const effect = getGiftEffect(price, config.giftRules);

  // 1. 核心互动玩法：送任何礼物均触发神助直接答对本题！
  // 礼物答题由下面的礼物专属话术播报，避免同时再播报一条普通“答对了”。
  submitAnswer(userId, name, avatar, quizState.question.answer, 'gift', true, false);

  // 2. 送礼越多赠送直接积分越多 (1抖币=10直接积分，保底20积分)
  const bonusPoints = Math.max(20, price * 10);
  const player = ensurePlayer(userId, name, avatar);
  player.points += bonusPoints;
  player.lastDelta = bonusPoints;

  // 3. 大额礼物 (≥30 抖币，如热气球、嘉年华) 直接保送本题通关夺魁
  if (effect === 'win' || price >= 30) {
    clearVoiceOwner('quiz', ['answer', 'gift', 'like', 'quiz']);
    player.score += 2;
    player.streak += 3;
    quizState.winner = { name, giftName, avatar };
    quizState.phase = 'reveal';
    quizState.revealAnswer = true;
    quizState.timeLeft = Math.max(1, config.revealTime);
    quizState.status = `${name} 送礼保送通关！`;
    quizState.assistMessage = `👑 @${name} 送出${giftName}×${count} · 狂送+${bonusPoints}分直接保送通关！`;
    quizState.giftEffects.unshift({
      id: `gift-${now}-${Math.random().toString(36).slice(2, 6)}`,
      userName: name,
      userAvatar: avatar,
      giftName,
      giftIcon: message.gift.icon,
      count,
      effectLabel: `通关夺魁 +${bonusPoints}分`
    });
    quizState.giftEffects.splice(5);
    announce(`感谢${name}送出${giftName}，保送直接通关夺魁，赠送${bonusPoints}积分！`, 'gift');
  } else {
    player.streak += 1;
    quizState.status = `${name} 送礼直接答对！`;
    quizState.assistMessage = `🎁 @${name} 送出${giftName}×${count} · 锦囊神助直接答对 +${bonusPoints}分！`;
    quizState.giftEffects.unshift({
      id: `gift-${now}-${Math.random().toString(36).slice(2, 6)}`,
      userName: name,
      userAvatar: avatar,
      giftName,
      giftIcon: message.gift.icon,
      count,
      effectLabel: `神助答对 +${bonusPoints}分`
    });
    quizState.giftEffects.splice(5);
    announce(`感谢${name}送出${giftName}，锦囊神助直接答对，赠送${bonusPoints}分！`, 'gift');
  }
}

export function handleQuizMessages(messages: DyMessage[]): boolean {
  if (!quizState.running) return false;
  let claimed = false;
  for (const message of messages) {
    if (message.method === CastMethod.CHAT && quizState.phase === 'answering') {
      const answer = parseQuizAnswer(message.content, quizState.question.options);
      const userId = message.user?.id || message.user?.name;
      if (answer && userId) claimed = submitAnswer(userId, message.user?.name, message.user?.avatar, answer) || claimed;
    } else if (message.method === CastMethod.LIKE) {
      claimed = true;
      handleLike(message);
    } else if (message.method === CastMethod.GIFT) {
      claimed = true;
      handleGift(message);
    }
    if (!quizState.running) break;
  }
  return claimed;
}
