import { CastMethod, type DyMessage } from '../core/type.ts';
import type { GameModuleDefinition } from './gameRegistry.ts';
import {
  messageText,
  type AiIntent,
  type ChatRoutePolicy,
  type GameEventContext,
  type GameEventResult,
  type GameInteractionOverride,
  type InteractionEventKind,
  type RoutedLiveEvent,
  type SpeechIntent,
  type NonChatEventPolicy
} from './interactionTypes.ts';

export interface InteractionRouterDependencies {
  getActiveGame: () => GameModuleDefinition | null | undefined;
  getGlobalChatPolicy: () => ChatRoutePolicy;
  submitSpeechIntent: (intent: SpeechIntent) => boolean | void;
  runAiHost: (event: RoutedLiveEvent, intent?: AiIntent) => Promise<unknown> | unknown;
  getGameInteractionConfig?: () => { games?: Record<string, Partial<GameInteractionOverride>> } | undefined;
  now?: () => number;
}

export interface InteractionRouter {
  routeEvent(event: RoutedLiveEvent): Promise<GameEventResult | undefined>;
  routeLiveMessages(messages: DyMessage[], source: RoutedLiveEvent['source'], sessionId: string): Promise<GameEventResult[]>;
  clear(): void;
}

function eventPolicy(message: DyMessage): InteractionEventKind | 'chat' | 'other' {
  if (message.method === CastMethod.CHAT || message.method === CastMethod.EMOJI_CHAT) return 'chat';
  if (message.method === CastMethod.GIFT) return 'gift';
  if (message.method === CastMethod.LIKE) return 'like';
  if (message.method === CastMethod.MEMBER) return 'member';
  if (message.method === CastMethod.SOCIAL) return 'social';
  return 'other';
}

function stableSample(eventId: string): number {
  let hash = 2166136261;
  for (const character of eventId) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

function normalizeOverride(value: Partial<GameInteractionOverride> | undefined): Partial<GameInteractionOverride> {
  if (!value) return {};
  return {
    ...value,
    sampleRate: typeof value.sampleRate === 'number' ? Math.min(1, Math.max(0, value.sampleRate)) : undefined
  };
}

function nonChatPolicy(
  game: GameModuleDefinition | null | undefined,
  kind: InteractionEventKind,
  override: Partial<GameInteractionOverride>
): NonChatEventPolicy {
  return override.nonChat?.[kind]
    || game?.interactionDefaults?.nonChat?.[kind]
    || 'game_and_global';
}

function shouldRouteGlobal(policy: NonChatEventPolicy): boolean {
  return policy === 'game_and_global' || policy === 'global_only';
}

export function createInteractionRouter(dependencies: InteractionRouterDependencies): InteractionRouter {
  const seen = new Set<string>();
  const now = dependencies.now || (() => Date.now());

  function submit(intents: SpeechIntent[] | undefined, fallbackEvent: RoutedLiveEvent, owner: string) {
    for (const intent of intents || []) {
      if (!intent.text?.trim()) continue;
      dependencies.submitSpeechIntent({
        ...intent,
        eventId: intent.eventId || fallbackEvent.eventId,
        owner: intent.owner || owner,
        expiresAt: intent.expiresAt ?? now() + 30_000
      });
    }
  }

  async function runAiIntents(intents: AiIntent[] | undefined, event: RoutedLiveEvent, owner: string, allowed: boolean) {
    if (!allowed) return;
    for (const intent of intents || []) {
      await dependencies.runAiHost(event, {
        ...intent,
        eventId: intent.eventId || event.eventId,
        owner: intent.owner || owner
      });
    }
  }

  async function routeEvent(event: RoutedLiveEvent) {
    if (!event.eventId || seen.has(event.eventId)) return;
    seen.add(event.eventId);

    const game = dependencies.getActiveGame();
    const configured = normalizeOverride(game
      ? dependencies.getGameInteractionConfig?.()?.games?.[game.id]
      : undefined);
    const kind = eventPolicy(event.message);
    const result: GameEventResult = { claimed: false, speechIntents: [], aiIntents: [] };
    const policy = kind === 'chat'
      ? configured.chat || game?.interactionDefaults?.chat || dependencies.getGlobalChatPolicy()
      : undefined;
    const nonChatRoute = kind !== 'chat' && kind !== 'other'
      ? game ? nonChatPolicy(game, kind, configured) : 'game_and_global'
      : undefined;

    if (kind !== 'chat' && kind !== 'other') {
      if (nonChatRoute === 'ignore') return result;
      if (nonChatRoute === 'global_only' || !game) {
        result.globalEventRouted = true;
        return result;
      }
    }

    if (game?.isRunning?.() !== false && game?.handleEvent) {
      const context: GameEventContext = {
        sessionId: event.sessionId,
        instanceId: game.instanceId || `game:${game.id}`,
        now: now()
      };
      Object.assign(result, (await game.handleEvent(event, context)) || {});
      const allowAiHost = configured.allowAiHost ?? true;
      const isExplicitDualRoute = kind === 'chat' && policy === 'game_defined'
        && Boolean(result.aiIntents?.length) && Boolean(result.speechIntents?.length);
      if ((configured.allowReadAloud ?? true)
        && (!isExplicitDualRoute || configured.allowDualOutput || !allowAiHost)) {
        submit(result.speechIntents, event, `game:${game.id}:${context.instanceId}`);
      }
    }

    const allowAiHost = configured.allowAiHost ?? true;

    if (kind !== 'chat' && kind !== 'other') {
      result.globalEventRouted = shouldRouteGlobal(nonChatRoute!);
      return result;
    }
    if (kind !== 'chat') return result;

    if (policy === 'game_defined') {
      await runAiIntents(result.aiIntents, event, `ai-host:${event.sessionId}`, allowAiHost);
      return result;
    }
    if (result.claimed) return result;

    const body = messageText(event.message);
    if (!body) return result;

    const allowReadAloud = configured.allowReadAloud ?? true;
    const allowDualOutput = configured.allowDualOutput ?? false;
    const sampleRate = configured.sampleRate ?? 1;
    const canSample = allowReadAloud && stableSample(event.eventId) < sampleRate;
    const canRunAi = allowAiHost;
    const speechIntent: SpeechIntent = {
      eventId: event.eventId,
      owner: game ? `game:${game.id}:${game.instanceId || game.id}` : 'live-events',
      text: body,
      scene: 'system',
      priority: 1
    };

    if (policy === 'read_sampled' && canSample) {
      result.chatRouted = true;
      submit([speechIntent], event, 'live-events');
      if (allowDualOutput && canRunAi) {
        result.chatRouted = true;
        await dependencies.runAiHost(event, {
          eventId: event.eventId,
          owner: `ai-host:${event.sessionId}`,
          prompt: body,
          kind: 'host'
        });
      }
    } else if (policy === 'ai_host' && canRunAi) {
      result.chatRouted = true;
      await dependencies.runAiHost(event, {
        eventId: event.eventId,
        owner: `ai-host:${event.sessionId}`,
        prompt: body,
        kind: 'host'
      });
      if (allowDualOutput && canSample) {
        submit([speechIntent], event, 'live-events');
      }
    }
    return result;
  }

  return {
    routeEvent,
    async routeLiveMessages(messages, source, sessionId) {
      const results: GameEventResult[] = [];
      for (const [index, message] of messages.entries()) {
        const result = await routeEvent({
          eventId: message.id || `${source}:${sessionId}:${index}`,
          source,
          receivedAt: now(),
          sessionId,
          message
        });
        if (result) results.push(result);
      }
      return results;
    },
    clear() {
      seen.clear();
    }
  };
}
