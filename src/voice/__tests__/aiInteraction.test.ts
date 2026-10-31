import test from 'node:test';
import assert from 'node:assert/strict';
import { CastMethod, type DyMessage } from '../../core/type.ts';
import { createDefaultVoiceConfig } from '../voiceConfig.ts';
import { commitAiInteraction, createAiRuntimeState, decideAiInteraction } from '../aiInteraction.ts';

const chat = (content: string, user = 'u1'): DyMessage => ({ id: content, method: CastMethod.CHAT, user: { id: user, name: user }, content });

test('AI only accepts explicit triggers and rejects unsafe content', () => {
  const policy = createDefaultVoiceConfig().aiInteraction;
  policy.enabled = true;
  policy.triggerMode = 'mention';
  assert.equal(decideAiInteraction(chat('晚上好'), policy).reason, 'not-triggered');
  assert.equal(decideAiInteraction(chat('@主播 你是谁'), policy).accepted, true);
  assert.equal(decideAiInteraction(chat('@主播 加微信领取福利'), policy).reason, 'unsafe');
});

test('smart mode lets the AI decide whether ordinary chat is worth answering', () => {
  const policy = createDefaultVoiceConfig().aiInteraction;
  policy.enabled = true;
  assert.equal(decideAiInteraction(chat('晚上好'), policy).accepted, true);
});

test('AI runtime enforces global, user, minute and session limits', () => {
  const policy = createDefaultVoiceConfig().aiInteraction;
  policy.enabled = true; policy.maxPerMinute = 1; policy.maxPerSession = 1;
  const state = createAiRuntimeState();
  assert.equal(decideAiInteraction(chat('@主播 hi', 'u1'), policy, 1000, state).accepted, true);
  commitAiInteraction(state, 'u1', 1000);
  assert.equal(decideAiInteraction(chat('@主播 again', 'u2'), policy, 2000, state).reason, 'cooldown');
  assert.equal(decideAiInteraction(chat('@主播 again', 'u2'), policy, 70000, state).reason, 'session-limit');
});
