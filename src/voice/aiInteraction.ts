import type { DyMessage } from '../core/type.ts';
import type { AiInteractionPolicy } from './voiceConfig.ts';

export type AiDecisionReason = 'disabled' | 'not-triggered' | 'unsafe' | 'cooldown' | 'session-limit' | 'accepted';
export interface AiDecision { accepted: boolean; reason: AiDecisionReason; userId: string; prompt: string }

const linkPattern = /(https?:\/\/|www\.)/i;
const adPattern = /(加微信|加v|vx|私聊|代理|返利|刷单|博彩)/i;

export function decideAiInteraction(message: DyMessage, policy: AiInteractionPolicy, now = Date.now(), state: AiRuntimeState = createAiRuntimeState()): AiDecision {
  const userId = message.user?.id || message.user?.name || 'anonymous';
  const body = (message.content || message.rtfContent?.map(item => item.text || '').join('') || '').trim().replace(/\s+/g, ' ');
  if (!policy.enabled) return { accepted: false, reason: 'disabled', userId, prompt: body };
  if (!body || message.method !== 'WebcastChatMessage') return { accepted: false, reason: 'not-triggered', userId, prompt: body };
  const triggered = policy.triggerMode === 'smart'
    ? true
    : policy.triggerMode === 'mention'
    ? /@主播|@douai|@我\b/i.test(body)
    : policy.keywords.some(keyword => keyword.trim() && body.includes(keyword.trim()));
  if (!triggered) return { accepted: false, reason: 'not-triggered', userId, prompt: body };
  if ((policy.blockLinks && linkPattern.test(body)) || (policy.blockAds && adPattern.test(body))
    || policy.blockedKeywords.some(keyword => keyword && body.includes(keyword))) {
    return { accepted: false, reason: 'unsafe', userId, prompt: body };
  }
  if (now - state.lastGlobalAt < policy.globalCooldownMs || now - (state.userAt.get(userId) ?? -Infinity) < policy.userCooldownMs) {
    return { accepted: false, reason: 'cooldown', userId, prompt: body };
  }
  if (state.sessionCount >= policy.maxPerSession || state.minuteEntries.filter(time => now - time < 60000).length >= policy.maxPerMinute) {
    return { accepted: false, reason: 'session-limit', userId, prompt: body };
  }
  return { accepted: true, reason: 'accepted', userId, prompt: [...body].slice(0, 500).join('') };
}

export interface AiRuntimeState {
  lastGlobalAt: number;
  userAt: Map<string, number>;
  minuteEntries: number[];
  sessionCount: number;
}

export function createAiRuntimeState(): AiRuntimeState {
  return { lastGlobalAt: -Infinity, userAt: new Map(), minuteEntries: [], sessionCount: 0 };
}

export function commitAiInteraction(state: AiRuntimeState, userId: string, now = Date.now()) {
  state.lastGlobalAt = now;
  state.userAt.set(userId, now);
  state.minuteEntries = [...state.minuteEntries.filter(time => now - time < 60000), now];
  state.sessionCount += 1;
}
