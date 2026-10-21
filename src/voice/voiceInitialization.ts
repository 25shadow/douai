import { loadConfig } from '../services/configApi.ts';
import { normalizeVoiceConfig, type VoiceConfig } from './voiceConfig.ts';
import { voiceManager } from './voiceManager.ts';

export async function initializeVoice(
  loader: () => Promise<VoiceConfig> = async () => { const c = await loadConfig(); return normalizeVoiceConfig(c.voiceConfig, c as unknown as Record<string, unknown>); },
  runtime = voiceManager
) {
  try {
    const config = await loader();
    runtime.configure(config);
    return config;
  } catch (error) {
    runtime.block(error instanceof Error ? error.message : '语音配置加载失败');
    throw error;
  }
}
let pending: Promise<VoiceConfig> | undefined;
export function ensureVoiceInitialized() {
  if (!pending) pending = initializeVoice().catch(error => { pending = undefined; throw error; });
  return pending;
}
