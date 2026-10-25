/**
 * 连接状态
 *  - 0 - 未连接
 *  - 1 - 连接中(连接完成)
 *  - 2 - 连接失败
 *  - 3 - 已断开
 */
export type ConnectStatus = 0 | 1 | 2 | 3;

/** 直播间信息 */
export interface LiveRoom {
  /**
   * 在线观众数
   */
  audienceCount?: number | string;
  /**
   * 本场点赞数
   */
  likeCount?: number | string;
  /**
   * 主播粉丝数
   */
  followCount?: number | string;
  /**
   * 累计观看人数
   */
  totalUserCount?: number | string;
  /** 房间状态 */
  status?: number;
}

/** 直播间信息-连接信息 */
export interface DyLiveInfo {
  roomNum?: string;
  roomId: string;
  uniqueId: string;
  avatar: string;
  cover: string;
  nickname: string;
  title: string;
  status: number;
  audienceCount?: number | string;
  likeCount?: number | string;
  followCount?: number | string;
  totalUserCount?: number | string;
}
/** 直播间信息-初次连接信息 */
export interface DyImInfo {
  cursor?: string;
  fetchInterval?: string;
  now?: string;
  internalExt?: string;
  fetchType?: number;
  pushServer?: string;
  liveCursor?: string;
  messages?: unknown[];
}

/**
 * 送礼点赞榜
 */
export interface LiveRankItem {
  nickname: string;
  avatar: string;
  rank: number | string;
}

export interface CastUser {
  // user.sec_uid | user.id_str
  id?: string;
  // user.nickname
  name?: string;
  // user.avatar_thumb.url_list.0
  avatar?: string;
  // 性别 0 | 1 | 2 => 未知 | 男 | 女
  gender?: number;
}

export interface CastGift {
  id?: string;
  name?: string;
  // 抖音币 diamond_count
  price?: number;
  type?: number;
  // 描述
  desc?: string;
  // 图片
  icon?: string;
  // 数量 repeat_count | combo_count
  count?: number | string;
  // 礼物消息可能重复发送，0 表示第一次，未重复
  repeatEnd?: number;
}

/**
 * 富文本类型
 *  1 - 普通文本
 *  2 - 合并表情
 */
export enum CastRtfContentType {
  TEXT = 1,
  EMOJI = 2,
  USER = 3
}

// 富文本
export interface CastRtfContent {
  type?: CastRtfContentType;
  text?: string;
  url?: string;
  user?: CastUser;
}

/**
 * Social 消息-分享数据
 */
export interface CastSocial {
  action?: SocialAction;
  /**
   * 分享目标(猜测)
   *  - 当 social 为 关注时，target 为 主播id
   *  - 当 social 为 分享时，target 为 分享形式
   *    - -1 为链接分享
   *    - 112 为群聊分享
   *    - 20 ???
   */
  target?: string;
  /** 有是有，有时无 */
  type?: string;
}
/** 包装信息 */
export interface DyMessage {
  id: string;
  method: CastMethod;
  user?: CastUser;
  toUser?: CastUser;
  gift?: CastGift;
  content?: string;
  rtfContent?: CastRtfContent[];
  room?: LiveRoom;
  rank?: LiveRankItem[];
  social?: CastSocial;
}
export type PartialDyMessage = Partial<DyMessage>;
/**
 * 消息类型
 */
export enum CastMethod {
  CHAT = 'WebcastChatMessage',
  GIFT = 'WebcastGiftMessage',
  LIKE = 'WebcastLikeMessage',
  MEMBER = 'WebcastMemberMessage',
  SOCIAL = 'WebcastSocialMessage',
  ROOM_USER_SEQ = 'WebcastRoomUserSeqMessage',
  CONTROL = 'WebcastControlMessage',
  ROOM_RANK = 'WebcastRoomRankMessage',
  ROOM_STATS = 'WebcastRoomStatsMessage',
  EMOJI_CHAT = 'WebcastEmojiChatMessage',
  FANSCLUB = 'WebcastFansclubMessage',
  ROOM_DATA_SYNC = 'WebcastRoomDataSyncMessage',
  /** 自定义消息 */
  CUSTOM = 'CustomMessage'
}
/**
 * 社交信息活动类型
 */
export enum SocialAction {
  // 关注了主播
  Follow = 1,
  // 取消关注主播
  Unfollow = 2,
  // 分享本次直播
  Share = 3
}

/** 直播间控制信息类型 */
export enum ControlAction {
  PAUSE = 1,
  RESUME = 2,
  FINISH = 3,
  FINISH_BY_ADMIN = 4,
  CHANGE_NODE = 5,
  ROOM_FINISH_BY_SWITCH = 6,
  PING_TIMEOUT = 7
  // 3/4/6 直播结束
  // 2 直播恢复
  // 1 直播暂停
}

/**
 * 直播间直播状态
 */
export enum RoomStatus {
  PREPARE = 1,
  LIVING = 2,
  PAUSE = 3,
  END = 4
}

/**
 * 自定义关闭码
 */
export enum DyCastCloseCode {
  /** 正常关闭 */
  NORMAL = 1000,
  /** 终端离开，可能因为服务端错误，也可能因为浏览器正从打开连接的页面跳转离开 */
  GOING_AWAY = 1001,
  /** 由于协议错误而中断连接 */
  PROTOCOL_ERROR = 1002,
  /** 接收到不允许的数据类型而断开连接 */
  UNSUPPORTED = 1003,
  /** 没有收到预期的状态码 */
  NO_STATUS = 1005,
  /** 没有处理关闭帧 */
  ABNORMAL = 1006,
  /** 应用自定义状态码 */
  /** 主播未开播 */
  LIVE_END = 4001,
  /** 连接过程错误 */
  CONNECTING_ERROR = 4002,
  /** 无法正常接收信息 */
  CANNOT_RECEIVE = 4003,
  /** 因重连关闭 */
  RECONNECTING = 4004
}
