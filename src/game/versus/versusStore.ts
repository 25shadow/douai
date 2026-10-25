import { computed, reactive, watch } from 'vue';
import type { DyMessage } from '../../core/type.ts';
import { CastMethod } from '../../core/type.ts';
import { speak, clearVoiceOwner } from '../../voice/voiceManager.ts';
import { soundEffects } from '../../utils/soundEffects.ts';
import { quizQuestionBanks } from '../quiz/questionBanks.ts';
import { parseLikeCount } from '../quiz/quizRules.ts';

export type VersusThemeId = 'tug' | 'mecha' | 'arcade' | 'colosseum';
export type VersusOption = 'A' | 'B' | 'C' | 'D';

export interface VersusThemeMeta {
  id: VersusThemeId;
  name: string;
  badge: string;
  desc: string;
}

export const versusThemes: VersusThemeMeta[] = [
  { id: 'tug', name: '能量拔河巨力流', badge: '经典拔河', desc: '中央巨型等离子拉扯条，红蓝双方角力碰撞，双列荣誉贡献榜' },
  { id: 'mecha', name: '赛博要塞机甲流', badge: '机甲双塔', desc: '双塔要塞基地血条轰击，扣1发射红光火炮，扣2发射离子激光' },
  { id: 'arcade', name: '像素街机格斗流', badge: '拳皇血条', desc: '街机复古格斗血条与KO终结，像素HIT打击感与名人堂' },
  { id: 'colosseum', name: '巅峰角斗擂台流', badge: '聚光拳击', desc: '红角蓝角重拳出击，观众欢呼化身火花连击，拳王金腰带' }
];

export interface VersusQuestion {
  title: string;
  options: Record<VersusOption, string>;
  answer: VersusOption;
}

export interface VersusConfig {
  theme: VersusThemeId;
  targetScore: number;
  redTeamName: string;
  blueTeamName: string;
  redCommand: string;
  blueCommand: string;
  bank: string;
  questionCount: number;
  answerTime: number;
  revealTime: number;
  pointsPerCorrect: number;
  giftMultiplier: number;
  likeThreshold: number;
  voice: boolean;
  readQuestionVoice: boolean;
  autoNext: boolean;
  autoRematch: boolean;
  customQuestions?: VersusQuestion[];
}

export const defaultVersusConfig: VersusConfig = {
  theme: 'tug',
  targetScore: 200,
  redTeamName: '烈焰红队',
  blueTeamName: '极光蓝队',
  redCommand: '1',
  blueCommand: '2',
  bank: '基础知识题库',
  questionCount: 10,
  answerTime: 25,
  revealTime: 4,
  pointsPerCorrect: 10,
  giftMultiplier: 10,
  likeThreshold: 300,
  voice: true,
  readQuestionVoice: true,
  autoNext: true,
  autoRematch: true,
  customQuestions: []
};

const VERSUS_CONFIG_STORAGE_KEY = 'douai:versus-runtime-config-v1';

