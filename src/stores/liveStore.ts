import { computed, reactive } from 'vue';
import { DyCast } from '@/core/dycast';
import { RelayCast } from '@/core/relay';
import { type DyLiveInfo, type DyMessage, type LiveRoom } from '@/core/type';
import { getGameModule, stopAllRunningGames, activeGameModule } from '@/game/gameRegistry';
import { createInteractionRouter } from '@/game/interactionRouter';
import { quizRuntimeSettings, quizState } from '@/game/quiz/quizStore';
import { loadConfig, type GameInteractionConfig } from '@/services/configApi';
import { createLiveFeedItems, type LiveFeedItem } from '@/services/liveFeed';
import { announceAiHostMessage, announceLiveMessage, configureAiInteraction } from '@/voice/liveAnnouncements';
import { speak } from '@/voice/voiceManager';
import {
  canStartLiveSimulation,
  createSimulationScenario,
  defaultLiveSimulationConfig,
  liveSimulationSyncKey,
  normalizeSimulationConfig,
  parseLiveSimulationPacket,
  serializeLiveSimulationPacket,
  isSupportedSimulationGame,
  type LiveSimulationConfig,
  type SimulationGameId,
  type SimulationMode,
  type SimulationEvent
} from '@/services/liveSimulation';
import { createSimulationRunner, type SimulationRunner } from '@/services/simulationRunner';
import { createManualInteractionQueue, type ManualInteractionQueue } from '@/services/manualInteractionQueue';

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
  mode: 'demo' as SimulationMode,
  status: 'idle' as 'idle' | 'ready' | 'running' | 'paused' | 'finished' | 'error',
  elapsedSeconds: 0,
  durationSeconds: 0,
  config: { ...defaultLiveSimulationConfig },
  cursor: 0,
  timeline: [] as SimulationEvent[],
  history: [] as SimulationEvent[],
  queue: [] as SimulationEvent[]
});

export const simulationStatus = computed(() => simulationState.status);
export const simulationMode = computed(() => simulationState.mode);
export const simulationTimeline = computed(() => simulationState.timeline);

let cast: DyCast | undefined;
let relay: RelayCast | undefined;
let simulationTimer: number | undefined;
let simulationRunner: SimulationRunner | undefined;
const manualQueue: ManualInteractionQueue = createManualInteractionQueue();
let simulationSequence = 0;
let simulationStartedQuiz = false;
let liveSessionSequence = 0;
let liveSessionId = 'offline';
let liveSnapshot: Pick<typeof liveState, 'liveInfo' | 'audience' | 'likes' | 'followers' | 'totalUsers' | 'activityFeed' | 'events'> | undefined;
const simulationSourceId = globalThis.crypto?.randomUUID?.() || `simulation-${Date.now()}-${Math.random().toString(36).slice(2)}`;
let remoteSnapshot: {
  live: Pick<typeof liveState, 'liveInfo' | 'audience' | 'likes' | 'followers' | 'totalUsers' | 'activityFeed' | 'events'>;
  quiz: typeof quizState;
  settings: typeof quizRuntimeSettings;
} | undefined;

const interactionRouter = createInteractionRouter({
  getActiveGame: () => activeGameModule.value,
  getGlobalChatPolicy: () => 'ignore',
  submitSpeechIntent: intent => speak(intent.text, {
    scene: (intent.scene as 'system' | 'gift' | 'like' | 'join' | 'follow' | 'share' | 'quiz' | 'answer') || 'system',
    owner: intent.owner
  }),
  runAiHost: event => announceAiHostMessage(event.message),
  getGameInteractionConfig: () => gameInteractionConfig,
  now: () => Date.now()
});

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
let gameInteractionConfig: GameInteractionConfig | undefined;

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
  liveSessionId = `live-${++liveSessionSequence}`;
  interactionRouter.clear();
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
        configureAiInteraction(saved.aiConfig);
        gameInteractionConfig = saved.gameInteractionConfig;
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
    void (async () => {
      for (const message of messages) {
        const result = await interactionRouter.routeEvent({
          eventId: message.id,
          source: 'live',
          receivedAt: Date.now(),
          sessionId: liveSessionId,
          message
        });
        if (result?.globalEventRouted === true
          || (!result?.claimed && !result?.chatRouted && !activeGameModule.value)) {
          announceLiveMessage(message);
        }
      }
    })();
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
  liveSessionId = `offline-${++liveSessionSequence}`;
  interactionRouter.clear();
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

