import test from 'node:test';
import assert from 'node:assert/strict';
import { createQuizActions } from '../../../services/quizActions.ts';

const quizConfig = {
  bank: '基础知识题库',
  count: 3,
  answerTime: 30,
  revealTime: 5,
  interval: 3,
  countdown: 5,
  voice: true,
  autoNext: true,
  likes: false
};

function createHarness() {
  const calls: string[] = [];
  const actions = createQuizActions({
    loadConfig: async () => ({
      roomId: 'room-1',
      relayUrl: 'ws://localhost:8765',
      autoStart: false,
      pauseOnDisconnect: true,
      voiceEnabled: true,
      voiceVolume: 0.85,
      voiceRate: 1,
      quizConfig: { bank: '热门常识题库', count: 2, answerTime: 20, interval: 4, countdown: 2, voice: false, autoNext: false, likes: true }
    }),
    saveConfig: async config => {
      calls.push('save');
      assert.equal(config.roomId, 'room-1');
      assert.equal(config.quizConfig.bank, '基础知识题库');
    },
    startQuiz: config => {
      calls.push('start');
      assert.equal(config.bank, '基础知识题库');
    },
    stopQuiz: () => calls.push('stop')
  });
  return { actions, calls };
}

test('saving quiz settings does not start or close the game', async () => {
  const { actions, calls } = createHarness();

  await actions.save(quizConfig);

  assert.deepEqual(calls, ['save']);
});

test('starting the game uses the current settings without saving them', () => {
  const { actions, calls } = createHarness();

  actions.start(quizConfig);

  assert.deepEqual(calls, ['start']);
});

test('closing the game does not save or restart it', () => {
  const { actions, calls } = createHarness();

  actions.close();

  assert.deepEqual(calls, ['stop']);
});
