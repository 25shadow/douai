import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultVoiceConfig, normalizeVoiceConfig, validateVoiceConfig, applyVoicePreset } from '../voiceConfig.ts';

test('legacy settings survive normalization and default scenes are independent', () => {
  const config = normalizeVoiceConfig(undefined, { voiceEnabled: false, voiceVolume: 0.4, voiceRate: 1.2, voicePrefix: '提示' });
  assert.equal(config.enabled, false);
  assert.equal(config.volume, 0.4);
  assert.equal(config.rate, 1.2);
  assert.equal(config.prefix, '提示');
  config.scenes.gift.enabled = false;
  assert.equal(createDefaultVoiceConfig().scenes.gift.enabled, true);
  const legacy = createDefaultVoiceConfig() as any;
  legacy.scenes.quiz = { enabled: false, prefix: 'old', priority: 3, maxLength: 1000, cooldownMs: 0 };
  legacy.scenes.answer = legacy.scenes.quiz;
  const migrated = normalizeVoiceConfig(legacy);
  assert.equal('quiz' in migrated.scenes, false);
  assert.equal(migrated.scenes.gift.template, '感谢{昵称}送出的{礼物}{数量}个！');
});

test('invalid types, nonfinite numbers, ranges and scene policies are rejected', () => {
  for (const patch of [{ rate: NaN }, { volume: 2 }, { enabled: 'false' }, { queueMode: 'unknown' }, { lang: 'x'.repeat(51) }]) {
    assert.throws(() => validateVoiceConfig({ ...createDefaultVoiceConfig(), ...patch }));
  }
  const config = createDefaultVoiceConfig();
  config.scenes.gift.priority = 4;
  assert.throws(() => validateVoiceConfig(config));
});

test('presets only replace delivery parameters and never mutate the draft', () => {
  const config = createDefaultVoiceConfig();
  config.voiceURI = 'selected';
  config.prefix = '直播间';
  const result = applyVoicePreset(config, 'quick');
  assert.equal(result.voiceURI, 'selected');
  assert.equal(result.prefix, '直播间');
  assert.ok(result.rate > 1);
  assert.equal(config.rate, 1);
});
