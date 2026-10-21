export type QuizThemeId = 'arena' | 'neon' | 'classroom';

export interface QuizTheme {
  id: QuizThemeId;
  name: string;
  subtitle: string;
  layout: 'split-scoreboard' | 'center-stage' | 'editorial-columns';
}
export const quizThemeStorageKey = 'douai-quiz-broadcast-theme';
type ThemeStorage = Pick<Storage, 'getItem' | 'setItem'>;

export const quizThemes: QuizTheme[] = [
  { id: 'arena', name: '竞赛现场', subtitle: '题目与实时榜单并列', layout: 'split-scoreboard' },
  { id: 'neon', name: '霓虹派对', subtitle: '聚焦大题面与互动能量', layout: 'center-stage' },
  { id: 'classroom', name: '知识讲堂', subtitle: '清晰题目与分栏答题统计', layout: 'editorial-columns' }
];

export function normalizeQuizTheme(value: unknown): QuizThemeId {
  return quizThemes.some(theme => theme.id === value) ? value as QuizThemeId : 'arena';
}

function browserStorage(): ThemeStorage | undefined {
  try { return typeof localStorage === 'undefined' ? undefined : localStorage; }
  catch { return undefined; }
}

export function publishQuizTheme(value: unknown, storage = browserStorage()) {
  try { storage?.setItem(quizThemeStorageKey, normalizeQuizTheme(value)); }
  catch { /* Theme remains active in this window when storage is unavailable. */ }
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
  const listener = (event: StorageEvent) => {
    if (event.key === quizThemeStorageKey && event.newValue) onChange(normalizeQuizTheme(event.newValue));
  };
  window.addEventListener('storage', listener);
  return () => window.removeEventListener('storage', listener);
}
