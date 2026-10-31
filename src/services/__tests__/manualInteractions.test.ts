import test from 'node:test';
import assert from 'node:assert/strict';
import { createManualInteractionEvent } from '../liveSimulation.ts';

test('creates an editable manual chat event without touching script timing', () => {
  const event = createManualInteractionEvent('chat', {
    actorId: 'viewer-1',
    actorName: '小明',
    text: 'C'
  });

  assert.equal(event.source, 'manual');
  assert.equal(event.type, 'chat');
  assert.equal(event.atSeconds, undefined);
  assert.deepEqual(event.payload, {
    userId: 'viewer-1',
    name: '小明',
    content: 'C'
  });
});

test('creates manual gift and like payloads with explicit values', () => {
  const like = createManualInteractionEvent('like', { actorName: '小红', count: 300 });
  const gift = createManualInteractionEvent('gift', {
    actorName: '大哥',
    giftName: '小花花',
    price: 11,
    count: 3
  });

  assert.equal(like.payload.count, 300);
  assert.equal(gift.payload.giftName, '小花花');
  assert.equal(gift.payload.price, 11);
  assert.equal(gift.payload.count, 3);
});
