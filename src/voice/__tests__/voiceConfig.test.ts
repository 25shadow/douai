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

test('new chat and AI interaction controls have conservative defaults and validate ranges', () => {
  const config = createDefaultVoiceConfig();
  assert.equal(config.chat.enabled, true);
  assert.equal(config.chat.triggerMode, 'all');
  assert.equal(config.aiInteraction.enabled, false);
  assert.equal(config.aiInteraction.triggerMode, 'smart');
  assert.match(config.aiInteraction.interactionRule, /当前直播/);
  assert.equal(config.aiInteraction.maxPerMinute, 4);
  assert.equal(config.aiInteraction.persona, 'friendly-host');
  assert.deepEqual(config.chat.output, { voice: true, text: false });
  assert.deepEqual(config.scenes.gift.output, { voice: true, text: false });
  assert.throws(() => validateVoiceConfig({
    ...config,
    chat: { ...config.chat, maxLength: 2000 }
  }));
  assert.throws(() => validateVoiceConfig({
    ...config,
    aiInteraction: { ...config.aiInteraction, globalCooldownMs: -1 }
  }));
  assert.throws(() => validateVoiceConfig({
    ...config,
    aiInteraction: { ...config.aiInteraction, maxPerMinute: 0 }
  }));
});

test('output channels can be configured independently for chat, AI, and live events', () => {
  const config = createDefaultVoiceConfig();
  config.chat.output.text = true;
  config.aiInteraction.output.text = true;
  config.scenes.gift.output = { voice: false, text: true };
  assert.deepEqual(validateVoiceConfig(config).scenes.gift.output, { voice: false, text: true });
});
