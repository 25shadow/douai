import test from 'node:test';
import assert from 'node:assert/strict';
import { CastMethod, SocialAction, type DyMessage } from '../../core/type.ts';
import { createDefaultVoiceConfig } from '../voiceConfig.ts';
import { createLiveAnnouncement } from '../liveAnnouncements.ts';

test('gift announcement uses editable text and replaces event variables', () => {
  const config = createDefaultVoiceConfig();
  config.scenes.gift.template = '谢谢{昵称}的{礼物}，共{数量}个';
  const result = createLiveAnnouncement({
    id: '1', method: CastMethod.GIFT, user: { name: '小星' },
    gift: { name: '小心心', count: 3, repeatEnd: 0 }
  }, config);
  assert.deepEqual(result, { scene: 'gift', text: '谢谢小星的小心心，共3个' });
});

test('likes, follows, shares, and room entry map only to their matching generic scenes', () => {
  const config = createDefaultVoiceConfig();
  assert.equal(createLiveAnnouncement({ id: '2', method: CastMethod.LIKE, user: { name: '阿青' }, content: '点赞(25)' } as DyMessage, config)?.text, '感谢阿青点赞25次！');
  assert.equal(createLiveAnnouncement({ id: '3', method: CastMethod.SOCIAL, user: { name: '阿青' }, social: { action: SocialAction.Follow } }, config)?.scene, 'follow');
  assert.equal(createLiveAnnouncement({ id: '4', method: CastMethod.SOCIAL, user: { name: '阿青' }, social: { action: SocialAction.Share } }, config)?.scene, 'share');
  assert.equal(createLiveAnnouncement({ id: '5', method: CastMethod.MEMBER, user: { name: '阿青' } }, config)?.scene, 'join');
  assert.equal(createLiveAnnouncement({ id: '6', method: CastMethod.CHAT, content: 'hello' }, config), undefined);
});

test('disabled scenes and intermediate gift-combo events are not announced', () => {
  const config = createDefaultVoiceConfig();
  config.scenes.gift.enabled = false;
  assert.equal(createLiveAnnouncement({ id: '1', method: CastMethod.GIFT, gift: { repeatEnd: 0 } }, config), undefined);
  config.scenes.gift.enabled = true;
  assert.equal(createLiveAnnouncement({ id: '1', method: CastMethod.GIFT, gift: { repeatEnd: 1 } }, config), undefined);
});
