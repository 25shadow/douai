import type { DyMessage } from '../core/type';

export interface LiveFeedItem {
  id: string;
  kind: 'chat' | 'gift' | 'like';
  userName: string;
  userAvatar?: string;
  detail: string;
  giftIcon?: string;
}

export function createLiveFeedItems(messages: DyMessage[]): LiveFeedItem[] {
  return messages.flatMap<LiveFeedItem>(message => {
    const userName = message.user?.name || '观众';
    const userAvatar = message.user?.avatar;
    if (message.method === 'WebcastChatMessage') {
      return [{ id: message.id, kind: 'chat' as const, userName, userAvatar, detail: message.content || '发送了一条评论' }];
    }
    if (message.method === 'WebcastGiftMessage') {
      const giftName = message.gift?.name || '礼物';
      const count = message.gift?.count || 1;
      return [{
        id: message.id,
        kind: 'gift' as const,
        userName,
        userAvatar,
        detail: `送出 ${giftName} × ${count}`,
        giftIcon: message.gift?.icon
      }];
    }
    if (message.method === 'WebcastLikeMessage') {
      return [{ id: message.id, kind: 'like' as const, userName, userAvatar, detail: message.content || '为主播点赞' }];
    }
    return [];
  });
}
