import test from 'node:test';
import assert from 'node:assert/strict';
import { CastMethod, type DyMessage } from '../../core/type.ts';
import {
  createInteractionRouter,
  type InteractionRouterDependencies
} from '../interactionRouter.ts';
import type { GameModuleDefinition } from '../gameRegistry.ts';

function message(id: string, content = 'hello'): DyMessage {
  return { id, method: CastMethod.CHAT, content, user: { id: `u-${id}`, name: '观众' } };
}

function deps(overrides: Partial<InteractionRouterDependencies> = {}): InteractionRouterDependencies {
  return {
    getActiveGame: () => null,
    getGlobalChatPolicy: () => 'read_sampled',
    submitSpeechIntent: () => true,
    runAiHost: async () => undefined,
    now: () => 1000,
    ...overrides
  };
}

test('routes chat through the global policy when no game is active', async () => {
  const speech: string[] = [];
  const router = createInteractionRouter(deps({
    submitSpeechIntent: intent => {
      speech.push(intent.text);
      return true;
    }
  }));

  await router.routeEvent({ eventId: 'e1', source: 'live', receivedAt: 1000, sessionId: 's1', message: message('1') });
  assert.deepEqual(speech, ['hello']);
});

test('claimed game commands do not enter generic AI or sampled reading', async () => {
  let aiCalls = 0;
  const speech: string[] = [];
  const game = {
    id: 'quiz',
    instanceId: 'quiz-1',
    interactionDefaults: { chat: 'read_sampled' as const },
    handleEvent: () => ({ claimed: true, speechIntents: [], aiIntents: [] })
  } as unknown as GameModuleDefinition;
  const router = createInteractionRouter(deps({
    getActiveGame: () => game,
    submitSpeechIntent: intent => {
      speech.push(intent.text);
      return true;
    },
    runAiHost: async () => { aiCalls += 1; }
  }));

  await router.routeEvent({ eventId: 'e2', source: 'live', receivedAt: 1000, sessionId: 's1', message: message('2', 'A') });
  assert.equal(aiCalls, 0);
  assert.deepEqual(speech, []);
});

test('unclaimed chat selects exactly one configured path', async () => {
  const paths: string[] = [];
  const game = {
    id: 'quiz',
    instanceId: 'quiz-1',
    interactionDefaults: { chat: 'ai_host' as const },
    handleEvent: () => ({ claimed: false, speechIntents: [], aiIntents: [] })
  } as unknown as GameModuleDefinition;
  const router = createInteractionRouter(deps({
    getActiveGame: () => game,
    runAiHost: async () => { paths.push('ai'); },
    submitSpeechIntent: intent => {
      paths.push(`speech:${intent.text}`);
      return true;
    }
  }));

  await router.routeEvent({ eventId: 'e3', source: 'live', receivedAt: 1000, sessionId: 's1', message: message('3') });
  assert.deepEqual(paths, ['ai']);
});

test('duplicate event IDs are ignored', async () => {
  let handled = 0;
  const game = {
    id: 'quiz',
    instanceId: 'quiz-1',
    interactionDefaults: { chat: 'ignore' as const },
    handleEvent: () => {
      handled += 1;
      return { claimed: false, speechIntents: [], aiIntents: [] };
    }
  } as unknown as GameModuleDefinition;
  const router = createInteractionRouter(deps({ getActiveGame: () => game }));
  const event = { eventId: 'same', source: 'live' as const, receivedAt: 1000, sessionId: 's1', message: message('4') };
  await router.routeEvent(event);
  await router.routeEvent(event);
  assert.equal(handled, 1);
});

test('game strategy gates AI and sampled read-aloud', async () => {
  const paths: string[] = [];
  const game = {
    id: 'quiz',
    instanceId: 'quiz-1',
    interactionDefaults: { chat: 'ignore' as const },
    handleEvent: () => ({ claimed: false, speechIntents: [], aiIntents: [] })
  } as unknown as GameModuleDefinition;
  const router = createInteractionRouter(deps({
    getActiveGame: () => game,
    getGameInteractionConfig: () => ({
      games: {
        quiz: {
          chat: 'ai_host',
          sampleRate: 1,
          allowAiHost: false,
          allowReadAloud: true,
          allowDualOutput: false,
          nonChat: { gift: 'game_and_global', like: 'game_and_global', member: 'game_and_global', social: 'game_and_global' }
        }
      }
    }),
    runAiHost: async () => { paths.push('ai'); },
    submitSpeechIntent: () => { paths.push('speech'); return true; }
  }));
  await router.routeEvent({ eventId: 'strategy-1', source: 'live', receivedAt: 1000, sessionId: 's1', message: message('strategy') });
  assert.deepEqual(paths, []);
});

test('game strategy routes non-chat events according to policy', async () => {
  const game = {
    id: 'quiz',
    instanceId: 'quiz-1',
    interactionDefaults: { chat: 'ignore' as const },
    handleEvent: () => ({ claimed: true, speechIntents: [], aiIntents: [] })
  } as unknown as GameModuleDefinition;
  const router = createInteractionRouter(deps({
    getActiveGame: () => game,
    getGameInteractionConfig: () => ({
      games: {
        quiz: {
          chat: 'ignore',
          sampleRate: 0,
          allowAiHost: false,
          allowReadAloud: false,
          allowDualOutput: false,
          nonChat: { gift: 'global_only', like: 'game_only', member: 'ignore', social: 'game_and_global' }
        }
      }
    })
  }));
  const gift = { id: 'gift', method: CastMethod.GIFT, user: { id: 'u', name: '观众' }, gift: { name: '小心心', count: 1, price: 1 } } as DyMessage;
  const like = { id: 'like', method: CastMethod.LIKE, user: { id: 'u', name: '观众' }, content: '为主播点赞了(1)' } as DyMessage;
  const giftResult = await router.routeEvent({ eventId: 'gift', source: 'live', receivedAt: 1000, sessionId: 's1', message: gift });
  const likeResult = await router.routeEvent({ eventId: 'like', source: 'live', receivedAt: 1000, sessionId: 's1', message: like });
  assert.equal(giftResult?.globalEventRouted, true);
  assert.equal(likeResult?.globalEventRouted, false);
});