function simulationEventToMessage(event: SimulationEvent): DyMessage {
  const payload = event.payload || {};
  const user = {
    id: String(payload.userId || `demo-user-${simulationSequence + 1}`),
    name: String(payload.name || '观众'),
    avatar: typeof payload.avatar === 'string' ? payload.avatar : undefined
  };
  if (event.type === 'like') {
    return { id: event.id, method: 'WebcastLikeMessage' as DyMessage['method'], user, content: `为主播点赞了(${Number(payload.count || 1)})` };
  }
  if (event.type === 'gift') {
    return {
      id: event.id,
      method: 'WebcastGiftMessage' as DyMessage['method'],
      user,
      gift: {
        name: String(payload.giftName || '小心心'),
        price: Number(payload.price || 1),
        count: Number(payload.count || 1),
        repeatEnd: 0,
        icon: typeof payload.icon === 'string' ? payload.icon : undefined
      }
    };
  }
  if (event.type === 'join') {
    return { id: event.id, method: 'WebcastMemberMessage' as DyMessage['method'], user, content: '进入了直播间' };
  }
  if (event.type === 'follow') {
    return { id: event.id, method: 'WebcastSocialMessage' as DyMessage['method'], user, content: '关注了主播' };
  }
  return {
    id: event.id,
    method: 'WebcastChatMessage' as DyMessage['method'],
    user,
    content: String(payload.content || event.label || '模拟互动')
  };
}

function syncSimulationSnapshot() {
  const snapshot = simulationRunner?.snapshot();
  if (!snapshot) return;
  simulationState.status = snapshot.status;
  simulationState.elapsedSeconds = snapshot.elapsedSeconds;
  simulationState.durationSeconds = snapshot.scenario.durationSeconds;
  simulationState.cursor = snapshot.cursor;
  simulationState.timeline = snapshot.scenario.events;
}

function dispatchSimulationEvent(event: SimulationEvent) {
  event.status = 'dispatched';
  simulationState.history.unshift(event);
  simulationState.history.splice(50);
  const message = simulationEventToMessage(event);
  if (message.method === 'WebcastLikeMessage') {
    const count = Number(message.content?.match(/\((\d+)\)/)?.[1] || 0);
    liveState.likes += count;
    message.room = { audienceCount: liveState.audience, likeCount: liveState.likes, followCount: liveState.followers, totalUserCount: liveState.totalUsers };
  }
  if (message.method === 'WebcastGiftMessage' && Number(message.gift?.price || 0) >= 10) liveState.followers += 1;
  if (message.method === 'WebcastMemberMessage') liveState.totalUsers += 1;
  void interactionRouter.routeEvent({
    eventId: message.id,
    source: 'simulation',
    receivedAt: Date.now(),
    sessionId: liveSessionId,
    message
  }).then(result => {
    event.status = result?.claimed || result?.chatRouted ? 'claimed' : 'ignored';
    event.result = {
      claimed: Boolean(result?.claimed),
      game: activeGameModule.value?.id,
      speechTriggered: Boolean(result?.speechIntents?.length || result?.chatRouted)
    };
    if (result?.globalEventRouted === true
      || (!result?.claimed && !result?.chatRouted && !activeGameModule.value)) {
      announceLiveMessage(message);
    }
  });
  push(liveState.events, [message]);
  push(liveState.activityFeed, createLiveFeedItems([message]));
  simulationSequence += 1;
}

