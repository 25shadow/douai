import { reactive } from 'vue';
import { DyCast } from '@/core/dycast';
import { RelayCast } from '@/core/relay';
import { type DyLiveInfo, type DyMessage, type LiveRoom } from '@/core/type';
import { dispatchMessagesToActiveGame, getGameModule, stopAllRunningGames } from '@/game/gameRegistry';
import { quizRuntimeSettings, quizState } from '@/game/quiz/quizStore';
import { loadConfig } from '@/services/configApi';
import { createLiveFeedItems, type LiveFeedItem } from '@/services/liveFeed';
import { announceLiveMessage } from '@/voice/liveAnnouncements';
import {
  canStartLiveSimulation,
  createSimulationMessage,
  defaultLiveSimulationConfig,
  liveSimulationSyncKey,
  normalizeSimulationConfig,
  parseLiveSimulationPacket,
  serializeLiveSimulationPacket,
  isSupportedSimulationGame,
  type LiveSimulationConfig,
  type SimulationGameId
} from '@/services/liveSimulation';

export const liveState = reactive({
  roomId: '',
  relayUrl: '',
  connection: 'offline' as 'offline' | 'connecting' | 'live' | 'error',
  connectionLabel: '未连接',
  relayStatus: 'offline' as 'offline' | 'connecting' | 'live' | 'error',
  liveInfo: null as DyLiveInfo | null,
  audience: 0,
  likes: 0,
  followers: 0,
  totalUsers: 0,
  activityFeed: [] as LiveFeedItem[],
  events: [] as DyMessage[],
  error: ''
});

export const simulationState = reactive({
  active: false,
  gameId: null as SimulationGameId | null,
  elapsedSeconds: 0,
  durationSeconds: 0,
  config: { ...defaultLiveSimulationConfig }
});

let cast: DyCast | undefined;
let relay: RelayCast | undefined;
let simulationTimer: number | undefined;
let simulationSequence = 0;
let simulationStartedQuiz = false;
let liveSnapshot: Pick<typeof liveState, 'liveInfo' | 'audience' | 'likes' | 'followers' | 'totalUsers' | 'activityFeed' | 'events'> | undefined;
const simulationSourceId = globalThis.crypto?.randomUUID?.() || `simulation-${Date.now()}-${Math.random().toString(36).slice(2)}`;
let remoteSnapshot: {
  live: Pick<typeof liveState, 'liveInfo' | 'audience' | 'likes' | 'followers' | 'totalUsers' | 'activityFeed' | 'events'>;
  quiz: typeof quizState;
  settings: typeof quizRuntimeSettings;
} | undefined;

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function readSimulationViewState(): Record<string, unknown> {
  return {
    live: {
      liveInfo: liveState.liveInfo,
      audience: liveState.audience,
      likes: liveState.likes,
      followers: liveState.followers,
      totalUsers: liveState.totalUsers,
      activityFeed: liveState.activityFeed,
      events: liveState.events
    },
    quiz: quizState,
    settings: {
      bank: quizRuntimeSettings.bank,
      theme: quizRuntimeSettings.theme,
      answerTime: quizRuntimeSettings.answerTime,
      gameDurationMinutes: quizRuntimeSettings.gameDurationMinutes,
      likeRules: quizRuntimeSettings.likeRules
    },
    simulation: simulationState
  };
}

function publishSimulationState(active = simulationState.active) {
  try {
    localStorage.setItem(liveSimulationSyncKey, serializeLiveSimulationPacket({
      sourceId: simulationSourceId,
      active,
      state: active ? readSimulationViewState() : undefined
    }));
  } catch (error) {
    console.warn('无法同步模拟直播状态到其他页面', error);
  }
}

