import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getGiftEffect,
  getLikeEffects,
  getQuizRank,
  parseQuizAnswer,
  submitQuizAnswer,
  type QuizAnswerRecord
} from '../quizRules.ts';

test('parses supported A-D answer forms and ignores unrelated chat', () => {
  assert.equal(parseQuizAnswer(' b '), 'B');
  assert.equal(parseQuizAnswer('选 A'), 'A');
  assert.equal(parseQuizAnswer('我选C'), 'C');
  assert.equal(parseQuizAnswer('A.'), 'A');
  assert.equal(parseQuizAnswer('答案是B'), null);
  assert.equal(parseQuizAnswer('E'), null);
});

test('locks the first answer from a viewer for each question', () => {
  const answers: QuizAnswerRecord = {};
  assert.deepEqual(submitQuizAnswer(answers, 'viewer-1', 'A', 'A'), {
    accepted: true,
    correct: true
  });
  assert.deepEqual(submitQuizAnswer(answers, 'viewer-1', 'B', 'A'), {
    accepted: false,
    correct: false
  });
  assert.deepEqual(submitQuizAnswer(answers, 'viewer-2', 'B', 'A'), {
    accepted: true,
    correct: false
  });
});

test('assigns article rank thresholds by cumulative correct answers', () => {
  assert.equal(getQuizRank(0), '新手');
  assert.equal(getQuizRank(4), '新手');
  assert.equal(getQuizRank(5), '学徒');
  assert.equal(getQuizRank(15), '达人');
  assert.equal(getQuizRank(30), '专家');
  assert.equal(getQuizRank(50), '大师');
  assert.equal(getQuizRank(80), '宗师');
  assert.equal(getQuizRank(120), '知识王');
});

test('maps gift values to direct-answer and round-win effects', () => {
  assert.equal(getGiftEffect(0), null);
  assert.equal(getGiftEffect(10), 'answer');
  assert.equal(getGiftEffect(11), 'win');
  assert.equal(getGiftEffect(undefined), null);
  assert.equal(getGiftEffect(80, [
    { minimumCoins: 5, effect: 'answer' },
    { minimumCoins: 50, effect: 'none' }
  ]), 'none');
});

test('unlocks each like assist once per question at 500 and 1000 likes', () => {
  assert.deepEqual(getLikeEffects(499, false, false), []);
  assert.deepEqual(getLikeEffects(500, false, false), ['eliminate']);
  assert.deepEqual(getLikeEffects(1000, true, false), ['extend-time']);
  assert.deepEqual(getLikeEffects(1500, true, true), []);
  assert.deepEqual(getLikeEffects(250, false, false, [
    { threshold: 250, effect: 'extend-time', amount: 25 }
  ]), ['extend-time']);
});
