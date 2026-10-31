import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimulationRunner, type SimulationScenario } from '../simulationRunner.ts';

const scenario: SimulationScenario = {
  id: 'qa-1',
  name: '验收脚本',
  gameId: 'quiz',
  mode: 'qa',
  durationSeconds: 10,
  events: [
    { id: 'late', atSeconds: 3, type: 'chat', payload: { content: 'B' }, enabled: true },
    { id: 'early', atSeconds: 1, type: 'like', payload: { count: 20 }, enabled: true },
    { id: 'disabled', atSeconds: 1, type: 'gift', payload: {}, enabled: false }
  ]
};

test('runner emits deterministic due events and respects pause', () => {
  const emitted: string[] = [];
  const runner = createSimulationRunner(scenario, event => emitted.push(event.id));
  runner.start();
  assert.deepEqual(emitted, []);
  runner.tick(1);
  assert.deepEqual(emitted, ['early']);
  runner.pause();
  runner.tick(5);
  assert.deepEqual(emitted, ['early']);
  runner.resume();
  runner.tick(2);
  assert.deepEqual(emitted, ['early', 'late']);
});

test('step advances to the next enabled event without requiring time', () => {
  const runner = createSimulationRunner(scenario);
  runner.start();
  assert.equal(runner.step()?.id, 'early');
  assert.equal(runner.step()?.id, 'late');
  assert.equal(runner.step(), undefined);
  assert.equal(runner.snapshot().status, 'finished');
});

test('inject emits manual events through the same callback', () => {
  const emitted: string[] = [];
  const runner = createSimulationRunner(scenario, event => emitted.push(event.type));
  runner.start();
  const event = runner.inject({ type: 'gift', payload: { name: '小心心' }, enabled: true });
  assert.equal(event.type, 'gift');
  assert.deepEqual(emitted, ['gift']);
});