function loadSavedVersusConfig(): VersusConfig {
  if (typeof window === 'undefined') return { ...defaultVersusConfig };
  try {
    const raw = window.localStorage.getItem(VERSUS_CONFIG_STORAGE_KEY);
    if (raw) return { ...defaultVersusConfig, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...defaultVersusConfig };
}

export const versusRuntimeSettings = reactive<VersusConfig>(loadSavedVersusConfig());

export interface VersusPlayer {
  id: string;
  name: string;
  avatar?: string;
  team: 'red' | 'blue';
  score: number;
  correctCount: number;
}

export interface VersusRecentHit {
  id: string;
  name: string;
  avatar?: string;
  team: 'red' | 'blue';
  choice: string;
  pts: number;
  isCorrect?: boolean;
  giftName?: string;
}

export interface VersusState {
  running: boolean;
  phase: 'answering' | 'revealing' | 'ended';
  status: string;
  questionIndex: number;
  totalQuestions: number;
  question: VersusQuestion | null;
  timeLeft: number;
  redScore: number;
  blueScore: number;
  targetScore: number;
  totalLikes: number;
  eliminatedOptions: VersusOption[];
  winner: null | 'red' | 'blue';
  players: Record<string, VersusPlayer>;
  recentHits: VersusRecentHit[];
}

export const versusState = reactive<VersusState>({
  running: false,
  phase: 'answering',
  status: '待机中',
  questionIndex: 0,
  totalQuestions: 10,
  question: null,
  timeLeft: 25,
  redScore: 0,
  blueScore: 0,
  targetScore: versusRuntimeSettings.targetScore,
  totalLikes: 0,
  eliminatedOptions: [],
  winner: null,
  players: {},
  recentHits: []
});

// Built-in question lists
export const versusBuiltinBanks: Record<string, VersusQuestion[]> = {
  ...quizQuestionBanks,
  '阵营对抗精选题库': [
    { title: '哪颗行星因为表面覆盖氧化铁而呈现赤红色？', options: { A: '水星', B: '金星', C: '火星', D: '木星' }, answer: 'C' },
    { title: '被称为“百戏之祖”的中国传统戏曲剧种是？', options: { A: '京剧', B: '昆曲', C: '越剧', D: '黄梅戏' }, answer: 'B' },
    { title: '地球表面积约有多少比例被海洋所覆盖？', options: { A: '约51%', B: '约61%', C: '约71%', D: '约81%' }, answer: 'C' },
    { title: '国际象棋棋盘上总共有多少个格子？', options: { A: '32个', B: '64个', C: '81个', D: '100个' }, answer: 'B' },
    { title: '下列哪个物理单位是用来衡量电阻大小的？', options: { A: '安培', B: '伏特', C: '欧姆', D: '瓦特' }, answer: 'C' },
    { title: '我国最大的淡水湖是哪一个？', options: { A: '青海湖', B: '鄱阳湖', C: '洞庭湖', D: '太湖' }, answer: 'B' },
    { title: '人体中最大且最重的一块骨头是？', options: { A: '股骨(大腿骨)', B: '肱骨', C: '肋骨', D: '颅骨' }, answer: 'A' },
    { title: '光在真空中的传播速度约为每秒多少万公里？', options: { A: '15万', B: '20万', C: '30万', D: '50万' }, answer: 'C' }
  ]
};

// Available banks helper
export const availableVersusBankNames = computed(() => {
  const builtins = Object.keys(versusBuiltinBanks);
  const customs = versusRuntimeSettings.customQuestions?.length ? ['自定义题库'] : [];
  return [...new Set([...builtins, ...customs])];
});

let timerHandle: ReturnType<typeof setInterval> | null = null;
let currentQuestionQueue: VersusQuestion[] = [];

function clearVersusTimer() {
  if (timerHandle) {
    clearInterval(timerHandle);
    timerHandle = null;
  }
}

function getActiveQuestions(): VersusQuestion[] {
  if (versusRuntimeSettings.bank === '自定义题库' && versusRuntimeSettings.customQuestions?.length) {
    return [...versusRuntimeSettings.customQuestions];
  }
  const bank = versusBuiltinBanks[versusRuntimeSettings.bank] || versusBuiltinBanks['基础知识题库'];
  return bank && bank.length ? [...bank] : versusBuiltinBanks['基础知识题库'];
}

function shuffleQuestions(list: VersusQuestion[]): VersusQuestion[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Cross-window BroadcastChannel and Storage Sync
const VERSUS_SYNC_STORAGE_KEY = 'douai:versus-live-state-v1';
const VERSUS_SYNC_CHANNEL_NAME = 'douai:versus-live-sync-v1';

const isObsMirrorWindow =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('page') === 'obs';

let syncChannel: BroadcastChannel | null = null;
let isApplyingRemote = false;

interface VersusSyncSnapshot {
  state: typeof versusState;
  settings: typeof versusRuntimeSettings;
  updatedAt: number;
}

function publishVersusSync() {
  if (typeof window === 'undefined' || isObsMirrorWindow || isApplyingRemote) return;
  try {
    const snap: VersusSyncSnapshot = {
      state: JSON.parse(JSON.stringify(versusState)),
      settings: JSON.parse(JSON.stringify(versusRuntimeSettings)),
      updatedAt: Date.now()
    };
    window.localStorage.setItem(VERSUS_SYNC_STORAGE_KEY, JSON.stringify(snap));
    syncChannel?.postMessage({ type: 'SYNC_VERSUS', payload: snap });
  } catch { /* ignore */ }
}

function applyVersusSync(snap: VersusSyncSnapshot | null | undefined) {
  if (!snap || !snap.state) return;
  isApplyingRemote = true;
  try {
    Object.assign(versusState, snap.state);
    if (snap.settings) {
      Object.assign(versusRuntimeSettings, snap.settings);
    }
  } finally {
    isApplyingRemote = false;
  }
}

if (typeof window !== 'undefined') {
  try {
    if ('BroadcastChannel' in window) {
      syncChannel = new BroadcastChannel(VERSUS_SYNC_CHANNEL_NAME);
      syncChannel.addEventListener('message', (ev: MessageEvent) => {
        if (ev.data?.type === 'SYNC_VERSUS' && isObsMirrorWindow && ev.data.payload) {
          applyVersusSync(ev.data.payload);
        } else if (ev.data?.type === 'REQUEST_VERSUS' && !isObsMirrorWindow) {
          publishVersusSync();
        }
      });
    }
  } catch {
    syncChannel = null;
  }

  if (isObsMirrorWindow) {
    try {
      const raw = window.localStorage.getItem(VERSUS_SYNC_STORAGE_KEY);
      if (raw) applyVersusSync(JSON.parse(raw));
    } catch { /* ignore */ }
    window.addEventListener('storage', (ev) => {
      if (ev.key === VERSUS_SYNC_STORAGE_KEY && ev.newValue) {
        try { applyVersusSync(JSON.parse(ev.newValue)); } catch { /* ignore */ }
      }
    });
    syncChannel?.postMessage({ type: 'REQUEST_VERSUS' });
  } else {
    publishVersusSync();
    watch([versusState, versusRuntimeSettings], () => publishVersusSync(), { deep: true });
  }
}

export function updateVersusConfig(partial: Partial<VersusConfig>) {
  Object.assign(versusRuntimeSettings, partial);
  versusState.targetScore = versusRuntimeSettings.targetScore;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(VERSUS_CONFIG_STORAGE_KEY, JSON.stringify(versusRuntimeSettings));
    } catch { /* ignore */ }
  }
  publishVersusSync();
}

