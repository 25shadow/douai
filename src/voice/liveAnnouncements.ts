import { CastMethod, SocialAction, type DyMessage } from '../core/type.ts';
import type { VoiceConfig, LiveVoiceScene } from './voiceConfig';
import { speak, voiceManager } from './voiceManager.ts';

const fallbackName = '观众';

export function createLiveAnnouncement(message: DyMessage, config: VoiceConfig) {
  let scene: LiveVoiceScene;
  let values: Record<string, string>;
  const name = message.user?.name?.trim() || fallbackName;
  switch (message.method) {
    case CastMethod.GIFT:
      if (message.gift?.repeatEnd !== undefined && message.gift.repeatEnd !== 0) return;
      scene = 'gift';
      values = { 昵称: name, 礼物: message.gift?.name || '礼物', 数量: String(message.gift?.count || 1) };
      break;
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
  return { scene, text };
}

export function announceLiveMessage(message: DyMessage) {
  const config = voiceManager.getConfig();
  const announcement = createLiveAnnouncement(message, config);
  return announcement ? speak(announcement.text, { scene: announcement.scene, owner: 'live-events' }) : false;
}
