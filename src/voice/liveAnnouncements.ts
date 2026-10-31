import { CastMethod, SocialAction, type DyMessage } from '../core/type.ts';
import type { VoiceConfig, LiveVoiceScene } from './voiceConfig';
import { speak, voiceManager } from './voiceManager.ts';
import { generateAiReply, type ProjectConfig } from '../services/configApi.ts';
import { commitAiInteraction, createAiRuntimeState, decideAiInteraction } from './aiInteraction.ts';

const fallbackName = '观众';
let lastAnnouncedGiftSig = '';
let lastAnnouncedGiftAt = 0;
let aiProjectConfig: ProjectConfig['aiConfig'] | undefined;
const aiRuntime = createAiRuntimeState();
const aiHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];
let textPublisher: ((text: string) => void) | undefined = text => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('douai:publish-text', { detail: { text } }));
  }
};

export function configureAiInteraction(aiConfig?: ProjectConfig['aiConfig']) {
  aiProjectConfig = aiConfig;
}
export function configureTextPublisher(publisher?: (text: string) => void) {
  textPublisher = publisher;
}

function runAiInteraction(message: DyMessage, config: VoiceConfig): boolean {
  if (message.method !== CastMethod.CHAT || !config.aiInteraction.enabled || !aiProjectConfig) return false;
  const decision = decideAiInteraction(message, config.aiInteraction, Date.now(), aiRuntime);
  if (!decision.accepted) return false;

  commitAiInteraction(aiRuntime, decision.userId);
  void generateAiReply({
    prompt: decision.prompt,
    history: aiHistory.slice(-config.aiInteraction.recentMessageCount),
    policy: config.aiInteraction,
    aiConfig: aiProjectConfig
  }).then(({ reply }) => {
    const safeReply = reply || config.aiInteraction.fallbackText;
    aiHistory.push({ role: 'user', content: decision.prompt }, { role: 'assistant', content: safeReply });
    while (aiHistory.length > config.aiInteraction.recentMessageCount * 2) aiHistory.shift();
    const text = `${message.user?.name || '观众'}，${safeReply}`;
    if (config.aiInteraction.output.text) textPublisher?.(text);
    if (config.aiInteraction.output.voice) speak(text, { scene: 'system', owner: 'ai-interaction' });
  }).catch(() => {
    if (config.aiInteraction.output.text) textPublisher?.(config.aiInteraction.fallbackText);
    if (config.aiInteraction.output.voice) speak(config.aiInteraction.fallbackText, { scene: 'system', owner: 'ai-interaction' });
  });
  return true;
}

export function createLiveAnnouncement(message: DyMessage, config: VoiceConfig) {
  if (message.method === CastMethod.CHAT) {
    const policy = config.chat;
    const body = (message.content || message.rtfContent?.map(item => item.text || '').join('') || '').trim().replace(/\s+/g, ' ');
    if (!policy.enabled || !body) return;
    if (policy.triggerMode === 'keyword' && !policy.keywords.some(keyword => keyword.trim() && body.includes(keyword.trim()))) return;
    const name = message.user?.name?.trim() || fallbackName;
    return { scene: 'system' as const, text: [...`${name}说：${body}`].slice(0, policy.maxLength).join(''), output: policy.output };
  }
  let scene: LiveVoiceScene;
  let values: Record<string, string>;
  const name = message.user?.name?.trim() || fallbackName;
  switch (message.method) {
    case CastMethod.GIFT: {
      const giftName = message.gift?.name || '礼物';
      const count = String(message.gift?.count || 1);
      const sig = `${message.user?.id || name}:${giftName}:${count}`;
      const now = Date.now();
      if (sig === lastAnnouncedGiftSig && now - lastAnnouncedGiftAt < 400) return;
      lastAnnouncedGiftSig = sig;
      lastAnnouncedGiftAt = now;
      scene = 'gift';
      values = { 昵称: name, 礼物: giftName, 数量: count };
      break;
    }
    case CastMethod.LIKE: {
      scene = 'like';
      const count = message.content?.match(/\((\d+)\)/)?.[1] || '1';
      values = { 昵称: name, 点赞数: count };
      break;
    }
    case CastMethod.MEMBER:
      scene = 'join';
      values = { 昵称: name };
      break;
    case CastMethod.SOCIAL:
      if (message.social?.action === SocialAction.Follow) scene = 'follow';
      else if (message.social?.action === SocialAction.Share) scene = 'share';
      else return;
      values = { 昵称: name };
      break;
    default:
      return;
  }
  const policy = config.scenes[scene];
  if (!policy.enabled) return;
  const text = policy.template.replace(/\{([^{}]+)\}/g, (token, key: string) => values[key] ?? token);
  if (text === policy.template && !text.trim()) return;
  return { scene, text, output: policy.output };
}

export function announceLiveMessage(message: DyMessage) {
  const config = voiceManager.getConfig();
  if (runAiInteraction(message, config)) return true;
  const announcement = createLiveAnnouncement(message, config);
  if (!announcement) return false;
  if (announcement.output.text) textPublisher?.(announcement.text);
  return announcement.output.voice
    ? speak(announcement.text, { scene: announcement.scene, owner: 'live-events' })
    : announcement.output.text;
}

export function announceAiHostMessage(message: DyMessage) {
  return runAiInteraction(message, voiceManager.getConfig());
}
