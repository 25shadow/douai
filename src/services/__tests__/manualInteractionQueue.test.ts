import test from 'node:test';
import assert from 'node:assert/strict';
import { createManualInteractionQueue } from '../manualInteractionQueue.ts';

test('keeps manual events in FIFO order and marks them queued', () => {
  const queue = createManualInteractionQueue();
  queue.enqueue({ id: 'a', type: 'chat', payload: { content: 'A' }, enabled: true });
  queue.enqueue({ id: 'b', type: 'gift', payload: { giftName: '小心心' }, enabled: true });

  assert.deepEqual(queue.snapshot().map(item => item.id), ['a', 'b']);
  assert.equal(queue.dequeue()?.status, 'queued');
  assert.equal(queue.dequeue()?.id, 'b');
  assert.equal(queue.dequeue(), undefined);
});

test('clears all queued manual events', () => {
  const queue = createManualInteractionQueue();
  queue.enqueue({ id: 'a', type: 'like', payload: { count: 100 }, enabled: true });
  queue.clear();
  assert.deepEqual(queue.snapshot(), []);
});