export function setVersusTheme(themeId: VersusThemeId) {
  updateVersusConfig({ theme: themeId });
}

export function startVersus(nextConfig?: Partial<VersusConfig>) {
  clearVoiceOwner('versus');
  clearVersusTimer();

  if (nextConfig) {
    updateVersusConfig(nextConfig);
  }

  versusState.running = true;
  versusState.status = '阵营答题对抗中';
  versusState.redScore = 0;
  versusState.blueScore = 0;
  versusState.targetScore = versusRuntimeSettings.targetScore;
  versusState.winner = null;
  versusState.players = {};
  versusState.recentHits = [];
  versusState.totalLikes = 0;
  versusState.eliminatedOptions = [];
  versusState.questionIndex = 0;

  const pool = getActiveQuestions();
  currentQuestionQueue = shuffleQuestions(pool);
  versusState.totalQuestions = Math.min(
    versusRuntimeSettings.questionCount || currentQuestionQueue.length,
    currentQuestionQueue.length
  );

  loadNextQuestion();

  if (versusRuntimeSettings.voice) {
    speak(
      `阵营答题对抗赛正式开启！发送 ${versusRuntimeSettings.redCommand} 加入 ${versusRuntimeSettings.redTeamName}，发送 ${versusRuntimeSettings.blueCommand} 加入 ${versusRuntimeSettings.blueTeamName}。公屏抢答 A B C D 赢取阵营积分！`,
      { scene: 'system', owner: 'versus' }
    );
  }
}

export function stopVersus() {
  clearVersusTimer();
  versusState.running = false;
  versusState.status = '对抗已结束';
  clearVoiceOwner('versus');
  publishVersusSync();
}

function loadNextQuestion() {
  clearVersusTimer();

  if (versusState.winner) {
    versusState.running = false;
    versusState.phase = 'ended';
    return;
  }

  // Check if round limit reached
  if (
    versusRuntimeSettings.questionCount > 0 &&
    versusState.questionIndex >= versusState.totalQuestions
  ) {
    finishVersusBattle();
    return;
  }

  if (currentQuestionQueue.length === 0) {
    currentQuestionQueue = shuffleQuestions(getActiveQuestions());
  }

  const nextQ = currentQuestionQueue.shift() || {
    title: '太阳系中最大的行星是哪一颗？',
    options: { A: '地球', B: '木星', C: '火星', D: '金星' },
    answer: 'B'
  };

  versusState.questionIndex += 1;
  versusState.question = nextQ;
  versusState.phase = 'answering';
  versusState.timeLeft = versusRuntimeSettings.answerTime || 25;
  versusState.eliminatedOptions = [];
  versusState.status = `第 ${versusState.questionIndex} 题抢答中`;

  if (versusRuntimeSettings.voice && versusRuntimeSettings.readQuestionVoice) {
    const optText = `A: ${nextQ.options.A}，B: ${nextQ.options.B}，C: ${nextQ.options.C}，D: ${nextQ.options.D}`;
    speak(`请听第 ${versusState.questionIndex} 题：${nextQ.title}。${optText}`, {
      scene: 'system',
      owner: 'versus'
    });
  }

  startCountdown();
  publishVersusSync();
}

