import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCustomQuestions, selectQuizQuestions } from '../questionBanks.ts';

test('loads a valid custom question bank from JSON text', () => {
  const questions = parseCustomQuestions(JSON.stringify([
    { title: '测试题', options: { A: '选项一', B: '选项二', C: '选项三', D: '选项四' }, answer: 'C' }
  ]));
  assert.equal(questions.length, 1);
  assert.equal(questions[0].answer, 'C');
});

test('loads question-bank files using the article format', () => {
  const questions = parseCustomQuestions(JSON.stringify({
    category: '历史',
    results: [{
      type: 'multiple',
      question: '题目内容？',
      correct_answer: '正确答案',
      incorrect_answers: ['错误答案一', '错误答案二', '错误答案三']
    }]
  }));
  assert.equal(questions[0].title, '题目内容？');
  assert.equal(questions[0].options[questions[0].answer], '正确答案');
});

test('rejects incomplete custom question data', () => {
  assert.throws(() => parseCustomQuestions('[{"title":"不完整"}]'), /题格式无效/);
});

test('selects no more questions than the selected bank contains', () => {
  const questions = selectQuizQuestions('基础知识题库', 99, [], () => 0);
  assert.equal(questions.length, 8);
  assert.notEqual(questions[0], questions[1]);
});

test('uses imported questions only for the custom bank', () => {
  const custom = [{
    title: '自定义题',
    options: { A: '甲', B: '乙', C: '丙', D: '丁' },
    answer: 'A' as const
  }];
  assert.equal(selectQuizQuestions('自定义题库', 3, custom).length, 1);
});

test('selects from a named saved bank', () => {
  const customBanks = {
    天文: [{
      title: '离地球最近的恒星是？',
      options: { A: '太阳', B: '天狼星', C: '织女星', D: '北极星' },
      answer: 'A' as const
    }]
  };
  const selected = selectQuizQuestions('天文', 5, [], () => 0, customBanks);
  assert.equal(selected.length, 1);
  assert.equal(selected[0].title, '离地球最近的恒星是？');
});

test('shuffles answer positions so correct answers are not fixed to one letter', () => {
  const [question] = selectQuizQuestions('自定义题库', 1, [{
    title: '自定义题',
    options: { A: '正确', B: '错误一', C: '错误二', D: '错误三' },
    answer: 'A'
  }], () => 0);
  assert.notEqual(question.answer, 'A');
  assert.equal(question.options[question.answer], '正确');
});
