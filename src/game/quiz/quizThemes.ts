export type QuizThemeId = 'arena' | 'classroom' | 'neon' | 'arcade' | 'scroll';

export interface QuizTheme {
  id: QuizThemeId;
  name: string;
  subtitle: string;
  badge: string;
  layout:
    | 'asymmetric-split-arena'
    | 'triple-tier-notebook'
    | 'radial-radar-cyber'
    | 'arcade-classic-hall'
    | 'immersive-drawer-scroll';
}
export const quizThemeStorageKey = 'douai-quiz-broadcast-theme';
type ThemeStorage = Pick<Storage, 'getItem' | 'setItem'>;

export const quizThemes: QuizTheme[] = [
  {
    id: 'arena',
    name: '左右非对称竞技流',
    subtitle: '左侧大题卡与瞬发喷射弹窗 · 右侧常驻前三与平滑纵向滚动榜',
    badge: '竞技首选',
    layout: 'asymmetric-split-arena'
  },
  {
    id: 'classroom',
    name: '三段式手账闪词流',
    subtitle: '上方居中沉浸大题卡 · 中部判卷弹窗瀑布 · 底部横向滑动画廊卡片榜',
    badge: '清新画廊',
    layout: 'triple-tier-notebook'
  },
  {
    id: 'neon',
    name: '赛博中心辐射流',
    subtitle: '中央能量环与四向辐射选项槽 · 底部扇形全息仪表战力台',
    badge: '科幻全息',
    layout: 'radial-radar-cyber'
  },
  {
    id: 'arcade',
    name: '街机四色名人堂流',
    subtitle: '顶部通关星级 · 中央四色大按键(HIT暴击动效) · 底部像素高分名人堂',
    badge: '复古高分',
    layout: 'arcade-classic-hall'
  },
  {
    id: 'scroll',
    name: '全屏沉浸抽屉流',
    subtitle: '75%全屏大舞台圣旨题面 · 选项穿梭弹幕 · 底部悬浮折叠金榜抽屉',
    badge: '极致沉浸',
    layout: 'immersive-drawer-scroll'
  }
];

export function normalizeQuizTheme(value: unknown): QuizThemeId {
  return quizThemes.some(theme => theme.id === value) ? value as QuizThemeId : 'arena';
}

function browserStorage(): ThemeStorage | undefined {
  try { return typeof localStorage === 'undefined' ? undefined : localStorage; }
  catch { return undefined; }
}

export const quizBroadcastChannelName = 'douai-quiz-theme-channel';
export const quizThemeEventName = 'douai-quiz-theme-change';

let broadcastChannelInstance: BroadcastChannel | null = null;
function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (!broadcastChannelInstance) {
    try {
      broadcastChannelInstance = new BroadcastChannel(quizBroadcastChannelName);
    } catch {
      broadcastChannelInstance = null;
    }
  }
  return broadcastChannelInstance;
}

export function publishQuizTheme(value: unknown, storage = browserStorage()) {
  const normalized = normalizeQuizTheme(value);
  try { 
    storage?.setItem(quizThemeStorageKey, normalized); 
  } catch { 
    /* Theme remains active in this window when storage is unavailable. */ 
  }

  // 1. 同窗口组件即时响应 (CustomEvent)
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    try {
      window.dispatchEvent(new CustomEvent(quizThemeEventName, { detail: normalized }));
    } catch { /* ignore */ }
  }

  // 2. 跨窗口/OBS浏览器源/弹窗即时同步 (BroadcastChannel)
  const channel = getBroadcastChannel();
  if (channel) {
    try {
      channel.postMessage({ type: 'THEME_CHANGE', theme: normalized });
    } catch { /* ignore */ }
  }
}

export function readQuizTheme(storage = browserStorage()): QuizThemeId | undefined {
  try {
    const value = storage?.getItem(quizThemeStorageKey);
    return value ? normalizeQuizTheme(value) : undefined;
  } catch {
    return undefined;
  }
}

export function subscribeQuizTheme(onChange: (theme: QuizThemeId) => void) {
  if (typeof window === 'undefined') return () => {};

  // 1. 本地 Storage 跨标签页监听兜底
  const storageListener = (event: StorageEvent) => {
    if (event.key === quizThemeStorageKey && event.newValue) {
      onChange(normalizeQuizTheme(event.newValue));
    }
  };
  window.addEventListener('storage', storageListener);

  // 2. 当前窗口即时事件监听 (无需等待 storage 且同窗口触发)
  const customListener = (event: Event) => {
    const custom = event as CustomEvent<QuizThemeId>;
    if (custom.detail) {
      onChange(normalizeQuizTheme(custom.detail));
    }
  };
  window.addEventListener(quizThemeEventName, customListener);

  // 3. BroadcastChannel 跨窗口实时广播
  let bc: BroadcastChannel | null = null;
  const bcListener = (event: MessageEvent) => {
    if (event.data && event.data.type === 'THEME_CHANGE' && event.data.theme) {
      onChange(normalizeQuizTheme(event.data.theme));
    }
  };

  if (typeof BroadcastChannel !== 'undefined') {
    try {
      bc = new BroadcastChannel(quizBroadcastChannelName);
      bc.addEventListener('message', bcListener);
    } catch {
      bc = null;
    }
  }

  return () => {
    window.removeEventListener('storage', storageListener);
    window.removeEventListener(quizThemeEventName, customListener);
    if (bc) {
      try {
        bc.removeEventListener('message', bcListener);
        bc.close();
      } catch { /* ignore */ }
    }
  };
}

