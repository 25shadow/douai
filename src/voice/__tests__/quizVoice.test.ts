import test from 'node:test';
import assert from 'node:assert/strict';

test('quiz routes scenes, clears stale feedback, respects its toggle and preserves system playback', async () => {
  const spoken: any[] = [];
  const intervals = new Map<number, () => void>();
  let nextId = 0;
  class Utterance { text: string; constructor(text: string) { this.text = text; } }
  (globalThis as any).window = {
    SpeechSynthesisUtterance: Utterance,
    speechSynthesis: {
      getVoices: () => [], addEventListener() {}, removeEventListener() {},
      speak: (utterance: any) => { spoken.push(utterance); utterance.onstart?.(); },
      cancel() {}, resume() {}, pause() {}
    },
    setInterval: (fn: () => void) => { intervals.set(++nextId, fn); return nextId; },
    clearInterval: (id: number) => intervals.delete(id)
  };
  const { voiceManager } = await import('../voiceManager.ts');
  const { createDefaultVoiceConfig } = await import('../voiceConfig.ts');
  const { startQuiz, stopQuiz, handleQuizMessages, quizState, nextQuestion } = await import('../../game/quiz/quizStore.ts');
  const c = createDefaultVoiceConfig();
  c.dedupeWindowMs = 0;
  for (const scene of Object.values(c.scenes)) scene.cooldownMs = 0;
  voiceManager.configure(c);
  try {
    startQuiz({ count: 3, countdown: 0, interval: 0, gameDurationMinutes: 0, likeRules: [{ threshold: 1, effect: 'extend-time', amount: 10 }] });
    assert.match(spoken.at(-1).text, /^知识问答开始/);
    spoken.at(-1).onend();
    assert.match(spoken.at(-1).text, /^第一题/);
    spoken.at(-1).onend();
    handleQuizMessages([{ id: 'answer', method: 'WebcastChatMessage', user: { id: 'a', name: '小星' }, content: quizState.question.answer }] as any);
    assert.match(spoken.at(-1).text, /^小星 答对了/);
    spoken.at(-1).onend();
    handleQuizMessages([{ id: 'gift', method: 'WebcastGiftMessage', user: { id: 'b', name: '小月' }, gift: { name: '心', price: 1, count: 1, repeatEnd: 0 } }] as any);
    assert.match(spoken.at(-1).text, /^小月 答对了/);
    spoken.at(-1).onend();
    handleQuizMessages([{ id: 'like', method: 'WebcastLikeMessage', content: '为主播点赞了(1)' }] as any);
    assert.match(spoken.at(-1).text, /答题时间延长/);
    nextQuestion();
    assert.match(spoken.at(-1).text, /^第/);
    voiceManager.speak('keep system', { owner: 'system', scene: 'system' });
    stopQuiz();
    assert.equal(voiceManager.getState().currentText, 'keep system');
    assert.equal(voiceManager.getState().queueSize, 1);
    voiceManager.stop();
    startQuiz({ voice: false, countdown: 0, gameDurationMinutes: 0 });
    assert.equal(voiceManager.getState().currentText, '');
    stopQuiz();
    for (const mode of ['drop', 'interrupt'] as const) {
      voiceManager.stop();
      c.queueMode = mode;
      voiceManager.configure(c);
      startQuiz({ voice: true, countdown: 0, gameDurationMinutes: 0 });
      assert.equal(voiceManager.getState().currentText, '知识问答开始');
      spoken.at(-1).onend();
      assert.match(voiceManager.getState().currentText, /^第一题/);
      stopQuiz();
    }
    voiceManager.stop(); c.queueMode = 'queue';
    c.scenes.gift.enabled = false;
    voiceManager.configure(c);
    startQuiz({ voice: true, countdown: 0, gameDurationMinutes: 0 });
    spoken.at(-1).onend();
    assert.match(voiceManager.getState().currentText, /^第一题/);
    stopQuiz();
    c.scenes.gift.enabled = true;
    voiceManager.configure(c);
    startQuiz({ voice: true, countdown: 5, gameDurationMinutes: 0 });
    assert.equal(voiceManager.getState().currentText, '知识问答即将开始');
    quizState.timeLeft = 1;
    [...intervals.values()].forEach(fn => fn());
    assert.match(voiceManager.getState().currentText, /^第 1 题/);
    handleQuizMessages([{ id: 'stale', method: 'WebcastChatMessage', user: { id: 'c', name: '反馈' }, content: quizState.question.answer }] as any);
    assert.equal(voiceManager.getState().queueSize, 1);
    quizState.timeLeft = 1;
    [...intervals.values()].forEach(fn => fn());
    assert.match(voiceManager.getState().currentText, /^本题正确答案是/);
    assert.equal(voiceManager.getState().queueSize, 0);
    stopQuiz();
  } finally {
    voiceManager.stop();
    delete (globalThis as any).window;
  }
});
