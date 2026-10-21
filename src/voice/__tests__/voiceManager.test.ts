import test from 'node:test';
import assert from 'node:assert/strict';
import { createVoiceManager } from '../voiceManager.ts';
import { createDefaultVoiceConfig } from '../voiceConfig.ts';
import { resolveVoice } from '../browserSpeech.ts';

function setup() {
  const played: Array<{ text: string; config: any; done: (error?: string) => void }> = [];
  let now = 0;
  let timer: (() => void) | undefined;
  const runtime = createVoiceManager({
    supported: true,
    play(text: string, config: any, done: (error?: string) => void) { played.push({ text, config, done }); return ''; },
    cancel() {}, pause() {}, resume() {}
  }, { now: () => now, set: fn => { timer = fn; return 1; }, clear: () => { timer = undefined; } });
  const config = createDefaultVoiceConfig();
  for (const scene of Object.values(config.scenes)) scene.cooldownMs = 0;
  config.dedupeWindowMs = 0;
  runtime.configure(config);
  return { runtime, config, played, advance: (ms: number) => { now += ms; }, timeout: () => timer?.() };
}
test('voice resolution falls back without modifying saved identity', () => {
  const voices = [
    { voiceURI: 'en', name: 'English', lang: 'en-US', default: true, localService: true },
    { voiceURI: 'zh', name: '中文', lang: 'zh-CN', default: false, localService: true }
  ];
  const config = createDefaultVoiceConfig();
  config.voiceURI = 'missing';
  assert.equal(resolveVoice(voices, config).voice?.voiceURI, 'zh');
  assert.ok(resolveVoice(voices, config).warning);
  assert.equal(config.voiceURI, 'missing');
});
test('queue never interrupts current speech and sorts pending by priority with FIFO ties', () => {
  const { runtime, played } = setup();
  runtime.speak('first', { scene: 'quiz' });
  runtime.speak('feedback', { scene: 'answer' });
  runtime.speak('important', { scene: 'system' });
  runtime.speak('important2', { scene: 'system' });
  assert.deepEqual(played.map(p => p.text), ['first']);
  played[0].done(); played[1].done(); played[2].done();
  assert.deepEqual(played.map(p => p.text), ['first', 'important', 'important2', 'feedback']);
});
test('interrupt respects priority and ignores callbacks from cancelled playback', () => {
  const { runtime, config, played } = setup();
  config.queueMode = 'interrupt'; runtime.configure(config);
  runtime.speak('question', { scene: 'quiz' });
  runtime.speak('low', { scene: 'answer' });
  assert.equal(played.length, 1);
  runtime.speak('new', { scene: 'quiz' });
  played[0].done();
  assert.equal(runtime.getState().currentText, 'new');
  played[1].done();
  assert.equal(played[2].text, 'low');
});
test('drop and bounded queue reject requests without consuming dedupe windows', () => {
  const { runtime, config, played } = setup();
  config.queueMode = 'drop'; config.dedupeWindowMs = 5000; runtime.configure(config);
  runtime.speak('first');
  assert.equal(runtime.speak('retry'), false);
  played[0].done();
  assert.equal(runtime.speak('retry'), true);
  runtime.stop();
  config.queueMode = 'queue'; config.maxQueueSize = 1; runtime.configure(config);
  runtime.speak('current');
  runtime.speak('low', { scene: 'answer' });
  runtime.speak('high', { scene: 'quiz' });
  played[2].done();
  assert.equal(played[3].text, 'high');
});
test('prefixes, Unicode limits, dedupe and scene cooldown apply on accepted messages', () => {
  const { runtime, config, played, advance } = setup();
  config.prefix = '全局'; config.scenes.gift.prefix = '互动';
  config.scenes.gift.maxLength = 20; config.scenes.gift.cooldownMs = 3000;
  config.dedupeWindowMs = 5000; runtime.configure(config);
  assert.equal(runtime.speak('😀'.repeat(30), { scene: 'gift' }), true);
  assert.equal([...played[0].text].length, 20);
  assert.ok(played[0].text.startsWith('全局，互动，'));
  assert.equal(runtime.speak('another', { scene: 'gift' }), false);
  advance(3001);
  assert.equal(runtime.speak('another', { scene: 'gift' }), true);
  runtime.stop();
  config.enabled = false; runtime.configure(config);
  assert.equal(runtime.speak('disabled'), false);
});
test('preview is draft-only and stale preview cleanup cannot stop production speech', () => {
  const { runtime, config, played } = setup();
  const draft = { ...config, rate: 1.8, enabled: false };
  const token = runtime.preview('preview', draft);
  assert.equal(played[0].config.rate, 1.8);
  assert.equal(runtime.speak('ignored'), false);
  played[0].done();
  runtime.speak('live');
  runtime.stopPreview(token);
  assert.equal(runtime.getState().currentText, 'live');
  assert.equal(played[1].config.rate, 1);
});
test('pause freezes timeout, errors advance the queue, owner cleanup preserves system speech', () => {
  const { runtime, played, timeout } = setup();
  runtime.speak('system');
  runtime.speak('game', { owner: 'quiz' });
  runtime.clearOwner('quiz');
  runtime.pause(); timeout();
  assert.equal(runtime.getState().status, 'paused');
  runtime.resume();
  runtime.speak('next');
  played[0].done('network');
  assert.equal(played[1].text, 'next');
  timeout();
  assert.equal(runtime.getState().status, 'error');
  assert.equal(runtime.getState().queueSize, 0);
});
test('production playback stays blocked until configuration succeeds', () => {
  const runtime = createVoiceManager({ supported: true, play() { throw new Error('must not play'); }, cancel() {}, pause() {}, resume() {} });
  assert.equal(runtime.speak('before load'), false);
});
test('late browser start events do not override a paused state', () => {
  let start: (() => void) | undefined;
  const runtime = createVoiceManager({
    supported: true, play(_text, _config, _done, started) { start = started; return ''; }, cancel() {}, pause() {}, resume() {}
  }, { now: () => 0, set: () => 1, clear() {} });
  runtime.configure(createDefaultVoiceConfig());
  runtime.speak('starting');
  runtime.pause();
  start?.();
  assert.equal(runtime.getState().status, 'paused');
});
test('new interrupt requests cannot resume playback while the user has paused', () => {
  const { runtime, config, played } = setup();
  config.queueMode = 'interrupt'; runtime.configure(config);
  runtime.speak('current');
  runtime.pause();
  runtime.speak('incoming');
  assert.equal(runtime.getState().status, 'paused');
  assert.equal(played.length, 1);
  runtime.resume();
  played[0].done();
  assert.equal(played[1].text, 'incoming');
});
test('clearing a paused game does not start queued system speech until resume', () => {
  const { runtime, played } = setup();
  runtime.speak('game', { owner: 'quiz' });
  runtime.speak('system', { owner: 'system' });
  runtime.pause();
  runtime.clearOwner('quiz');
  assert.equal(played.length, 1);
  assert.equal(runtime.getState().status, 'paused');
  runtime.resume();
  assert.equal(played[1].text, 'system');
});
test('resume unpauses the device when completion arrives during pause', () => {
  let done: (() => void) | undefined;
  let devicePaused = false;
  const playedWhilePaused: boolean[] = [];
  const runtime = createVoiceManager({
    supported: true,
    play(_text, _config, complete) { done = complete; playedWhilePaused.push(devicePaused); return ''; },
    cancel() {}, pause() { devicePaused = true; }, resume() { devicePaused = false; }
  }, { now: () => 0, set: () => 1, clear() {} });
  runtime.configure(createDefaultVoiceConfig());
  runtime.speak('first'); runtime.speak('second'); runtime.pause(); done?.();
  runtime.resume();
  assert.deepEqual(playedWhilePaused, [false, false]);
});
test('drop mode rejects requests even if paused current item was removed', () => {
  const { runtime, config } = setup();
  config.queueMode = 'drop'; runtime.configure(config);
  runtime.speak('game', { owner: 'quiz' }); runtime.pause(); runtime.clearOwner('quiz');
  assert.equal(runtime.speak('new'), false);
});
