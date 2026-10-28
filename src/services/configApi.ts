import { normalizeVoiceConfig, validateVoiceConfig, type VoiceConfig } from '../voice/voiceConfig.ts';
import type { QuizThemeId } from '../game/quiz/quizThemes.ts';
export interface ProjectConfig {
  voiceConfig?: VoiceConfig;
  roomId: string;
  relayUrl: string;
  autoStart: boolean;
  pauseOnDisconnect: boolean;
  voiceEnabled: boolean;
  voiceVolume: number;
  voiceRate: number;
  voicePrefix: string;
  simulationConfig: {
    durationMinutes: number;
    audience: number;
    eventIntervalSeconds: number;
  };
  quizConfig: {
    theme: QuizThemeId;
    bank: string;
    count: number;
    answerTime: number;
    revealTime: number;
    interval: number;
    countdown: number;
    voice: boolean;
    autoNext: boolean;
    likes: boolean;
    gameDurationMinutes: number;
    likeRules: Array<{ threshold: number; effect: 'eliminate' | 'extend-time' | 'none'; amount: number }>;
    giftRules: Array<{ minimumCoins: number; effect: 'answer' | 'win' | 'none' }>;
    customBanks: Record<string, Array<{ title: string; options: Record<'A' | 'B' | 'C' | 'D', string>; answer: 'A' | 'B' | 'C' | 'D' }>>;
    customQuestions: Array<{ title: string; options: Record<'A' | 'B' | 'C' | 'D', string>; answer: 'A' | 'B' | 'C' | 'D' }>;
  };
  aiConfig: { baseUrl: string; apiKey: string; model: string };
}

const fallback: ProjectConfig = {
  roomId: '',
  relayUrl: '',
  autoStart: false,
  pauseOnDisconnect: true,
  voiceEnabled: true,
  voiceVolume: 0.85,
  voiceRate: 1,
  voicePrefix: '',
  simulationConfig: {
    durationMinutes: 5,
    audience: 120,
    eventIntervalSeconds: 3
  },
  quizConfig: {
    theme: 'arena', bank: '基础知识题库', count: 3, answerTime: 30, revealTime: 5, interval: 5,
    countdown: 5, voice: true, autoNext: true, likes: true, gameDurationMinutes: 60,
    likeRules: [
      { threshold: 500, effect: 'eliminate', amount: 1 },
      { threshold: 1000, effect: 'extend-time', amount: 10 }
    ],
    giftRules: [
      { minimumCoins: 1, effect: 'answer' },
      { minimumCoins: 11, effect: 'win' }
    ],
    customBanks: {}, customQuestions: []
  },
  aiConfig: {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4o-mini'
  }
};

type LegacyStorage = Pick<Storage, 'getItem' | 'removeItem'>;
type Fetcher = typeof fetch;
const API_BASE_URL = (import.meta as ImportMeta & { env?: { PROD?: boolean } }).env?.PROD
  ? 'http://127.0.0.1:8787'
  : '';
const apiUrl = (path: string) => `${API_BASE_URL}${path}`;

function getBrowserStorage(storage?: LegacyStorage): LegacyStorage | undefined {
  if (storage) return storage;
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

export async function migrateLegacyBrowserConfig(fetcher: Fetcher = fetch, providedStorage?: LegacyStorage) {
  const storage = getBrowserStorage(providedStorage);
  if (!storage) return null;

  const legacy: Record<string, unknown> = {};
  const keys: string[] = [];
  const roomId = storage.getItem('douai-room-id');
  const relayUrl = storage.getItem('douai-relay-url');
  const simulationConfig = storage.getItem('douai-live-simulation-config');
  if (roomId) {
    legacy.roomId = roomId;
    keys.push('douai-room-id');
  }
  if (relayUrl) {
    legacy.relayUrl = relayUrl;
    keys.push('douai-relay-url');
  }
  if (simulationConfig) {
    try {
      legacy.simulationConfig = JSON.parse(simulationConfig);
      keys.push('douai-live-simulation-config');
    } catch {
      // Keep malformed legacy data in place for manual recovery.
    }
  }
  if (!keys.length) return null;

  try {
    const response = await fetcher(apiUrl('/api/config/migrate-legacy'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(legacy)
    });
    if (!response.ok) throw new Error('迁移请求失败');
    const result = await response.json() as { config: ProjectConfig; consumedKeys: string[] };
    (result.consumedKeys || []).forEach(key => {
      if (keys.includes(key)) storage.removeItem(key);
    });
    return result.config;
  } catch (error) {
    throw new Error(`SQLite 配置迁移失败：${error instanceof Error ? error.message : '未知错误'}`);
  }
}

export async function loadConfig(fetcher: Fetcher = fetch): Promise<ProjectConfig> {
  try {
    await migrateLegacyBrowserConfig(fetcher);
    const response = await fetcher(apiUrl('/api/config'));
    if (!response.ok) throw new Error('读取请求失败');
    const data = await response.json();
    return { ...fallback, ...data, voiceConfig: normalizeVoiceConfig(data.voiceConfig, data) };
  } catch (error) {
    throw new Error(`SQLite 配置服务不可用：${error instanceof Error ? error.message : '未知错误'}`);
  }
}

export async function saveVoiceConfig(config: VoiceConfig, fetcher: Fetcher = fetch): Promise<VoiceConfig> {
  const response = await fetcher(apiUrl('/api/config/voice'), {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(validateVoiceConfig(config))
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '语音配置保存失败');
  return validateVoiceConfig(result);
}

export async function saveConfig(config: ProjectConfig, fetcher: Fetcher = fetch): Promise<void> {
  try {
    const response = await fetcher(apiUrl('/api/config'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    if (!response.ok) throw new Error('保存请求失败');
    await response.json();
  } catch (error) {
    throw new Error(`SQLite 配置保存失败：${error instanceof Error ? error.message : '未知错误'}`);
  }
}

export async function generateQuestionBank(input: { theme: string; count: number; difficulty: string; aiConfig: ProjectConfig['aiConfig'] }) {
  const response = await fetch(apiUrl('/api/ai/generate'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, ...input.aiConfig })
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'AI 题库生成失败');
  return result.bank as { category?: string; results: Array<{ question: string; correct_answer: string; incorrect_answers: string[] }> };
}
