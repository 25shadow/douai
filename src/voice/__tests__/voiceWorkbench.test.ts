import test from 'node:test';
import assert from 'node:assert/strict';
import { createVoiceWorkbench } from '../useVoiceWorkbench.ts';
import { initializeVoice } from '../voiceInitialization.ts';
import { createDefaultVoiceConfig } from '../voiceConfig.ts';
import { createVoiceManager } from '../voiceManager.ts';
import { loadConfig, saveVoiceConfig } from '../../services/configApi.ts';

test('failed save keeps edited draft and active settings; success updates the baseline', async () => {
  let savedRate = 1;
  let fail = true;
  const model = createVoiceWorkbench({
    load: async () => createDefaultVoiceConfig(),
    save: async config => { if (fail) throw new Error('disk failed'); return config; },
    apply: config => { savedRate = config.rate; }
  });
  await model.load();
  model.draft.value.rate = 1.4;
  assert.equal(model.dirty.value, true);
  await model.save();
  assert.equal(model.error.value, 'disk failed');
  assert.equal(savedRate, 1);
  assert.equal(model.draft.value.rate, 1.4);
  assert.equal(model.dirty.value, true);
  fail = false;
  await model.save();
  assert.equal(savedRate, 1.4);
  assert.equal(model.dirty.value, false);
});
test('initialization failure blocks playback and retry applies saved configuration', async () => {
  const runtime = createVoiceManager({ supported: true, play: () => '', cancel() {}, pause() {}, resume() {} });
  await assert.rejects(initializeVoice(async () => { throw new Error('offline'); }, runtime));
  assert.equal(runtime.getState().ready, false);
  const config = createDefaultVoiceConfig(); config.enabled = false;
  await initializeVoice(async () => config, runtime);
  assert.equal(runtime.getState().ready, true);
  assert.equal(runtime.speak('disabled'), false);
});
test('voice initialization retries a sidecar that is still starting', async () => {
  const runtime = createVoiceManager({ supported: true, play: () => '', cancel() {}, pause() {}, resume() {} });
  let attempts = 0;
  const config = createDefaultVoiceConfig();
  await initializeVoice(
    async () => {
      attempts += 1;
      if (attempts < 3) throw new Error('sidecar starting');
      return config;
    },
    runtime,
    { retries: 3, delayMs: 0 }
  );
  assert.equal(attempts, 3);
  assert.equal(runtime.getState().ready, true);
});
test('dedicated voice save sends validated settings without unrelated project fields', async () => {
  let request: { url?: unknown; body?: string; method?: string } = {};
  const c = createDefaultVoiceConfig();
  await saveVoiceConfig(c, async (url, init) => {
    request = { url, body: String(init?.body), method: init?.method };
    return { ok: true, json: async () => c } as Response;
  });
  assert.equal(request.url, '/api/config/voice');
  assert.equal(request.method, 'PUT');
  assert.equal(JSON.parse(request.body!).provider, 'browser');
  assert.equal(JSON.parse(request.body!).roomId, undefined);
  await assert.rejects(saveVoiceConfig(c, async () => ({ ok: false, json: async () => ({ error: '数据库只读' }) } as Response)), /数据库只读/);
});
test('loaded legacy project response receives a normalized voice profile', async () => {
  const config = await loadConfig(async () => ({ ok: true, json: async () => ({ voiceEnabled: false, voiceRate: 1.4, voicePrefix: '旧配置' }) } as Response));
  assert.equal(config.voiceConfig?.enabled, false);
  assert.equal(config.voiceConfig?.prefix, '旧配置');
});
