import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserSpeech } from '../browserSpeech.ts';
import { createDefaultVoiceConfig } from '../voiceConfig.ts';

test('catalog detects late voices and disposes only its own subscription', () => {
  const events = new EventTarget();
  let voices: any[] = [];
  const adapter = createBrowserSpeech({
    SpeechSynthesisUtterance: class {},
    speechSynthesis: { getVoices: () => voices, addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events) }
  } as any);
  assert.equal(adapter.voices().length, 0);
  let changes = 0;
  const dispose = adapter.subscribeVoices(() => changes++);
  voices = [{ voiceURI: 'late', name: 'Late', lang: 'zh-CN', localService: true, default: true }];
  events.dispatchEvent(new Event('voiceschanged'));
  assert.equal(changes, 1);
  assert.equal(adapter.voices()[0].voiceURI, 'late');
  dispose();
  events.dispatchEvent(new Event('voiceschanged'));
  assert.equal(changes, 1);
});
test('browser utterance applies the chosen voice and parameters and reports useful failures', () => {
  let utterance: any;
  const voice = { voiceURI: 'zh', name: 'Chinese', lang: 'zh-CN', localService: true, default: true };
  class Utterance { text: string; constructor(text: string) { this.text = text; } }
  const adapter = createBrowserSpeech({ SpeechSynthesisUtterance: Utterance, speechSynthesis: {
    getVoices: () => [voice], speak: (value: any) => { utterance = value; }, cancel() {}, pause() {}, resume() {}
  } } as any);
  const config = createDefaultVoiceConfig();
  config.voiceURI = 'zh'; config.pitch = 1.3; config.rate = 1.4; config.volume = .6;
  let error = '';
  adapter.play('真实文本', config, value => { error = value || ''; });
  assert.equal(utterance.text, '真实文本');
  assert.equal(utterance.voice, voice);
  assert.equal(utterance.pitch, 1.3);
  assert.equal(utterance.rate, 1.4);
  assert.equal(utterance.volume, .6);
  utterance.onerror({ error: 'not-allowed' });
  assert.match(error, /手动点击试听/);
});