function startCountdown() {
  clearVersusTimer();
  timerHandle = setInterval(() => {
    if (!versusState.running) {
      clearVersusTimer();
      return;
    }

    if (versusState.phase === 'answering') {
      if (versusState.timeLeft > 1) {
        versusState.timeLeft -= 1;
      } else {
        versusState.timeLeft = 0;
        revealAnswer();
      }
    } else if (versusState.phase === 'revealing') {
      if (versusState.timeLeft > 1) {
        versusState.timeLeft -= 1;
      } else {
        versusState.timeLeft = 0;
        if (versusRuntimeSettings.autoNext && !versusState.winner) {
          loadNextQuestion();
        } else {
          clearVersusTimer();
        }
      }
    }
  }, 1000);
}

function revealAnswer() {
  versusState.phase = 'revealing';
  versusState.timeLeft = versusRuntimeSettings.revealTime || 4;
  const ans = versusState.question?.answer || 'A';
  const ansContent = versusState.question ? versusState.question.options[ans] : '';
  versusState.status = `正确答案是：${ans} (${ansContent})`;

  try { soundEffects.playCorrect(); } catch { /* ignore */ }

  if (versusRuntimeSettings.voice) {
    speak(`答题结束！正确答案是 ${ans}，${ansContent}。`, {
      scene: 'system',
      owner: 'versus'
    });
  }

  checkLeadAndVictory();
  publishVersusSync();
}

function finishVersusBattle() {
  clearVersusTimer();
  versusState.phase = 'ended';
  versusState.running = false;

  if (versusState.redScore > versusState.blueScore) {
    versusState.winner = 'red';
    versusState.status = `${versusRuntimeSettings.redTeamName} 获胜！`;
    if (versusRuntimeSettings.voice) {
      speak(`对决结束！恭喜 ${versusRuntimeSettings.redTeamName} 以 ${versusState.redScore} 分比 ${versusState.blueScore} 分战胜对手，赢得本场对抗总冠军！`, { scene: 'system', owner: 'versus' });
    }
  } else if (versusState.blueScore > versusState.redScore) {
    versusState.winner = 'blue';
    versusState.status = `${versusRuntimeSettings.blueTeamName} 获胜！`;
    if (versusRuntimeSettings.voice) {
      speak(`对决结束！恭喜 ${versusRuntimeSettings.blueTeamName} 以 ${versusState.blueScore} 分比 ${versusState.redScore} 分战胜对手，赢得本场对抗总冠军！`, { scene: 'system', owner: 'versus' });
    }
  } else {
    versusState.winner = null;
    versusState.status = '双方势均力敌，平局！';
    if (versusRuntimeSettings.voice) {
      speak(`全场对决结束！双方以 ${versusState.redScore} 分平分秋色，握手言和！`, { scene: 'system', owner: 'versus' });
    }
  }
  publishVersusSync();
}

function checkLeadAndVictory() {
  if (versusState.redScore >= versusState.targetScore) {
    versusState.winner = 'red';
    finishVersusBattle();
  } else if (versusState.blueScore >= versusState.targetScore) {
    versusState.winner = 'blue';
    finishVersusBattle();
  }
}

export function nextVersusQuestion() {
  if (!versusState.running) return;
  loadNextQuestion();
}

export function parsePlayerAnswer(text: string): VersusOption | null {
  const upper = text.trim().toUpperCase();
  const directMatch = upper.match(/^(?:我)?(?:选择|选|答案是|答案|选的是)?\s*([ABCD])\1{0,4}\s*(?:选项|吧|呀|啊|哦|啦)?[。.!！~～?？]*$/);
  if (directMatch?.[1]) {
    return directMatch[1] as VersusOption;
  }
  // Check composite like 1A, 2B
  const comboMatch = upper.match(/^[12]\s*([ABCD])$/);
  if (comboMatch?.[1]) {
    return comboMatch[1] as VersusOption;
  }
  return null;
}

