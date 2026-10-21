import type { VoiceConfig } from './voiceConfig.ts';

export interface VoiceDescriptor { voiceURI: string; name: string; lang: string; localService: boolean; default: boolean }
export interface SpeechAdapter {
  supported: boolean;
  play(text: string, config: VoiceConfig, done: (error?: string) => void, started?: () => void): string;
  cancel(): void; pause(): void; resume(): void;
}
export function resolveVoice<T extends VoiceDescriptor>(voices: T[], config: VoiceConfig) {
  const exact = voices.find(v => v.voiceURI === config.voiceURI && config.voiceURI);
  const voice = exact || voices.find(v => v.name === config.voiceName && v.lang === config.lang)
    || voices.find(v => v.lang.toLowerCase() === config.lang.toLowerCase())
    || voices.find(v => v.lang.split('-')[0] === config.lang.split('-')[0])
    || voices.find(v => v.default) || voices[0];
  return { voice, warning: config.voiceURI && !exact ? '已选音色不可用，本次使用替代音色' : '' };
}
export function createBrowserSpeech(host: (Window & typeof globalThis) | undefined = typeof window === 'undefined' ? undefined : window) {
  const synth = host?.speechSynthesis;
  const supported = !!synth && !!host?.SpeechSynthesisUtterance;
  let active: SpeechSynthesisUtterance | undefined;
  const adapter: SpeechAdapter & { voices(): VoiceDescriptor[]; subscribeVoices(listener: () => void): () => void } = {
    supported,
    voices: () => synth ? Array.from(synth.getVoices()) : [],
    subscribeVoices(listener) {
      synth?.addEventListener('voiceschanged', listener);
      return () => synth?.removeEventListener('voiceschanged', listener);
    },
    play(text, config, done, started) {
      if (!supported || !host || !synth) throw new Error('当前浏览器不支持语音合成');
      const result = resolveVoice(Array.from(synth.getVoices()), config);
      const utterance = new host.SpeechSynthesisUtterance(text);
      active = utterance;
      utterance.voice = result.voice || null;
      utterance.lang = config.lang;
      utterance.volume = config.volume; utterance.rate = config.rate; utterance.pitch = config.pitch;
      utterance.onstart = () => started?.();
      utterance.onend = () => { if (active === utterance) active = undefined; done(); };
      utterance.onerror = event => {
        if (active === utterance) active = undefined;
        const errors: Record<string, string> = {
          'not-allowed': '浏览器阻止自动播放，请手动点击试听后重试',
          'audio-busy': '音频设备被占用', 'audio-hardware': '音频设备不可用',
          network: '网络音色连接失败', 'synthesis-failed': '语音合成失败',
          'language-unavailable': '所选语言不可用', 'voice-unavailable': '所选音色不可用'
        };
        done(errors[event.error] || `语音播放失败：${event.error}`);
      };
      synth.speak(utterance);
      return result.warning;
    },
    cancel() { active = undefined; synth?.cancel(); },
    pause() { synth?.pause(); },
    resume() { synth?.resume(); }
  };
  return adapter;
}
export const browserSpeech = createBrowserSpeech();
