import test from 'node:test';
import assert from 'node:assert/strict';
import { createLiveFeedItems } from '../../../services/liveFeed.ts';

test('creates console feed entries for quiz chat, gifts, and likes', () => {
  const items = createLiveFeedItems([
    {
      id: 'chat-1',
      method: 'WebcastChatMessage',
      user: { name: '小明' },
      content: 'A'
    },
    {
      id: 'gift-1',
      method: 'WebcastGiftMessage',
      user: { name: '小红' },
      gift: { name: '小心心', count: 3 }
    },
    {
      id: 'like-1',
      method: 'WebcastLikeMessage',
      user: { name: '小刚' },
      content: '为主播点赞了(10)'
    },
    { id: 'member-1', method: 'WebcastMemberMessage', content: '进入直播间' }
  ]);

  assert.deepEqual(items.map(item => item.kind), ['chat', 'gift', 'like']);
  assert.equal(items[1].detail, '送出 小心心 × 3');
  assert.equal(items[2].detail, '为主播点赞了(10)');
});

test('preserves participant avatars for comments, gifts and likes', () => {
  const items = createLiveFeedItems([
    { id: 'chat-avatar', method: 'WebcastChatMessage', user: { name: '评论用户', avatar: 'https://example.test/chat.jpg' }, content: '你好' },
    { id: 'gift-avatar', method: 'WebcastGiftMessage', user: { name: '送礼用户', avatar: 'https://example.test/gift-user.jpg' }, gift: { name: '礼物', icon: 'https://example.test/gift.png' } },
    { id: 'like-avatar', method: 'WebcastLikeMessage', user: { name: '点赞用户', avatar: 'https://example.test/like.jpg' } },
    { id: 'no-avatar', method: 'WebcastChatMessage', content: '无用户信息' }
  ]);
  assert.deepEqual(items.map(item => item.userAvatar), [
    'https://example.test/chat.jpg', 'https://example.test/gift-user.jpg', 'https://example.test/like.jpg', undefined
  ]);
  assert.equal(items[1].giftIcon, 'https://example.test/gift.png');
  assert.equal(items[3].userName, '观众');
});
