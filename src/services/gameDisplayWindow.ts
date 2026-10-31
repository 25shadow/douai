export const GAME_DISPLAY_WINDOW_LABEL = 'game-display-window';

export type GameDisplayWindowOptions = {
  url: string;
  title: string;
  width: number;
  height: number;
  resizable: boolean;
  decorations: boolean;
  center: boolean;
  focus: boolean;
  visible: boolean;
};

export function getGameDisplayUrl(origin: string, pathname: string): string {
  return `${origin}${pathname}?display=game`;
}

export function getGameDisplayWindowOptions(url: string): GameDisplayWindowOptions {
  return {
    url,
    title: 'DouAi 游戏画面',
    width: 460,
    height: 820,
    resizable: true,
    decorations: false,
    center: true,
    focus: true,
    visible: true,
  };
}

export function isTauriRuntime(host: { __TAURI_INTERNALS__?: unknown } = globalThis as typeof globalThis & {
  __TAURI_INTERNALS__?: unknown;
}): boolean {
  return Boolean(host.__TAURI_INTERNALS__);
}
