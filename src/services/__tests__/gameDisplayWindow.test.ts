import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GAME_DISPLAY_WINDOW_LABEL,
  getGameDisplayUrl,
  getGameDisplayWindowOptions,
  isTauriRuntime,
} from '../gameDisplayWindow.ts';

test('builds a borderless portrait window contract for the game display', () => {
  const url = getGameDisplayUrl('https://douai.local', '/');
  const options = getGameDisplayWindowOptions(url);

  assert.equal(GAME_DISPLAY_WINDOW_LABEL, 'game-display-window');
  assert.equal(url, 'https://douai.local/?display=game');
  assert.equal(options.url, url);
  assert.equal(options.title, 'DouAi 游戏画面');
  assert.equal(options.width, 460);
  assert.equal(options.height, 820);
  assert.equal(options.resizable, true);
  assert.equal(options.decorations, false);
  assert.equal(options.center, true);
  assert.equal(options.focus, true);
  assert.equal(options.visible, true);
});

test('detects Tauri only when its internal runtime bridge is present', () => {
  assert.equal(isTauriRuntime({ __TAURI_INTERNALS__: {} }), true);
  assert.equal(isTauriRuntime({}), false);
});
