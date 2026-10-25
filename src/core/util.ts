import type { DyLiveInfo } from './type';

/**
 * 解析直播间信息
 * @param html
 * @returns
 */
export const parseLiveHtml_old = function (html: string): DyLiveInfo | null {
  try {
    const matchRes = html.match(
      /<script\snonce="\S+?"\s>self\.__pace_f\.push\(\[1,"[a-z]?:\[\\"\$\\",\\"\$L\d+\\",null,([\s\S]+?state[\s\S]+?)\]\\n"\]\)<\/script>/
    );
    const REGLIST = [
      {
        reg: /\\{1,7}"/g,
        str: '"'
      },
      {
        reg: /"\{/g,
        str: '{'
      },
      {
        reg: /\}"/g,
        str: '}'
      },
      {
        reg: /"\[(.*)]\"/g,
        str: '[$1]'
      },
      {
        reg: /([^:,{\[])(")([^:,}\]])/g,
        str: '$1"$3'
      }
    ];
    if (!matchRes) return null;
    let json: string = matchRes[1];
    for (const REG of REGLIST) {
      json = json.replace(REG.reg, REG.str);
    }
    const data = JSON.parse(json);
    const roomInfo = data?.['state']?.['roomStore']?.['roomInfo'] || {};
    const room = roomInfo['room'] || {};
    const stats = room['stats'] || {};
    const anchor = roomInfo['anchor'] || room['owner'] || {};
    const followInfo = anchor['follow_info'] || room['owner']?.['follow_info'] || {};
    return {
      roomId: roomInfo['roomId'],
      uniqueId: data['state']['userStore']['odin']['user_unique_id'],
      avatar: anchor?.['avatar_thumb']?.['url_list']?.[0],
      cover: room?.['cover']?.['url_list']?.[0],
      nickname: anchor['nickname'],
      title: room['title'],
      status: room['status'],
      audienceCount: room['user_count_str'] || stats['user_count_str'] || room['user_count'],
      likeCount: room['like_count'] || stats['like_count'] || stats['like_count_str'],
      followCount:
        followInfo['follower_count_str'] ||
        followInfo['follower_count'] ||
        stats['follow_count'] ||
        stats['follower_count'],
      totalUserCount: stats['total_user_str'] || stats['total_user'] || room['total_user_str']
    };
  } catch (err) {
    return null;
  }
};

/**
 * 解析直播间信息
 * @param html
 * @returns
 */
export const parseLiveHtml = function (html: string): DyLiveInfo | null {
  try {
    const matchRes = html.match(
      /<script\snonce="\S+?"\s>self\.__pace_f\.push\(\[1,"[a-z]?:\[\\"\$\\",\\"\$L\d+\\",null,([\s\S]+?state[\s\S]+?)\]\\n"\]\)<\/script>/
    );
    if (!matchRes) return null;
    let json: string = matchRes[1];
    const REGMAP: Record<string, RegExp> = {
      roomId: /{"state":{[\s\S]*?"roomStore":{[\s\S]*?"roomInfo":{[\s\S]*?"roomId":"([0-9]+?)"/,
      uniqueId: /{"state":{[\s\S]*?"userStore":{[\s\S]*?"odin":{[\s\S]*?"user_unique_id":"([0-9]+?)"/,
      avatar:
        /{"state":{[\s\S]*?"roomStore":{[\s\S]*?"roomInfo":{[\s\S]*?"anchor":{[\s\S]*?"avatar_thumb":{[\s\S]*?"url_list":\["([\S]+?)"/,
      cover:
        /{"state":{[\s\S]*?"roomStore":{[\s\S]*?"roomInfo":{[\s\S]*?"room":{[\s\S]*?"cover":{[\s\S]*?"url_list":\["([\S]+?)"/,
      nickname: /{"state":{[\s\S]*?"roomStore":{[\s\S]*?"roomInfo":{[\s\S]*?"anchor":{[\s\S]*?"nickname":"([\s\S]+?)"/,
      title: /{"state":{[\s\S]*?"roomStore":{[\s\S]*?"roomInfo":{[\s\S]*?"room":{[\s\S]*?"title":"([\s\S]+?)"/,
      status: /{"state":{[\s\S]*?"roomStore":{[\s\S]*?"roomInfo":{[\s\S]*?"room":{[\s\S]*?"status":([0-9]{1})/
    };
    function extractJsonField(name: string, json: string) {
      const reg = REGMAP[name];
      let res: string = '';
      if (reg) {
        const exec = reg.exec(json);
        if (exec) res = exec[1];
      }
      return res;
    }
    function extractFirstMatch(source: string, patterns: RegExp[]) {
      for (const pattern of patterns) {
        const match = pattern.exec(source);
        const value = match?.[1] || match?.[2];
        if (value && value !== '0') return value;
      }
      return '';
    }
    function decodeUnicodeUrl(url: string) {
      if (url) return url.replace(/\\u0026/g, '&');
      else return url;
    }
    json = json.replace(/\\{1,7}"/g, '"');
    const roomId = extractJsonField('roomId', json);
    const uniqueId = extractJsonField('uniqueId', json);
    const avatar = extractJsonField('avatar', json);
    const cover = extractJsonField('cover', json);
    const nickname = extractJsonField('nickname', json);
    const title = extractJsonField('title', json);
    const status = extractJsonField('status', json);
    const roomInfoIndex = json.indexOf('"roomInfo":{');
    const roomInfoSlice = roomInfoIndex >= 0 ? json.slice(roomInfoIndex) : json;
    const audienceCount = extractFirstMatch(roomInfoSlice, [
      /"user_count_str":"([^"]+)"/,
      /"user_count":(?:"([0-9]+)"|([0-9]+))/
    ]);
    const likeCount = extractFirstMatch(roomInfoSlice, [
      /"like_count_str":"([^"]+)"/,
      /"like_count":(?:"([0-9]+)"|([0-9]+))/
    ]);
    const followCount = extractFirstMatch(roomInfoSlice, [
      /"follower_count_str":"([^"]+)"/,
      /"follower_count":(?:"([0-9]+)"|([0-9]+))/,
      /"follow_count_str":"([^"]+)"/,
      /"follow_count":(?:"([0-9]+)"|([0-9]+))/
    ]);
    const totalUserCount = extractFirstMatch(roomInfoSlice, [
      /"total_user_str":"([^"]+)"/,
      /"total_user":(?:"([0-9]+)"|([0-9]+))/
    ]);
    return {
      roomId,
      uniqueId,
      avatar: decodeUnicodeUrl(avatar),
      cover: decodeUnicodeUrl(cover),
      nickname,
      title,
      status: parseInt(status || '4'),
      audienceCount: audienceCount || undefined,
      likeCount: likeCount || undefined,
      followCount: followCount || undefined,
      totalUserCount: totalUserCount || undefined
    };
  } catch (err) {
    return null;
  }
};

/**
 * 将对象化成请求参数字符串
 *  - 如：item1=value1&item2=value2&...
 * @param params 请求参数对象
 * @returns
 */
export const makeUrlParams = function (params: any): string {
  return Object.keys(params).reduce((t, n) => {
    let r;
    return `${t}${t ? '&' : ''}${n}=${null != (r = params[n]) ? r : ''}`;
  }, '');
};
