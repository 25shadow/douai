import type { QuizQuestion } from './quizStore';
import type { QuizOption } from './quizRules';

export const quizQuestionBanks: Record<string, QuizQuestion[]> = {
  '基础知识题库': [
    { title: '太阳系中最大的行星是哪一颗？', options: { A: '地球', B: '木星', C: '火星', D: '金星' }, answer: 'B' },
    { title: '中国的首都是哪里？', options: { A: '上海', B: '广州', C: '北京', D: '深圳' }, answer: 'C' },
    { title: '水的化学式是什么？', options: { A: 'CO2', B: 'O2', C: 'H2O', D: 'NaCl' }, answer: 'C' },
    { title: '一年有多少个月？', options: { A: '10个月', B: '11个月', C: '12个月', D: '13个月' }, answer: 'C' },
    { title: '光合作用主要发生在植物的哪个部位？', options: { A: '根部', B: '叶片', C: '种子', D: '花瓣' }, answer: 'B' },
    { title: '地球的天然卫星是哪一个？', options: { A: '火星', B: '月球', C: '太阳', D: '金星' }, answer: 'B' },
    { title: '下列哪种动物是哺乳动物？', options: { A: '鲨鱼', B: '青蛙', C: '海豚', D: '乌龟' }, answer: 'C' },
    { title: '一个小时有多少分钟？', options: { A: '30', B: '45', C: '60', D: '100' }, answer: 'C' }
  ],
  '热门常识题库': [
    { title: '彩虹通常有几种颜色？', options: { A: '5种', B: '6种', C: '7种', D: '8种' }, answer: 'C' },
    { title: '下列哪一个是中国传统节日？', options: { A: '感恩节', B: '端午节', C: '万圣节', D: '复活节' }, answer: 'B' },
    { title: '熊猫主要以什么为食？', options: { A: '竹子', B: '鱼', C: '水果', D: '昆虫' }, answer: 'A' },
    { title: '世界上面积最大的海洋是哪个？', options: { A: '大西洋', B: '印度洋', C: '北冰洋', D: '太平洋' }, answer: 'D' },
    { title: '一天有多少小时？', options: { A: '12', B: '18', C: '24', D: '36' }, answer: 'C' },
    { title: '下列哪种材料通常可以被磁铁吸引？', options: { A: '木头', B: '塑料', C: '铁', D: '玻璃' }, answer: 'C' },
    { title: '地球上最大的陆地动物是什么？', options: { A: '长颈鹿', B: '非洲象', C: '河马', D: '犀牛' }, answer: 'B' },
    { title: '哪一种乐器通常有黑白琴键？', options: { A: '小提琴', B: '钢琴', C: '长笛', D: '鼓' }, answer: 'B' }
  ]
};

export function parseCustomQuestions(json: string): QuizQuestion[] {
  const parsed: unknown = JSON.parse(json);
  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { questions?: unknown }).questions)
      ? (parsed as { questions: unknown[] }).questions
      : parsed && typeof parsed === 'object' && Array.isArray((parsed as { results?: unknown }).results)
        ? (parsed as { results: unknown[] }).results
      : null;

  if (!list?.length) throw new Error('题库必须包含至少一道题目');

  return list.map((entry, index) => {
    if (!entry || typeof entry !== 'object') throw new Error(`第 ${index + 1} 题格式无效`);
    const raw = entry as Partial<QuizQuestion> & {
      question?: string;
      correct_answer?: string;
      incorrect_answers?: string[];
    };
    if (raw.question && raw.correct_answer && Array.isArray(raw.incorrect_answers) && raw.incorrect_answers.length >= 3) {
      return {
        title: raw.question.trim(),
        options: {
          A: raw.correct_answer.trim(),
          B: raw.incorrect_answers[0].trim(),
          C: raw.incorrect_answers[1].trim(),
          D: raw.incorrect_answers[2].trim()
        },
        answer: 'A'
      };
    }
    const item = raw;
    const options = item.options;
    const validOptions = options && ['A', 'B', 'C', 'D'].every(key =>
      typeof options[key as keyof typeof options] === 'string' && options[key as keyof typeof options].trim()
    );
    if (!item.title?.trim() || !validOptions || !['A', 'B', 'C', 'D'].includes(item.answer || '')) {
      throw new Error(`第 ${index + 1} 题格式无效：需提供题干、A-D选项和正确答案`);
    }
    return {
      title: item.title.trim(),
      options: {
        A: options!.A.trim(),
        B: options!.B.trim(),
        C: options!.C.trim(),
        D: options!.D.trim()
      },
      answer: item.answer!
    };
  });
}

export function selectQuizQuestions(
  bank: string,
  count: number,
  customQuestions: QuizQuestion[] = [],
  random: () => number = Math.random,
  customBanks: Record<string, QuizQuestion[]> = {}
) {
  const source = customBanks[bank] || (bank === '自定义题库'
    ? customQuestions
    : quizQuestionBanks[bank] || quizQuestionBanks['基础知识题库']);
  const questions = source.map(question => {
    const correctText = question.options[question.answer];
    const values = (Object.entries(question.options) as Array<[QuizOption, string]>)
      .map(([key, value]) => ({ value, correct: key === question.answer }));
    for (let index = values.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
    }
    const options = Object.fromEntries(values.map((item, index) => [['A', 'B', 'C', 'D'][index], item.value])) as QuizQuestion['options'];
    const answerIndex = values.findIndex(item => item.correct && item.value === correctText);
    return {
      ...question,
      options,
      answer: (['A', 'B', 'C', 'D'][answerIndex] || question.answer) as QuizQuestion['answer']
    };
  });

  for (let index = questions.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [questions[index], questions[swapIndex]] = [questions[swapIndex], questions[index]];
  }

  return questions.slice(0, Math.max(1, Math.min(Math.floor(count) || 1, questions.length)));
}