export function handleVersusMessages(messages: DyMessage[]) {
  if (!versusState.running || versusState.winner) return;

  const redCmd = (versusRuntimeSettings.redCommand || '1').trim().toLowerCase();
  const blueCmd = (versusRuntimeSettings.blueCommand || '2').trim().toLowerCase();
  const giftMult = versusRuntimeSettings.giftMultiplier || 10;
  const ptsPerCorrect = versusRuntimeSettings.pointsPerCorrect || 10;

  for (const msg of messages) {
    if (msg.method === CastMethod.CHAT) {
      const text = (msg.content || '').trim();
      const lower = text.toLowerCase();
      const userId = msg.user?.id || msg.user?.name;
      if (!userId) continue;

      let player = versusState.players[userId];

      // 1. Check if joining/switching faction
      let chosenTeam: 'red' | 'blue' | null = null;

      if (lower === redCmd || lower === `${redCmd}${redCmd}` || lower === '红' || lower.includes(versusRuntimeSettings.redTeamName.toLowerCase())) {
        chosenTeam = 'red';
      } else if (lower === blueCmd || lower === `${blueCmd}${blueCmd}` || lower === '蓝' || lower.includes(versusRuntimeSettings.blueTeamName.toLowerCase())) {
        chosenTeam = 'blue';
      } else if (lower.startsWith(redCmd) && ['a', 'b', 'c', 'd'].includes(lower.slice(redCmd.length).trim())) {
        chosenTeam = 'red';
      } else if (lower.startsWith(blueCmd) && ['a', 'b', 'c', 'd'].includes(lower.slice(blueCmd.length).trim())) {
        chosenTeam = 'blue';
      }

      if (chosenTeam) {
        if (!player) {
          player = {
            id: userId,
            name: msg.user?.name || '观众',
            avatar: msg.user?.avatar,
            team: chosenTeam,
            score: 0,
            correctCount: 0
          };
          versusState.players[userId] = player;
        } else {
          player.team = chosenTeam;
        }
      }

      // 2. Check if answering question
      if (versusState.phase === 'answering' && versusState.question) {
        const option = parsePlayerAnswer(text);
        if (option) {
          // If player has no faction yet, assign based on prefix or default to balanced team
          if (!player) {
            const assignedTeam = lower.startsWith(blueCmd) ? 'blue' : (lower.startsWith(redCmd) ? 'red' : (versusState.redScore > versusState.blueScore ? 'blue' : 'red'));
            player = {
              id: userId,
              name: msg.user?.name || '观众',
              avatar: msg.user?.avatar,
              team: assignedTeam,
              score: 0,
              correctCount: 0
            };
            versusState.players[userId] = player;
          }

          const isCorrect = option === versusState.question.answer;
          if (isCorrect) {
            player.score += ptsPerCorrect;
            player.correctCount += 1;

            if (player.team === 'red') {
              versusState.redScore += ptsPerCorrect;
            } else {
              versusState.blueScore += ptsPerCorrect;
            }

            try { soundEffects.playCorrect(); } catch { /* ignore */ }

            versusState.recentHits.unshift({
              id: `${userId}-${Date.now()}-${Math.random()}`,
              name: player.name,
              avatar: player.avatar,
              team: player.team,
              choice: `答对 ${option}`,
              pts: ptsPerCorrect,
              isCorrect: true
            });
            versusState.recentHits.splice(8);

            checkLeadAndVictory();
          } else {
            versusState.recentHits.unshift({
              id: `${userId}-${Date.now()}-${Math.random()}`,
              name: player.name,
              avatar: player.avatar,
              team: player.team,
              choice: `选择 ${option}`,
              pts: 0,
              isCorrect: false
            });
            versusState.recentHits.splice(8);
          }
        }
      }
    } else if (msg.method === CastMethod.LIKE) {
      // Like handling: Accumulate likes and trigger elimination
      const count = parseLikeCount(msg.content);
      versusState.totalLikes += count;

      const threshold = versusRuntimeSettings.likeThreshold || 300;
      if (
        versusState.phase === 'answering' &&
        versusState.question &&
        versusState.totalLikes >= threshold &&
        versusState.eliminatedOptions.length < 2
      ) {
        const wrongOpts = (['A', 'B', 'C', 'D'] as VersusOption[]).filter(
          opt => opt !== versusState.question?.answer && !versusState.eliminatedOptions.includes(opt)
        );
        if (wrongOpts.length) {
          const elim = wrongOpts[Math.floor(Math.random() * wrongOpts.length)];
          versusState.eliminatedOptions.push(elim);
          versusState.totalLikes = 0; // reset for next milestone
          if (versusRuntimeSettings.voice) {
            speak(`全员点赞助力成功！已排除一个错误选项 ${elim}！`, { scene: 'system', owner: 'versus' });
          }
        }
      }
    } else if (msg.method === CastMethod.GIFT && msg.gift) {
      // Gift handling: direct faction score boost + auto-answer
      const userId = msg.user?.id || msg.user?.name;
      if (!userId) continue;
      const count = Math.max(1, Number(msg.gift.count) || 1);
      let player = versusState.players[userId];
      const team = player ? player.team : (versusState.redScore > versusState.blueScore ? 'blue' : 'red');
      if (!player) {
        player = {
          id: userId,
          name: msg.user?.name || '好心观众',
          avatar: msg.user?.avatar,
          team,
          score: 0,
          correctCount: 0
        };
        versusState.players[userId] = player;
      }

      const bonus = count * giftMult;
      if (team === 'red') versusState.redScore += bonus;
      else versusState.blueScore += bonus;

      player.score += bonus;
      try { soundEffects.playGift(); } catch { /* ignore */ }

      versusState.recentHits.unshift({
        id: `${userId}-${Date.now()}-${Math.random()}`,
        name: player.name,
        avatar: player.avatar,
        team,
        choice: `送出 ${msg.gift.name || '礼物'}`,
        pts: bonus,
        giftName: msg.gift.name
      });
      versusState.recentHits.splice(8);

      checkLeadAndVictory();
    }
  }
}

