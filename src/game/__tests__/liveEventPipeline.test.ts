import test from 'node:test';
import assert from 'node:assert/strict';
import { CastMethod, type DyMessage } from '../../core/type.ts';
import { createInteractionRouter } from '../interactionRouter.ts';
import type { GameModuleDefinition } from '../gameRegistry.ts';

function chat(id: string, content: string): DyMessage {
  return {
    id,
    method: CastMethod.CHAT,
    content,
    user: { id: `user-${id}`, name: '观众' }
  };
}

function createFixture() {
  const handled: string[] = [];
  const game = {
    id: 'quiz',
    instanceId: 'quiz-instance',
    isRunning: () => true,
    interactionDefaults: { version: 1, chat: 'ignore' as const },
    handleEvent: (event: { message: DyMessage }) => {
      handled.push(event.message.content || '');
      return {
        claimed: /^[ABCD]$/i.test(event.message.content || ''),
        speechIntents: [],
        aiIntents: []
      };
    }
  } as unknown as GameModuleDefinition;
  const router = createInteractionRouter({
    getActiveGame: () => game,
    getGlobalChatPolicy: () => 'ignore',
    submitSpeechIntent: () => true,
    runAiHost: async () => undefined,
    now: () => 1000
  });
  return { router, handled };
}

test('real and simulation sources use the same per-message game pipeline', async () => {
  const live = createFixture();
  const simulation = createFixture();
  const liveResults = await live.router.routeLiveMessages([chat('live-1', 'A'), chat('live-2', '闲聊')], 'live', 'session-live');
  const simulationResults = await simulation.router.routeLiveMessages([chat('sim-1', 'A'), chat('sim-2', '闲聊')], 'simulation', 'session-sim');

  assert.deepEqual(live.handled, ['A', '闲聊']);
  assert.deepEqual(simulation.handled, ['A', '闲聊']);
  assert.deepEqual(liveResults.map(result => result.claimed), [true, false]);
  assert.deepEqual(simulationResults.map(result => result.claimed), [true, false]);
});

test('duplicate event IDs do not update game state twice', async () => {
  const fixture = createFixture();
  const duplicate = chat('same-event', 'A');
  await fixture.router.routeLiveMessages([duplicate, duplicate], 'live', 'session-live');
  assert.deepEqual(fixture.handled, ['A']);
});
