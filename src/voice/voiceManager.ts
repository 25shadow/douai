import { browserSpeech, type SpeechAdapter } from './browserSpeech.ts';
import { createDefaultVoiceConfig, validateVoiceConfig, type GameVoiceScene, type VoiceConfig, type VoiceScene } from './voiceConfig.ts';

export interface VoiceState {
  status: 'idle' | 'starting' | 'speaking' | 'paused' | 'unsupported' | 'error';
  currentText: string; queueSize: number; error: string; warning: string; preview: boolean; ready: boolean;
}
export interface SpeakOptions { scene?: VoiceScene; owner?: string }
interface Item { text: string; scene: VoiceScene; owner: string; priority: number; config: VoiceConfig; token?: string }
interface Clock { now(): number; set(fn: () => void, ms: number): unknown; clear(id: unknown): void }
const realClock: Clock = { now: Date.now, set: (fn, ms) => setTimeout(fn, ms), clear: id => clearTimeout(id as ReturnType<typeof setTimeout>) };

export function createVoiceManager(adapter: SpeechAdapter, clock: Clock = realClock) {
  let config = createDefaultVoiceConfig();
  let queue: Item[] = [];
  let current: Item | undefined;
  let generation = 0;
  let tokenCounter = 0;
  let timeout: unknown;
  let deadline = 0;
  let remaining = 0;
  let paused = false;
  const recent = new Map<string, number>();
  const cooldown = new Map<string, number>();
  let lastChatAnnouncementAt = -Infinity;
  const gamePolicies: Record<GameVoiceScene, VoiceConfig['scenes'][keyof VoiceConfig['scenes']]> = {
    quiz: { enabled: true, template: '', prefix: '', priority: 3, maxLength: 1000, cooldownMs: 0, output: { voice: true, text: false } },
    answer: { enabled: true, template: '', prefix: '', priority: 0, maxLength: 200, cooldownMs: 3000, output: { voice: true, text: false } },
    system: { enabled: true, template: '', prefix: '', priority: 3, maxLength: 300, cooldownMs: 0, output: { voice: true, text: false } }
  };
  const listeners = new Set<(state: VoiceState) => void>();
  const state: VoiceState = { status: adapter.supported ? 'idle' : 'unsupported', currentText: '', queueSize: 0, error: '', warning: '', preview: false, ready: false };
  const emit = () => {
    state.queueSize = queue.length; state.currentText = current?.text || ''; state.preview = !!current?.token;
    listeners.forEach(fn => fn({ ...state }));
  };
  const clearTimer = () => { if (timeout !== undefined) clock.clear(timeout); timeout = undefined; };
  function cancelCurrent() {
    generation++; clearTimer(); current = undefined; adapter.cancel();
    // Cancel does not reset the paused flag in every browser.
    adapter.resume();
  }
  function armTimer(id: number) {
    clearTimer(); deadline = clock.now() + remaining;
    timeout = clock.set(() => {
      if (id !== generation || !current) return;
      finish(id, '语音播放超时，已跳过当前内容', true);
    }, remaining);
  }
  function finish(id: number, error = '', cancel = false) {
    if (id !== generation || !current) return;
    clearTimer();
    if (cancel) cancelCurrent();
    else { generation++; current = undefined; }
    state.error = error || state.error; state.status = paused ? 'paused' : error ? 'error' : 'idle';
    emit(); pump();
  }
  function pump() {
    if (paused || current || !queue.length) return;
    current = queue.shift()!;
    const item = current;
    const id = ++generation;
    state.status = 'starting'; state.warning = '';
    remaining = Math.max(30000, Math.min(300000, [...item.text].length / (3 * item.config.rate) * 1000 + 15000));
    armTimer(id); emit();
    try {
      const warning = adapter.play(item.text, item.config, error => finish(id, error), () => {
        if (generation !== id || !current || paused) return;
        state.status = 'speaking'; emit();
      });
      if (generation === id) { state.warning = warning; emit(); }
    } catch (error) { finish(id, error instanceof Error ? error.message : '语音引擎异常', true); }
  }
  function stop() {
    queue = []; paused = false; cancelCurrent(); state.status = adapter.supported ? 'idle' : 'unsupported'; emit();
  }
  function configure(next: VoiceConfig) {
    config = validateVoiceConfig(next); state.ready = true;
    if (!config.enabled) stop();
    emit();
  }
  function speak(text: string, options: SpeakOptions = {}, continuation = false) {
    if (!adapter.supported || !state.ready || !config.enabled || current?.token) return false;
    const scene = options.scene || 'system';
    const owner = options.owner || 'system';
    const policy = scene in config.scenes
      ? config.scenes[scene as keyof VoiceConfig['scenes']]
      : gamePolicies[scene as GameVoiceScene];
    const body = text.trim().replace(/\s+/g, ' ');
    if (!policy.enabled || !body) return false;
    const now = clock.now();
    if (scene === 'system' && owner === 'live-events') {
      if (now - lastChatAnnouncementAt < config.chat.cooldownMs) return false;
      lastChatAnnouncementAt = now;
    }
    const key = `${owner}:${scene}:${body}`;
    const sceneKey = `${owner}:${scene}`;
    for (const [entry, time] of recent) if (now - time >= config.dedupeWindowMs) recent.delete(entry);
    if (recent.has(key) || now - (cooldown.get(sceneKey) ?? -Infinity) < policy.cooldownMs) return false;
    if (!continuation && config.queueMode === 'drop' && (paused || current || queue.length)) return false;
    const shouldInterrupt = !continuation && config.queueMode === 'interrupt' && !paused && current && policy.priority >= current.priority;
    if (!shouldInterrupt && queue.length >= config.maxQueueSize) {
      const lowest = Math.min(...queue.map(item => item.priority));
      if (policy.priority <= lowest) return false;
      queue.splice(queue.findIndex(item => item.priority === lowest), 1);
    }
    if (shouldInterrupt) cancelCurrent();
    const content = [config.prefix.trim(), policy.prefix.trim(), body].filter(Boolean).join('，');
    queue.push({ text: [...content].slice(0, policy.maxLength).join(''), scene, owner, priority: policy.priority, config: validateVoiceConfig(config) });
    queue.sort((a, b) => b.priority - a.priority);
    recent.set(key, now); cooldown.set(sceneKey, now); state.error = '';
    pump(); emit(); return true;
  }
  function clearOwner(owner: string, scenes?: VoiceScene[]) {
    const matches = (item: Item) => item.owner === owner && (!scenes || scenes.includes(item.scene));
    queue = queue.filter(item => !matches(item));
    if (current && matches(current)) { cancelCurrent(); state.status = paused ? 'paused' : 'idle'; }
    if (!scenes) {
      for (const key of recent.keys()) if (key.startsWith(`${owner}:`)) recent.delete(key);
      for (const key of cooldown.keys()) if (key.startsWith(`${owner}:`)) cooldown.delete(key);
    }
    pump(); emit();
  }
  function preview(text: string, draft: VoiceConfig) {
    const settings = validateVoiceConfig(draft);
    if (!adapter.supported) throw new Error('当前浏览器不支持语音合成');
    if (!text.trim() || [...text].length > 1000) throw new Error('试听内容应为 1 到 1000 个字符');
    stop();
    const token = `preview-${++tokenCounter}`;
    const content = [settings.prefix.trim(), text.trim()].filter(Boolean).join('，');
    queue.push({ text: [...content].slice(0, 1000).join(''), scene: 'system', owner: token, priority: 3, config: settings, token });
    state.error = ''; pump(); return token;
  }
  return {
    configure, speak, stop, clearOwner, preview,
    getConfig: () => validateVoiceConfig(config),
    speakSequence(items: Array<{ text: string; options: SpeakOptions }>) {
      let accepted = false;
      for (const item of items) if (speak(item.text, item.options, accepted)) accepted = true;
      return accepted;
    },
    stopPreview(token: string) { if (current?.token === token) stop(); },
    pause() {
      if (!current || paused) return;
      paused = true;
      remaining = Math.max(1, deadline - clock.now()); clearTimer();
      adapter.pause(); state.status = 'paused'; emit();
    },
    resume() {
      if (!paused) return;
      paused = false;
      adapter.resume();
      if (current) { state.status = 'speaking'; armTimer(generation); }
      else { state.status = 'idle'; pump(); }
      emit();
    },
    block(error: string) { stop(); state.ready = false; state.error = error; state.status = 'error'; emit(); },
    getState: (): VoiceState => ({ ...state }),
    subscribe(fn: (value: VoiceState) => void) { listeners.add(fn); fn({ ...state }); return () => listeners.delete(fn); }
  };
}
export const voiceManager = createVoiceManager(browserSpeech);
export const setVoiceConfig = voiceManager.configure;
export const speak = voiceManager.speak;
export const stopVoice = voiceManager.stop;
export const clearVoiceOwner = voiceManager.clearOwner;
export const speakSequence = voiceManager.speakSequence;