function applyRemoteSimulationPacket(raw: string | null) {
  const packet = parseLiveSimulationPacket(raw);
  if (!packet || packet.sourceId === simulationSourceId) return;

  if (!packet.active) {
    if (remoteSnapshot) {
      Object.assign(liveState, remoteSnapshot.live);
      Object.assign(quizState, remoteSnapshot.quiz);
      Object.assign(quizRuntimeSettings, remoteSnapshot.settings);
      remoteSnapshot = undefined;
    }
    simulationState.active = false;
    simulationState.gameId = null;
    return;
  }

  if (!packet.state || !remoteSnapshot) {
    remoteSnapshot = {
      live: cloneJson({
        liveInfo: liveState.liveInfo,
        audience: liveState.audience,
        likes: liveState.likes,
        followers: liveState.followers,
        totalUsers: liveState.totalUsers,
        activityFeed: liveState.activityFeed,
        events: liveState.events
      }),
      quiz: cloneJson(quizState),
      settings: cloneJson(quizRuntimeSettings)
    };
  }

  const state = packet.state as {
    live?: Partial<typeof liveState>;
    quiz?: Partial<typeof quizState>;
    settings?: Partial<typeof quizRuntimeSettings>;
    simulation?: Partial<typeof simulationState>;
  };
  if (state.live) Object.assign(liveState, state.live);
  if (state.quiz) Object.assign(quizState, state.quiz);
  if (state.settings) Object.assign(quizRuntimeSettings, state.settings);
  if (state.simulation) Object.assign(simulationState, state.simulation);
  simulationState.active = true;
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', event => {
    if (event.key === liveSimulationSyncKey) applyRemoteSimulationPacket(event.newValue);
  });
  try {
    applyRemoteSimulationPacket(localStorage.getItem(liveSimulationSyncKey));
  } catch {
    // Storage may be unavailable in restricted browser contexts.
  }
  window.addEventListener('beforeunload', () => {
    if (simulationTimer !== undefined) stopLiveSimulation();
  });
}

function push<T>(list: T[], messages: T[]) {
  list.unshift(...messages);
  list.splice(80);
}

export function parseMetricCount(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
  }
  if (typeof value !== 'string') return 0;
  const cleaned = value.replace(/,/g, '').trim();
  if (!cleaned) return 0;
  const match = cleaned.match(/(\d+(?:\.\d+)?)\s*(亿|万|[wW]|千|[kK])?/);
  if (!match) return 0;
  const base = Number.parseFloat(match[1]);
  if (!Number.isFinite(base) || base <= 0) return 0;
  const unit = match[2];
  const multiplier =
    unit === '亿'
      ? 100000000
      : unit === '万' || unit === 'w' || unit === 'W'
        ? 10000
        : unit === '千' || unit === 'k' || unit === 'K'
          ? 1000
          : 1;
  return Math.round(base * multiplier);
}

export function applyRoomMetrics(room?: LiveRoom | DyLiveInfo | null) {
  if (!room) return;
  const audience = parseMetricCount(room.audienceCount);
  if (audience > 0) liveState.audience = audience;
  const likes = parseMetricCount(room.likeCount);
  if (likes > 0) liveState.likes = likes;
  const followers = parseMetricCount(room.followCount);
  if (followers > 0) liveState.followers = followers;
  const totalUsers = parseMetricCount(room.totalUserCount);
  if (totalUsers > 0) liveState.totalUsers = totalUsers;
}

let pauseOnDisconnectPolicy = true;

export function connectRoom(roomId = liveState.roomId) {
  if (simulationState.active) {
    liveState.error = '请先结束模拟直播，再连接真实直播间';
    return;
  }
  if (!roomId) {
    liveState.error = '请先在运行配置中填写房间号';
    liveState.connection = 'error';
    return;
  }
  disconnectRoom();
  liveState.roomId = roomId;
  liveState.connection = 'connecting';
  liveState.connectionLabel = '正在连接';
  liveState.error = '';
  liveState.audience = 0;
  liveState.likes = 0;
  liveState.followers = 0;
  liveState.totalUsers = 0;
  cast = new DyCast(roomId);
  cast.on('open', (_, info) => {
    liveState.connection = 'live';
    liveState.connectionLabel = '直播中';
    liveState.liveInfo = info || null;
    applyRoomMetrics(info);
    void loadConfig()
      .then(saved => {
        pauseOnDisconnectPolicy = Boolean(saved.pauseOnDisconnect);
        const quizModule = getGameModule('quiz');
        quizModule?.applySavedConfig(saved);
        if (saved.autoStart && quizModule && !quizModule.isRunning()) {
          quizModule.start(saved);
        }
      })
      .catch(() => {
        // Ignore config fetch failure during room open.
      });
  });
  cast.on('message', messages => {
    dispatchMessagesToActiveGame(messages);
    messages.forEach(announceLiveMessage);
    push(liveState.events, messages);
    push(liveState.activityFeed, createLiveFeedItems(messages));
    messages.forEach(message => {
      applyRoomMetrics(message.room);
    });
    if (relay?.isConnected()) relay.send(JSON.stringify(messages));
  });
  cast.on('close', (_, reason) => {
    liveState.connection = 'offline';
    liveState.connectionLabel = reason || '已断开';
    if (pauseOnDisconnectPolicy) {
      stopAllRunningGames();
    }
  });
  cast.on('error', error => {
    liveState.connection = 'error';
    liveState.connectionLabel = '连接异常';
    liveState.error = error.message;
  });
  cast.connect();
}

