export type QuizThemeId = 'arena' | 'classroom' | 'neon' | 'arcade' | 'scroll';

export interface QuizTheme {
  id: QuizThemeId;
  name: string;
  subtitle: string;
  badge: string;
  layout:
    | 'forest-podium-matrix'
    | 'notebook-judge-grid'
    | 'cyber-holo-stage'
    | 'arcade-boss-arena'
    | 'imperial-scroll-palace';
}
export const quizThemeStorageKey = 'douai-quiz-broadcast-theme';
type ThemeStorage = Pick<Storage, 'getItem' | 'setItem'>;

export const quizThemes: QuizTheme[] = [
  {
    id: 'arena',
    name: '森系荣耀擂台',
    subtitle: '象牙白题卡 · 5人抢答连击 · 皇冠领奖台 · 33人同屏天梯',
    badge: '爆款推荐',
    layout: 'forest-podium-matrix'
  },
  {
    id: 'classroom',
    name: '手账方格闪词',
    subtitle: '方格手账纸 · 荧光马克笔 · 实时判卷钩叉 · TOP30紧凑白卡榜',
    badge: '清爽高赞',
    layout: 'notebook-judge-grid'
  },
  {
    id: 'neon',
    name: '赛博电音派对',
    subtitle: '全息霓虹舱 · 2×2音轨能量条 · 全息三强 · 33人霓虹矩阵榜',
    badge: '高燃酷炫',
    layout: 'cyber-holo-stage'
  },
  {
    id: 'arcade',
    name: '街机像素乱斗',
    subtitle: '街机四色按键 · HIT连击条 · 三强名人堂 · 33人像素高分榜',
    badge: '强互动感',
    layout: 'arcade-boss-arena'
  },
  {
    id: 'scroll',
    name: '国潮金榜状元',
    subtitle: '宣纸圣旨卷轴 · 朱砂钦定印章 · 三甲牌匾 · 33人进士金榜',
    badge: '国风科举',
    layout: 'imperial-scroll-palace'
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

