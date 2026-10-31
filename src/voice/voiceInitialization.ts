import { loadConfig } from '../services/configApi.ts';
import { normalizeVoiceConfig, type VoiceConfig } from './voiceConfig.ts';
import { voiceManager } from './voiceManager.ts';

export interface VoiceInitializationRetryOptions {
  retries?: number;
  delayMs?: number;
}

async function loadWithRetry<T>(
  loader: () => Promise<T>,
    { retries = 8, delayMs = 400 }: VoiceInitializationRetryOptions = {}
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await loader();
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
      if (delayMs > 0) await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('语音配置加载失败');
}

export async function initializeVoice(
  loader: () => Promise<VoiceConfig> = async () => { const c = await loadConfig(); return normalizeVoiceConfig(c.voiceConfig, c as unknown as Record<string, unknown>); },
  runtime = voiceManager,
  retryOptions: VoiceInitializationRetryOptions = {}
) {
  try {
    const config = await loadWithRetry(loader, retryOptions);
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