export function disconnectRoom() {
  const wasConnected = Boolean(cast);
  cast?.close(1000, '控制台断开');
  cast = undefined;
  liveState.connection = 'offline';
  liveState.connectionLabel = '未连接';
  if (wasConnected && pauseOnDisconnectPolicy) {
    stopAllRunningGames();
  }
}

export function startRelay(url = liveState.relayUrl) {
  if (!url) {
    liveState.error = '请先填写 WS 转发地址';
    liveState.relayStatus = 'error';
    return;
  }
  relay?.close(1000, '切换转发地址');
  liveState.relayUrl = url;
  liveState.relayStatus = 'connecting';
  relay = new RelayCast(url);
  relay.on('open', () => { liveState.relayStatus = 'live'; });
  relay.on('close', () => { liveState.relayStatus = 'offline'; });
  relay.on('error', error => {
    liveState.relayStatus = 'error';
    liveState.error = error.message;
  });
  relay.connect();
}

export function stopRelay() {
  relay?.close(1000, '停止转发');
  relay = undefined;
  liveState.relayStatus = 'offline';
}

export function startLiveSimulation(gameId: unknown, input: Partial<LiveSimulationConfig>) {
  if (!isSupportedSimulationGame(gameId) || !canStartLiveSimulation(liveState.connection, simulationState.active)) return false;

  const config = normalizeSimulationConfig(input);
  liveSnapshot = {
    liveInfo: liveState.liveInfo,
    audience: liveState.audience,
    likes: liveState.likes,
    followers: liveState.followers,
    totalUsers: liveState.totalUsers,
    activityFeed: liveState.activityFeed,
    events: liveState.events
  };
  simulationState.active = true;
  simulationState.gameId = gameId;
  simulationState.elapsedSeconds = 0;
  simulationState.durationSeconds = config.durationMinutes * 60;
  simulationState.config = config;
  simulationSequence = 0;
  simulationStartedQuiz = false;
  liveState.liveInfo = {
    roomNum: 'DOUAI-DEMO',
    roomId: 'demo-room',
    uniqueId: 'demo-host',
    avatar: '',
    cover: '',
    nickname: '模拟主播',
    title: '知识问答模拟直播',
    status: 2
  };
  liveState.audience = config.audience;
  liveState.likes = 0;
  liveState.followers = 1280;
  liveState.totalUsers = config.audience * 12;
  liveState.activityFeed = [];
  liveState.events = [];
  const targetGame = getGameModule(gameId);
  if (targetGame && !targetGame.isRunning()) {
    targetGame.start();
    simulationStartedQuiz = targetGame.isRunning();
  }
  publishSimulationState();

  simulationTimer = window.setInterval(() => {
    simulationState.elapsedSeconds += 1;
    liveState.audience = Math.max(1, config.audience + Math.round(Math.sin(simulationState.elapsedSeconds / 8) * config.audience * 0.08));
    liveState.totalUsers = Math.max(liveState.totalUsers, liveState.audience * 12 + simulationState.elapsedSeconds);

    if (simulationState.elapsedSeconds % config.eventIntervalSeconds === 0) {
      const message = createSimulationMessage(simulationSequence++, simulationState.gameId as any);
      if (message.method === 'WebcastLikeMessage') {
        const count = Number(message.content?.match(/\((\d+)\)/)?.[1] || 0);
        liveState.likes += count;
        message.room = { audienceCount: liveState.audience, likeCount: liveState.likes, followCount: liveState.followers, totalUserCount: liveState.totalUsers };
      }
      if (message.method === 'WebcastGiftMessage' && simulationSequence % 6 === 0) liveState.followers += 1;
      dispatchMessagesToActiveGame([message]);
      announceLiveMessage(message);
      push(liveState.events, [message]);
      push(liveState.activityFeed, createLiveFeedItems([message]));
    }

    if (simulationState.elapsedSeconds >= simulationState.durationSeconds) {
      stopLiveSimulation();
      return;
    }
    publishSimulationState();
  }, 1000);
  return true;
}

export function stopLiveSimulation() {
  if (simulationTimer !== undefined) window.clearInterval(simulationTimer);
  simulationTimer = undefined;
  simulationState.active = false;
  simulationState.gameId = null;
  if (simulationStartedQuiz) stopAllRunningGames();
  simulationStartedQuiz = false;
  if (liveSnapshot) {
    Object.assign(liveState, liveSnapshot);
    liveSnapshot = undefined;
  }
  publishSimulationState(false);
}
