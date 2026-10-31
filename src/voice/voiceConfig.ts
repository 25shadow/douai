export const sceneNames = { gift: '收到礼物', like: '收到点赞', follow: '新增关注', join: '观众进场', share: '直播分享' } as const;
export type LiveVoiceScene = keyof typeof sceneNames;
export type GameVoiceScene = 'quiz' | 'answer' | 'system';
export type VoiceScene = LiveVoiceScene | GameVoiceScene;
export interface VoiceScenePolicy {
  enabled: boolean; template: string; prefix: string; priority: number; maxLength: number; cooldownMs: number;
  output: VoiceOutputPolicy;
}
export interface VoiceOutputPolicy { voice: boolean; text: boolean; }
export interface ChatVoicePolicy {
  enabled: boolean; triggerMode: 'all' | 'keyword'; keywords: string[]; maxLength: number; cooldownMs: number; output: VoiceOutputPolicy;
}
export interface AiInteractionPolicy {
  enabled: boolean; triggerMode: 'smart' | 'mention' | 'keyword'; keywords: string[];
  globalCooldownMs: number; userCooldownMs: number; maxLength: number;
  maxPerMinute: number; maxPerSession: number; requireConfidence: number;
  persona: 'friendly-host' | 'knowledge-host' | 'hype-host' | 'custom';
  interactionRule: string; systemPrompt: string; streamContext: string;
  blockedKeywords: string[]; blockLinks: boolean; blockAds: boolean; output: VoiceOutputPolicy;
  fallbackText: string; recentMessageCount: number; perUserMessageCount: number;
}
export interface VoiceConfig {
  version: 1; provider: 'browser'; enabled: boolean;
  voiceURI: string; voiceName: string; lang: string; favoriteVoiceURIs: string[];
  volume: number; rate: number; pitch: number; prefix: string;
  queueMode: 'queue' | 'interrupt' | 'drop'; maxQueueSize: number; dedupeWindowMs: number;
  chat: ChatVoicePolicy; aiInteraction: AiInteractionPolicy;
  scenes: Record<LiveVoiceScene, VoiceScenePolicy>;
}
export function createDefaultVoiceConfig(): VoiceConfig {
  const templates: Record<LiveVoiceScene, string> = {
    gift: '感谢{昵称}送出的{礼物}{数量}个！',
    like: '感谢{昵称}点赞{点赞数}次！',
    follow: '感谢{昵称}关注直播间！',
    join: '欢迎{昵称}来到直播间！',
    share: '感谢{昵称}分享直播间！'
  };
  const scenes = Object.fromEntries(Object.keys(sceneNames).map(key => [key, {
    enabled: true, template: templates[key as LiveVoiceScene], prefix: '', priority: ({ gift: 2, like: 1, follow: 2, join: 1, share: 1 } as Record<string, number>)[key],
    maxLength: 200, output: { voice: true, text: false },
    cooldownMs: key === 'like' || key === 'join' ? 3000 : key === 'gift' ? 1000 : 0
  }])) as VoiceConfig['scenes'];
  return { version: 1, provider: 'browser', enabled: true, voiceURI: '', voiceName: '', lang: 'zh-CN', favoriteVoiceURIs: [],
    volume: .85, rate: 1, pitch: 1, prefix: '', queueMode: 'queue', maxQueueSize: 10, dedupeWindowMs: 3000,
    chat: { enabled: true, triggerMode: 'all', keywords: [], maxLength: 100, cooldownMs: 3000, output: { voice: true, text: false } },
    aiInteraction: {
      enabled: false, triggerMode: 'smart', keywords: [], globalCooldownMs: 15000, userCooldownMs: 60000,
      maxLength: 100, maxPerMinute: 4, maxPerSession: 100, requireConfidence: .75,
      persona: 'friendly-host',
      interactionRule: '只回答和当前直播有关的问题；闲聊时自然回应，遇到重复刷屏、广告或无意义内容时保持安静；回答简短，不要抢主播的话。',
      systemPrompt: '', streamContext: '',
      blockedKeywords: [], blockLinks: true, blockAds: true,
      output: { voice: true, text: false },
      fallbackText: '这个问题我暂时不能确认，稍后再和你聊。', recentMessageCount: 20, perUserMessageCount: 3
    },
    scenes };
}
export function validateVoiceConfig(input: unknown): VoiceConfig {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('语音配置格式无效');
  const c = input as VoiceConfig;
  const number = (value: unknown, min: number, max: number, label: string, integer = false) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value)))
      throw new Error(`${label}应为 ${min} 到 ${max} 之间的${integer ? '整数' : '数字'}`);
  };
  const text = (value: unknown, max: number, label: string) => {
    if (typeof value !== 'string' || [...value].length > max) throw new Error(`${label}最多 ${max} 个字符`);
  };
  const output = (value: unknown, label: string): value is VoiceOutputPolicy => {
    if (!value || typeof value !== 'object') throw new Error(`${label}输出设置无效`);
    const item = value as VoiceOutputPolicy;
    if (typeof item.voice !== 'boolean' || typeof item.text !== 'boolean') throw new Error(`${label}输出设置无效`);
    if (!item.voice && !item.text) throw new Error(`${label}至少需要保留一种输出方式`);
    return true;
  };
  if (c.version !== 1 || c.provider !== 'browser' || typeof c.enabled !== 'boolean') throw new Error('语音配置版本或开关无效');
  for (const key of ['voiceURI', 'voiceName'] as const) text(c[key], 500, key);
  text(c.lang, 50, '语言'); text(c.prefix, 100, '播报前缀');
  number(c.volume, 0, 1, '音量'); number(c.rate, .5, 2, '语速'); number(c.pitch, 0, 2, '音高');
  number(c.maxQueueSize, 1, 50, '待播上限', true); number(c.dedupeWindowMs, 0, 60000, '去重时间', true);
  if (!['queue', 'interrupt', 'drop'].includes(c.queueMode)) throw new Error('队列策略无效');
  const chat = c.chat;
  if (!chat || typeof chat.enabled !== 'boolean' || !['all', 'keyword'].includes(chat.triggerMode)) throw new Error('弹幕朗读设置无效');
  number(chat.maxLength, 10, 500, '弹幕朗读字数', true); number(chat.cooldownMs, 0, 60000, '弹幕朗读冷却', true);
  output(chat.output, '弹幕');
  if (!Array.isArray(chat.keywords) || chat.keywords.length > 20) throw new Error('弹幕朗读关键词无效');
  chat.keywords.forEach(value => text(value, 50, '弹幕朗读关键词'));
  const ai = c.aiInteraction;
  if (!ai || typeof ai.enabled !== 'boolean' || !['smart', 'mention', 'keyword'].includes(ai.triggerMode)) throw new Error('AI互动设置无效');
  number(ai.globalCooldownMs, 1000, 300000, 'AI全局冷却', true);
  number(ai.userCooldownMs, 0, 3600000, 'AI单人冷却', true);
  number(ai.maxLength, 20, 500, 'AI回复字数', true);
  output(ai.output, 'AI互动');
  number(ai.maxPerMinute, 1, 60, 'AI每分钟回复数', true);
  number(ai.maxPerSession, 1, 1000, 'AI本场回复数', true);
  number(ai.requireConfidence, 0, 1, 'AI置信度');
  if (!['friendly-host', 'knowledge-host', 'hype-host', 'custom'].includes(ai.persona)) throw new Error('AI人格无效');
  text(ai.interactionRule, 2000, '互动规则'); text(ai.systemPrompt, 2000, 'AI系统提示词'); text(ai.streamContext, 500, '直播上下文'); text(ai.fallbackText, 200, 'AI兜底话术');
  number(ai.recentMessageCount, 0, 50, 'AI上下文条数', true);
  number(ai.perUserMessageCount, 0, 10, 'AI单用户上下文条数', true);
  if (typeof ai.blockLinks !== 'boolean' || typeof ai.blockAds !== 'boolean') throw new Error('AI风控开关无效');
  if (!Array.isArray(ai.keywords) || ai.keywords.length > 20) throw new Error('AI互动关键词无效');
  ai.keywords.forEach(value => text(value, 50, 'AI互动关键词'));
  for (const key of ['blockedKeywords'] as const) {
    if (!Array.isArray(ai[key]) || ai[key].length > 100) throw new Error('AI禁用词无效');
    ai[key].forEach(value => text(value, 50, 'AI禁用词'));
  }
  if (!Array.isArray(c.favoriteVoiceURIs) || c.favoriteVoiceURIs.length > 100) throw new Error('收藏最多 100 个音色');
  c.favoriteVoiceURIs.forEach(value => text(value, 500, '收藏音色'));
  for (const key of Object.keys(sceneNames) as LiveVoiceScene[]) {
    const policy = c.scenes?.[key];
    if (!policy || typeof policy.enabled !== 'boolean') throw new Error(`${sceneNames[key]}配置无效`);
    output(policy.output, sceneNames[key]);
    text(policy.template, 300, '播报内容'); text(policy.prefix, 100, '场景前缀'); number(policy.priority, 0, 3, '优先级', true);
    number(policy.maxLength, 20, 1000, '文本上限', true); number(policy.cooldownMs, 0, 60000, '冷却时间', true);
  }
  return JSON.parse(JSON.stringify(c));
}
export function normalizeVoiceConfig(input: unknown, legacy: Record<string, unknown> = {}): VoiceConfig {
  if (input !== undefined && input !== null) {
    const candidate = input as VoiceConfig & { scenes?: Record<string, VoiceScenePolicy> };
    if (candidate.scenes) {
      const defaults = createDefaultVoiceConfig();
      for (const key of Object.keys(sceneNames) as LiveVoiceScene[]) {
        const old = candidate.scenes[key];
        if (old) defaults.scenes[key] = { ...defaults.scenes[key], ...old, template: typeof old.template === 'string' ? old.template : defaults.scenes[key].template };
      }
      return validateVoiceConfig({
        ...defaults,
        ...candidate,
        chat: { ...defaults.chat, ...candidate.chat, enabled: true },
        aiInteraction: { ...defaults.aiInteraction, ...candidate.aiInteraction },
        scenes: defaults.scenes
      });
    }
    return validateVoiceConfig(input);
  }
  const c = createDefaultVoiceConfig();
  if (typeof legacy.voiceEnabled === 'boolean') c.enabled = legacy.voiceEnabled;
  if (typeof legacy.voiceVolume === 'number') c.volume = legacy.voiceVolume;
  if (typeof legacy.voiceRate === 'number') c.rate = legacy.voiceRate;
  if (typeof legacy.voicePrefix === 'string') c.prefix = legacy.voicePrefix;
  return validateVoiceConfig(c);
}
export function applyVoicePreset(config: VoiceConfig, preset: 'natural' | 'live' | 'quick'): VoiceConfig {
  const c = validateVoiceConfig(config);
  return { ...c, ...({ natural: { volume: .85, rate: 1, pitch: 1 }, live: { volume: 1, rate: 1.1, pitch: 1.05 }, quick: { volume: .9, rate: 1.4, pitch: 1 } })[preset] };
}
