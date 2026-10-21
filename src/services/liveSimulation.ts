import type { DyMessage } from '@/core/type';

export interface LiveSimulationConfig {
  durationMinutes: number;
  audience: number;
  eventIntervalSeconds: number;
}

export type SimulationGameId = 'quiz';

export function isSupportedSimulationGame(gameId: unknown): gameId is SimulationGameId {
  return gameId === 'quiz';
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
  eventIntervalSeconds: 3
};

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
  return {
    durationMinutes: clampInteger(config.durationMinutes, 1, 180, defaultLiveSimulationConfig.durationMinutes),
    audience: clampInteger(config.audience, 1, 99999, defaultLiveSimulationConfig.audience),
    eventIntervalSeconds: clampInteger(config.eventIntervalSeconds, 1, 60, defaultLiveSimulationConfig.eventIntervalSeconds)
  };
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

export function createSimulationMessage(index: number): DyMessage {
  const userIndex = Math.abs(Math.floor(index)) % demoNames.length;
  const eventIndex = Math.abs(Math.floor(index)) % 5;
  const user = { id: `demo-user-${userIndex + 1}`, name: demoNames[userIndex] };
  const id = `demo-${index}`;

  if (eventIndex === 1) {
    const count = (userIndex + 1) * 5;
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

  return {
    id,
    method: 'WebcastChatMessage' as DyMessage['method'],
    user,
    content: demoComments[userIndex % demoComments.length]
  };
}
