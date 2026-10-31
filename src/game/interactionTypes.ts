import type { DyMessage, CastMethod } from '../core/type.ts';

export type EventSource = 'live' | 'simulation';
export type ChatRoutePolicy = 'ignore' | 'ai_host' | 'read_sampled' | 'game_defined';
export type NonChatEventPolicy = 'game_only' | 'game_and_global' | 'global_only' | 'ignore';
export type InteractionEventKind = 'gift' | 'like' | 'member' | 'social';

export interface GameInteractionOverride {
  chat: ChatRoutePolicy;
  sampleRate: number;
  allowAiHost: boolean;
  allowReadAloud: boolean;
  allowDualOutput: boolean;
  nonChat: Record<InteractionEventKind, NonChatEventPolicy>;
}

export interface RoutedLiveEvent {
  eventId: string;
  source: EventSource;
  receivedAt: number;
  sessionId: string;
  message: DyMessage;
}

export interface SpeechIntent {
  eventId?: string;
  instanceId?: string;
  owner: string;
  text: string;
  scene?: string;
  priority?: number;
  expiresAt?: number;
}

export interface AiIntent {
  eventId?: string;
  instanceId?: string;
  owner?: string;
  prompt?: string;
  kind?: 'host';
}

export interface GameInteractionDefaults {
  version?: number;
  chat: ChatRoutePolicy;
  nonChat?: Partial<Record<
    'gift' | 'like' | 'member' | 'social' | CastMethod,
    NonChatEventPolicy
  >>;
}

export interface GameEventContext {
  sessionId: string;
  instanceId: string;
  now: number;
}

export interface GameEventResult {
  claimed: boolean;
  chatRouted?: boolean;
  globalEventRouted?: boolean;
  speechIntents?: SpeechIntent[];
  aiIntents?: AiIntent[];
}

export function messageText(message: DyMessage): string {
  return (message.content || message.rtfContent?.map(item => item.text || '').join('') || '').trim();
}

