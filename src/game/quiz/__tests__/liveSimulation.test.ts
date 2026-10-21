import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canStartLiveSimulation,
  isSupportedSimulationGame,
  createSimulationMessage,
  normalizeSimulationConfig,
  parseLiveSimulationPacket,
  serializeLiveSimulationPacket
} from '../../../services/liveSimulation.ts';

test('clamps simulation settings to usable ranges', () => {
  assert.deepEqual(normalizeSimulationConfig({
    durationMinutes: 0,
    audience: 1000000,
    eventIntervalSeconds: 0
  }), {
    durationMinutes: 1,
    audience: 99999,
    eventIntervalSeconds: 1
  });
});

test('simulation cycles chat, like, and gift messages with stable identities', () => {
  const messages = [0, 1, 2].map(index => createSimulationMessage(index));

  assert.deepEqual(messages.map(message => message.method), ['WebcastChatMessage', 'WebcastLikeMessage', 'WebcastGiftMessage']);
  assert.equal(messages[0].user?.id, 'demo-user-1');
  assert.match(messages[0].content || '', /^[A-D]$/);
  assert.ok(Number(messages[1].content?.match(/\((\d+)\)/)?.[1]) > 0);
  assert.ok(messages[2].gift?.price);
});

test('simulation gift cycle includes both quiz gift rule tiers', () => {
  const gifts = [2, 4].map(index => createSimulationMessage(index));

  assert.equal(gifts[0].method, 'WebcastGiftMessage');
  assert.equal(gifts[0].gift?.price, 1);
  assert.equal(gifts[1].method, 'WebcastGiftMessage');
  assert.equal(gifts[1].gift?.price, 11);
});

test('refuses to start while a real room is live or connecting', () => {
  assert.equal(canStartLiveSimulation('offline', false), true);
  assert.equal(canStartLiveSimulation('live', false), false);
  assert.equal(canStartLiveSimulation('connecting', false), false);
  assert.equal(canStartLiveSimulation('error', false), false);
  assert.equal(canStartLiveSimulation('offline', true), false);
});

test('requires an explicitly selected implemented game for simulation', () => {
  assert.equal(isSupportedSimulationGame(null), false);
  assert.equal(isSupportedSimulationGame('unknown'), false);
  assert.equal(isSupportedSimulationGame('quiz'), true);
});

test('simulation sync packet round-trips an active view snapshot', () => {
  const packet = {
    sourceId: 'controller-1',
    active: true,
    state: { audience: 42, question: '题目', events: [{ id: 'demo-1' }] }
  };

  assert.deepEqual(parseLiveSimulationPacket(serializeLiveSimulationPacket(packet)), packet);
});

test('simulation sync packet parser ignores malformed or incomplete data', () => {
  assert.equal(parseLiveSimulationPacket(null), null);
  assert.equal(parseLiveSimulationPacket('{broken'), null);
  assert.equal(parseLiveSimulationPacket(JSON.stringify({ active: true })), null);
});
