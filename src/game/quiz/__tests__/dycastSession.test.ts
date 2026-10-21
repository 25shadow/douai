import test from 'node:test';
import assert from 'node:assert/strict';
import { createDycastSessionManager } from '../../../services/dycastSession.ts';

test('saves sessionid as DyCast cookies and validates it before reporting success', async () => {
  const writes: { name: string; value: string }[] = [];
  const removed: string[] = [];
  const manager = createDycastSessionManager({
    hasCookie: name => writes.some(cookie => cookie.name === name),
    setCookie: cookie => writes.push(cookie),
    removeCookie: name => removed.push(name),
    getMeInfo: async () => ({
      code: 0,
      msg: '',
      data: { nickname: 'DouAi主播' }
    })
  });

  const result = await manager.save(' session-value ');

  assert.equal(result.ok, true);
  assert.deepEqual(writes.map(cookie => cookie.name), ['sessionid', '__lg']);
  assert.equal(writes[0].value, 'session-value');
  assert.equal(result.nickname, 'DouAi主播');
  assert.deepEqual(removed, []);
});

test('clears invalid session cookies when Douyin rejects the credential', async () => {
  const writes: { name: string; value: string }[] = [];
  const removed: string[] = [];
  const manager = createDycastSessionManager({
    hasCookie: name => writes.some(cookie => cookie.name === name),
    setCookie: cookie => writes.push(cookie),
    removeCookie: name => removed.push(name),
    getMeInfo: async () => ({ code: 20003, msg: '未登录', data: null })
  });

  const result = await manager.save('invalid');

  assert.equal(result.ok, false);
  assert.deepEqual(removed, ['sessionid', '__lg']);
});