// Live simulation functions for the config deck
export function simulateVersusAnswer(team: 'red' | 'blue', isCorrect = true) {
  if (!versusState.running) return;
  const mockNames = team === 'red' ? ['烈焰战神', '赤羽侠客', '红莲之火'] : ['极光幻影', '寒冰射手', '沧海龙王'];
  const name = mockNames[Math.floor(Math.random() * mockNames.length)];
  const userId = `mock-${team}-${Date.now()}`;
  const pts = isCorrect ? (versusRuntimeSettings.pointsPerCorrect || 10) : 0;
  const choice = isCorrect ? (versusState.question?.answer || 'B') : 'D';

  const player = versusState.players[userId] || {
    id: userId,
    name,
    team,
    score: 0,
    correctCount: 0
  };
  player.score += pts;
  if (isCorrect) {
    player.correctCount += 1;
    if (team === 'red') versusState.redScore += pts;
    else versusState.blueScore += pts;
    try { soundEffects.playCorrect(); } catch { /* ignore */ }
  }
  versusState.players[userId] = player;

  versusState.recentHits.unshift({
    id: `${userId}-${Date.now()}`,
    name,
    team,
    choice: `${isCorrect ? '答对' : '选择'} ${choice}`,
    pts,
    isCorrect
  });
  versusState.recentHits.splice(8);

  checkLeadAndVictory();
}

export function simulateVersusGift(team: 'red' | 'blue', count = 1) {
  if (!versusState.running) return;
  const bonus = count * (versusRuntimeSettings.giftMultiplier || 10);
  const name = team === 'red' ? '红方大哥' : '蓝方大哥';
  const userId = `mock-gift-${team}-${Date.now()}`;

  if (team === 'red') versusState.redScore += bonus;
  else versusState.blueScore += bonus;

  try { soundEffects.playGift(); } catch { /* ignore */ }

  versusState.recentHits.unshift({
    id: `${userId}-${Date.now()}`,
    name,
    team,
    choice: `送出超级火箭 x${count}`,
    pts: bonus,
    giftName: '超级火箭'
  });
  versusState.recentHits.splice(8);

  checkLeadAndVictory();
}

export function simulateVersusLike() {
  if (!versusState.running) return;
  versusState.totalLikes += 100;
  const threshold = versusRuntimeSettings.likeThreshold || 300;
  if (
    versusState.phase === 'answering' &&
    versusState.question &&
    versusState.totalLikes >= threshold &&
    versusState.eliminatedOptions.length < 2
  ) {
    const wrongOpts = (['A', 'B', 'C', 'D'] as VersusOption[]).filter(
      opt => opt !== versusState.question?.answer && !versusState.eliminatedOptions.includes(opt)
    );
    if (wrongOpts.length) {
      const elim = wrongOpts[0];
      versusState.eliminatedOptions.push(elim);
      versusState.totalLikes = 0;
    }
  }
}
