import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeQuizTheme, publishQuizTheme, quizThemes, readQuizTheme } from '../quizThemes.ts';

test('quiz themes expose distinct OBS compositions and normalize saved selections', () => {
  assert.deepEqual(quizThemes.map(theme => theme.id), ['arena', 'classroom', 'neon', 'arcade', 'scroll']);
  assert.equal(new Set(quizThemes.map(theme => theme.layout)).size, 5);
  assert.equal(normalizeQuizTheme('neon'), 'neon');
  assert.equal(normalizeQuizTheme('arcade'), 'arcade');
  assert.equal(normalizeQuizTheme('scroll'), 'scroll');
  assert.equal(normalizeQuizTheme('unknown'), 'arena');
});

test('theme selection can be shared with a separate OBS browser source', () => {
  const values = new Map<string, string>();
  const storage = {
    setItem: (key: string, value: string) => values.set(key, value),
    getItem: (key: string) => values.get(key) ?? null
  };
  publishQuizTheme('classroom', storage);
  assert.equal(readQuizTheme(storage), 'classroom');
});
