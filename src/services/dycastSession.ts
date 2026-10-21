import type { getMeInfo } from '../core/request';

type SessionInfo = Awaited<ReturnType<typeof getMeInfo>>;
type SessionCookie = { name: string; value: string; path: string; maxAge: number; secure: boolean };

interface SessionDependencies {
  hasCookie: (name: string) => boolean;
  setCookie: (cookie: SessionCookie) => unknown;
  removeCookie: (name: string) => unknown;
  getMeInfo: () => Promise<SessionInfo>;
}

export function createDycastSessionManager(dependencies: SessionDependencies) {
  function clear() {
    dependencies.removeCookie('sessionid');
    dependencies.removeCookie('__lg');
  }

  async function verify() {
    if (!dependencies.hasCookie('__lg')) return { ok: false, message: '尚未设置登录凭证' };
    try {
      const result = await dependencies.getMeInfo();
      if (result.code === 0 && result.data) {
        return { ok: true, message: '登录凭证有效', nickname: result.data.nickname };
      }
      clear();
      return { ok: false, message: result.msg || '凭证无效，请检查 sessionid' };
    } catch {
      return { ok: false, message: '验证请求失败，请检查网络后重试' };
    }
  }

  async function save(sessionId: string) {
    const value = sessionId.trim();
    if (!value) return { ok: false, message: '请填写 sessionid' };
    dependencies.setCookie({
      name: 'sessionid',
      value,
      path: '/',
      maxAge: 604800,
      secure: true
    });
    dependencies.setCookie({
      name: '__lg',
      value: 'true',
      path: '/',
      maxAge: 604800,
      secure: true
    });
    return verify();
  }

  return { save, verify, clear, hasSession: () => dependencies.hasCookie('__lg') };
}