test('non-chat policies decide independently whether the game and global announcement run', async () => {
  const cases = [
    { policy: 'game_only', handled: true, global: false },
    { policy: 'game_and_global', handled: true, global: true },
    { policy: 'global_only', handled: false, global: true },
    { policy: 'ignore', handled: false, global: false }
  ] as const;

  for (const [index, item] of cases.entries()) {
    let handled = 0;
    const game = {
      id: 'quiz',
      instanceId: 'quiz-1',
      interactionDefaults: { chat: 'ignore' as const },
      handleEvent: () => {
        handled += 1;
        return { claimed: false, speechIntents: [], aiIntents: [] };
      }
    } as unknown as GameModuleDefinition;
    const router = createInteractionRouter(deps({
      getActiveGame: () => game,
      getGameInteractionConfig: () => ({
        games: {
          quiz: {
            chat: 'ignore',
            sampleRate: 0,
            allowAiHost: false,
            allowReadAloud: false,
            allowDualOutput: false,
            nonChat: { gift: item.policy, like: item.policy, member: item.policy, social: item.policy }
          }
        }
      })
    }));
    const gift = { id: `gift-${index}`, method: CastMethod.GIFT, user: { id: 'u', name: '观众' }, gift: { name: '礼物', count: 1, price: 1 } } as DyMessage;
    const result = await router.routeEvent({
      eventId: `gift-${index}`,
      source: 'live',
      receivedAt: 1000,
      sessionId: 's1',
      message: gift
    });

    assert.equal(handled > 0, item.handled, `${item.policy} game route`);
    assert.equal(Boolean(result?.globalEventRouted), item.global, `${item.policy} global route`);
  }
});

test('sample rate and dual-output setting control chat paths deterministically', async () => {
  async function routeChat(config: {
    chat: 'ai_host' | 'read_sampled';
    sampleRate: number;
    allowAiHost: boolean;
    allowReadAloud: boolean;
    allowDualOutput: boolean;
  }) {
    const paths: string[] = [];
    const game = {
      id: 'quiz',
      instanceId: 'quiz-1',
      interactionDefaults: { chat: 'ignore' as const },
      handleEvent: () => ({ claimed: false, speechIntents: [], aiIntents: [] })
    } as unknown as GameModuleDefinition;
    const router = createInteractionRouter(deps({
      getActiveGame: () => game,
      getGameInteractionConfig: () => ({
        games: {
          quiz: {
            ...config,
            nonChat: { gift: 'game_only', like: 'game_only', member: 'game_only', social: 'game_only' }
          }
        }
      }),
      runAiHost: async () => { paths.push('ai'); },
      submitSpeechIntent: () => { paths.push('speech'); return true; }
    }));
    const event = { eventId: 'stable-sample-id', source: 'live' as const, receivedAt: 1000, sessionId: 's1', message: message('stable-sample-id') };
    await router.routeEvent(event);
    return paths;
  }

  assert.deepEqual(await routeChat({
    chat: 'read_sampled', sampleRate: 0, allowAiHost: true, allowReadAloud: true, allowDualOutput: true
  }), []);
  assert.deepEqual(await routeChat({
    chat: 'read_sampled', sampleRate: 1, allowAiHost: true, allowReadAloud: true, allowDualOutput: false
  }), ['speech']);
  assert.deepEqual(await routeChat({
    chat: 'read_sampled', sampleRate: 1, allowAiHost: true, allowReadAloud: true, allowDualOutput: true
  }), ['speech', 'ai']);
  assert.deepEqual(await routeChat({
    chat: 'ai_host', sampleRate: 1, allowAiHost: true, allowReadAloud: true, allowDualOutput: false
  }), ['ai']);
  assert.deepEqual(await routeChat({
    chat: 'ai_host', sampleRate: 1, allowAiHost: true, allowReadAloud: true, allowDualOutput: true
  }), ['ai', 'speech']);
});

test('game-defined chat executes only explicit, permitted intents', async () => {
  const paths: string[] = [];
  const game = {
    id: 'quiz',
    instanceId: 'quiz-1',
    interactionDefaults: { chat: 'ignore' as const },
    handleEvent: () => ({
      claimed: false,
      speechIntents: [{ text: 'game response', owner: 'game:quiz' }],
      aiIntents: [{ prompt: 'game prompt' }]
    })
  } as unknown as GameModuleDefinition;
  const router = createInteractionRouter(deps({
    getActiveGame: () => game,
    getGameInteractionConfig: () => ({
      games: {
        quiz: {
          chat: 'game_defined',
          sampleRate: 1,
          allowAiHost: true,
          allowReadAloud: true,
          allowDualOutput: false,
          nonChat: { gift: 'game_only', like: 'game_only', member: 'game_only', social: 'game_only' }
        }
      }
    }),
    runAiHost: async (_event, intent) => { paths.push(`ai:${intent?.prompt}`); },
    submitSpeechIntent: intent => { paths.push(`speech:${intent.text}`); return true; }
  }));
  await router.routeEvent({ eventId: 'game-defined', source: 'live', receivedAt: 1000, sessionId: 's1', message: message('game-defined') });
  assert.deepEqual(paths, ['ai:game prompt']);
});
