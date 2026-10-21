import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig, migrateLegacyBrowserConfig, saveConfig } from '../../../services/configApi.ts';

function createStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => { values.delete(key); },
    has: (key: string) => values.has(key)
  };
}

function response(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 503,
    json: async () => body
  } as Response;
}

test('loadConfig rejects when SQLite API is unavailable', async () => {
  await assert.rejects(
    loadConfig(async () => { throw new Error('offline'); }),
    /SQLite 配置服务不可用/
  );
});

test('saveConfig rejects failed persistence without browser storage fallback', async () => {
  await assert.rejects(
    saveConfig({} as never, async () => response({}, false)),
    /SQLite 配置保存失败/
  );
});

test('legacy migration clears old keys only after acknowledged success', async () => {
  const storage = createStorage({
    'douai-room-id': 'room-abc',
    'douai-relay-url': 'ws://localhost:8765',
    'douai-live-simulation-config': '{"durationMinutes":8,"audience":450,"eventIntervalSeconds":4}'
  });
  let requestBody = '';
  await migrateLegacyBrowserConfig(async (_url, init) => {
    requestBody = String(init?.body);
    return response({
      migrated: true,
      consumedKeys: ['douai-room-id', 'douai-relay-url', 'douai-live-simulation-config'],
      config: {}
    });
  }, storage);

  assert.match(requestBody, /room-abc/);
  assert.equal(storage.has('douai-room-id'), false);
  assert.equal(storage.has('douai-relay-url'), false);
  assert.equal(storage.has('douai-live-simulation-config'), false);
});

test('failed legacy migration retains old keys for retry', async () => {
  const storage = createStorage({ 'douai-room-id': 'room-abc' });
  await assert.rejects(
    migrateLegacyBrowserConfig(async () => { throw new Error('offline'); }, storage),
    /SQLite 配置迁移失败/
  );
  assert.equal(storage.has('douai-room-id'), true);
});
