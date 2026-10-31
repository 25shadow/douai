import type { DyMessage } from '@/core/type';
import type { SimulationEvent, SimulationMode, SimulationScenario } from '@/services/simulationRunner';

export type { SimulationEvent, SimulationMode, SimulationScenario };

export interface LiveSimulationConfig {
  durationMinutes: number;
  audience: number;
  eventIntervalSeconds: number;
  mode?: SimulationMode;
  scenario?: SimulationScenario;
  events?: SimulationEvent[];
}

export type SimulationGameId = 'quiz' | 'versus';

export function isSupportedSimulationGame(gameId: unknown): gameId is SimulationGameId {
  return gameId === 'quiz' || gameId === 'versus';
}

export interface LiveSimulationSyncPacket {
  sourceId: string;
  active: boolean;
  state?: Record<string, unknown>;
}

export const liveSimulationSyncKey = 'douai-live-simulation-state';

export function serializeLiveSimulationPacket(packet: LiveSimulationSyncPacket): string {
  return JSON.stringify(packet);
}

export function parseLiveSimulationPacket(raw: string | null): LiveSimulationSyncPacket | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return null;
    const packet = value as Partial<LiveSimulationSyncPacket>;
    if (typeof packet.sourceId !== 'string' || typeof packet.active !== 'boolean') return null;
    if (packet.state !== undefined && (!packet.state || typeof packet.state !== 'object' || Array.isArray(packet.state))) return null;
    return packet as LiveSimulationSyncPacket;
  } catch {
    return null;
  }
}

export const defaultLiveSimulationConfig: LiveSimulationConfig = {
  durationMinutes: 5,
  audience: 120,
  eventIntervalSeconds: 3,
  mode: 'demo'
};

export function createSimulationScenario(
  gameId: SimulationGameId,
  config: LiveSimulationConfig,
  mode: SimulationMode = config.mode || 'demo'
): SimulationScenario {
  const durationSeconds = Math.max(30, config.durationMinutes * 60);
  if (config.scenario?.events?.length) {
    return {
      ...config.scenario,
      gameId,
      mode,
      durationSeconds: config.scenario.durationSeconds || durationSeconds,
      events: config.scenario.events.map(event => ({ ...event }))
    };
  }
  if (config.events?.length) {
    return {
      id: `${mode}-${gameId}-custom`,
      name: mode === 'qa' ? '验收脚本' : mode === 'rehearsal' ? '彩排脚本' : '演示脚本',
      gameId,
      mode,
      durationSeconds,
      events: config.events.map(event => ({ ...event }))
    };
  }
  const interval = Math.max(1, config.eventIntervalSeconds);
  const events: SimulationEvent[] = [
    { id: 'join-1', atSeconds: 0, type: 'join', payload: { name: '小星' }, enabled: true, label: '观众进入直播间' },
    { id: 'chat-1', atSeconds: interval, type: 'chat', payload: { name: '小星', content: gameId === 'versus' ? '1A' : 'A' }, enabled: true, label: '观众参与答题' },
    { id: 'like-1', atSeconds: interval * 2, type: 'like', payload: { name: '橘子汽水', count: 120 }, enabled: true, label: '点赞助力' },
    { id: 'gift-1', atSeconds: interval * 3, type: 'gift', payload: { name: '阿北', giftName: '小心心', price: 1, count: 1 }, enabled: true, label: '送出小礼物' },
    { id: 'chat-2', atSeconds: interval * 4, type: 'chat', payload: { name: '木木', content: gameId === 'versus' ? '2B' : 'B' }, enabled: true, label: '第二位观众答题' },
    { id: 'gift-2', atSeconds: interval * 5, type: 'gift', payload: { name: '小满', giftName: '小花花', price: 11, count: 1 }, enabled: true, label: '高价值礼物' }
  ];
  return {
    id: `${mode}-${gameId}-default`,
    name: mode === 'qa' ? '验收脚本' : mode === 'rehearsal' ? '彩排脚本' : '完整演示',
    gameId,
    mode,
    durationSeconds,
    events
  };
}

export function canStartLiveSimulation(connection: string, active: boolean): boolean {
  return !active && connection === 'offline';
}

const demoNames = ['小星', '橘子汽水', '阿北', '木木', '小满', '晚风'];
const demoComments = ['A', 'B', 'C', 'D'];
const demoGifts = [
  { name: '小心心', price: 1 },
  { name: '小花花', price: 11 }
];

export function normalizeSimulationConfig(config: Partial<LiveSimulationConfig>): LiveSimulationConfig {
  const normalized: LiveSimulationConfig = {
    durationMinutes: clampInteger(config.durationMinutes, 1, 180, defaultLiveSimulationConfig.durationMinutes),
    audience: clampInteger(config.audience, 1, 99999, defaultLiveSimulationConfig.audience),
    eventIntervalSeconds: clampInteger(config.eventIntervalSeconds, 1, 60, defaultLiveSimulationConfig.eventIntervalSeconds)
  };
  if (config.mode || config.scenario || config.events) {
    normalized.mode = config.mode === 'qa' || config.mode === 'rehearsal' || config.mode === 'demo' ? config.mode : defaultLiveSimulationConfig.mode;
    if (config.scenario) normalized.scenario = config.scenario;
    if (config.events) normalized.events = config.events;
  }
  return normalized;
}

export function createManualInteractionEvent(
  type: SimulationEvent['type'],
  input: {
    actorId?: string;
    actorName?: string;
    text?: string;
    count?: number;
    giftName?: string;
    price?: number;
  }
): SimulationEvent {
  const payload: Record<string, unknown> = {
    userId: input.actorId || `manual-user-${Date.now()}`,
    name: input.actorName?.trim() || '现场观众'
  };
  if (type === 'chat') payload.content = input.text?.trim() || 'A';
  if (type === 'like') payload.count = Math.max(1, Math.round(Number(input.count) || 1));
  if (type === 'gift') {
    payload.giftName = input.giftName?.trim() || '小心心';
    payload.price = Math.max(1, Math.round(Number(input.price) || 1));
    payload.count = Math.max(1, Math.round(Number(input.count) || 1));
  }
  return {
    id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    payload,
    enabled: true,
    source: 'manual',
    status: 'draft',
    label: type === 'chat' ? '手动评论' : type === 'like' ? '手动点赞' : '手动送礼'
  };
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

export function createSimulationMessage(
  index: number,
  gameId: SimulationGameId = 'quiz',
  commands: { red?: string; blue?: string } = {}
): DyMessage {
  const userIndex = Math.abs(Math.floor(index)) % demoNames.length;
  const eventIndex = Math.abs(Math.floor(index)) % 5;
  const user = { id: `demo-user-${userIndex + 1}`, name: demoNames[userIndex] };
  const id = `demo-${index}`;

  if (eventIndex === 1) {
    const count = 40 + (userIndex % 4) * 25;
    return { id, method: 'WebcastLikeMessage' as DyMessage['method'], user, content: `为主播点赞了(${count})` };
  }

  if (eventIndex === 2 || eventIndex === 4) {
    const gift = demoGifts[eventIndex === 2 ? 0 : 1];
    return {
      id,
      method: 'WebcastGiftMessage' as DyMessage['method'],
      user,
      gift: { ...gift, count: 1, repeatEnd: 0 }
    };
  }

  const comment = gameId === 'versus'
    ? (userIndex % 2 === 0 ? (commands.red || '1') : (commands.blue || '2'))
    : demoComments[userIndex % demoComments.length];

  return {
    id,
    method: 'WebcastChatMessage' as DyMessage['method'],
    user,
    content: comment
  };
}