export function startLiveSimulation(gameId: unknown, input: Partial<LiveSimulationConfig>) {
  if (!isSupportedSimulationGame(gameId) || !canStartLiveSimulation(liveState.connection, simulationState.active)) return false;

  const config = normalizeSimulationConfig(input);
  const mode = config.mode || 'demo';
  const scenario = createSimulationScenario(gameId, config, mode);
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
  simulationState.mode = mode;
  simulationState.status = 'ready';
  simulationState.elapsedSeconds = 0;
  simulationState.durationSeconds = scenario.durationSeconds;
  simulationState.config = config;
  simulationState.history = [];
  manualQueue.clear();
  simulationState.queue = [];
  simulationSequence = 0;
  liveSessionId = `simulation-${++liveSessionSequence}`;
  interactionRouter.clear();
  simulationStartedQuiz = false;
  liveState.liveInfo = {
    roomNum: 'DOUAI-DEMO',
    roomId: 'demo-room',
    uniqueId: 'demo-host',
    avatar: '',
    cover: '',
    nickname: '模拟主播',
    title: mode === 'qa' ? '知识问答验收演练' : mode === 'rehearsal' ? '知识问答彩排演练' : '知识问答模拟直播',
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
  simulationRunner = createSimulationRunner(scenario, event => dispatchSimulationEvent(event));
  simulationRunner.start();
  if (mode === 'qa') simulationRunner.pause();
  syncSimulationSnapshot();
  publishSimulationState();

  simulationTimer = window.setInterval(() => {
    if (!simulationRunner || simulationState.status !== 'running') return;
    simulationRunner.tick(1);
    liveState.audience = Math.max(1, config.audience + Math.round(Math.sin(simulationState.elapsedSeconds / 8) * config.audience * 0.08));
    liveState.totalUsers = Math.max(liveState.totalUsers, liveState.audience * 12 + simulationState.elapsedSeconds);
    syncSimulationSnapshot();
    if (simulationRunner?.snapshot().status === 'finished') stopLiveSimulation();
    else publishSimulationState();
  }, 1000);
  return true;
}

export function pauseLiveSimulation() {
  simulationRunner?.pause();
  syncSimulationSnapshot();
  publishSimulationState();
}

export function resumeLiveSimulation() {
  simulationRunner?.resume();
  syncSimulationSnapshot();
  publishSimulationState();
}

export function stepLiveSimulation() {
  const event = simulationRunner?.step();
  syncSimulationSnapshot();
  publishSimulationState();
  return event;
}

export function injectSimulationEvent(event: Omit<SimulationEvent, 'id' | 'executed'> & { id?: string }) {
  if (!simulationRunner || !simulationState.active) return undefined;
  const manualEvent = {
    ...event,
    id: event.id || `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    source: 'manual' as const,
    status: 'queued' as const,
    executed: false
  };
  dispatchSimulationEvent(manualEvent);
  publishSimulationState();
  return manualEvent;
}

function syncManualQueue() {
  simulationState.queue = manualQueue.snapshot();
  publishSimulationState();
}

export function queueSimulationEvent(event: Omit<SimulationEvent, 'id' | 'executed'> & { id?: string }) {
  if (!simulationRunner || !simulationState.active) return undefined;
  const queued = manualQueue.enqueue({
    ...event,
    id: event.id || `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    source: 'manual',
    status: 'queued',
    executed: false
  });
  syncManualQueue();
  return queued;
}

export function dispatchNextSimulationEvent() {
  const event = manualQueue.dequeue();
  if (!event) return undefined;
  dispatchSimulationEvent({ ...event, status: 'dispatched' });
  syncManualQueue();
  return event;
}

export function clearSimulationQueue() {
  manualQueue.clear();
  syncManualQueue();
}

export function stopLiveSimulation() {
  if (simulationTimer !== undefined) window.clearInterval(simulationTimer);
  simulationTimer = undefined;
  simulationRunner?.stop();
  simulationRunner = undefined;
  liveSessionId = `offline-${++liveSessionSequence}`;
  interactionRouter.clear();
  simulationState.active = false;
  simulationState.status = 'idle';
  simulationState.gameId = null;
  simulationState.timeline = [];
  simulationState.cursor = 0;
  simulationState.history = [];
  manualQueue.clear();
  simulationState.queue = [];
  if (simulationStartedQuiz) stopAllRunningGames();
  simulationStartedQuiz = false;
  if (liveSnapshot) {
    Object.assign(liveState, liveSnapshot);
    liveSnapshot = undefined;
  }
  publishSimulationState(false);
}
