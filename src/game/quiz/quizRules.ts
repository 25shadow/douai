export type QuizOption = 'A' | 'B' | 'C' | 'D';
export type QuizAnswerRecord = Record<string, QuizOption>;
export type LikeRule = {
  threshold: number;
  effect: 'eliminate' | 'extend-time' | 'none';
  amount: number;
};
export type GiftRule = {
  minimumCoins: number;
  effect: 'answer' | 'win' | 'none';
};

export const defaultLikeRules: LikeRule[] = [
  { threshold: 500, effect: 'eliminate', amount: 1 },
  { threshold: 1000, effect: 'extend-time', amount: 10 }
];
export const defaultGiftRules: GiftRule[] = [
  { minimumCoins: 1, effect: 'answer' },
  { minimumCoins: 11, effect: 'win' }
];

export function parseQuizAnswer(content?: string): QuizOption | null {
  const match = content?.trim().toUpperCase().match(/^(?:我)?(?:选择|选)?\s*([ABCD])\s*[。.!！]?$/);
  return (match?.[1] as QuizOption | undefined) ?? null;
}

export function submitQuizAnswer(
  answers: QuizAnswerRecord,
  userId: string,
  answer: QuizOption,
  correctAnswer: QuizOption
) {
  if (answers[userId]) return { accepted: false, correct: false };
  answers[userId] = answer;
  return { accepted: true, correct: answer === correctAnswer };
}

export function getQuizRank(correctCount: number) {
  if (correctCount >= 120) return '知识王';
  if (correctCount >= 80) return '宗师';
  if (correctCount >= 50) return '大师';
  if (correctCount >= 30) return '专家';
  if (correctCount >= 15) return '达人';
  if (correctCount >= 5) return '学徒';
  return '新手';
}

export function getGiftEffect(price?: number, rules: GiftRule[] = defaultGiftRules) {
  if (!Number.isFinite(price) || !price || price <= 0) return null;
  return [...rules]
    .sort((a, b) => b.minimumCoins - a.minimumCoins)
    .find(rule => price >= rule.minimumCoins)?.effect ?? null;
}

export function getLikeEffects(
  likes: number,
  hasEliminatedOption: boolean,
  hasExtendedTime: boolean,
  rules: LikeRule[] = defaultLikeRules
): Array<'eliminate' | 'extend-time'> {
  const effects: Array<'eliminate' | 'extend-time'> = [];
  for (const rule of [...rules].sort((a, b) => a.threshold - b.threshold)) {
    if (likes < rule.threshold) continue;
    if (rule.effect === 'none') continue;
    if (rule.effect === 'eliminate' && hasEliminatedOption) continue;
    if (rule.effect === 'extend-time' && hasExtendedTime) continue;
    if (!effects.includes(rule.effect)) effects.push(rule.effect);
  }
  return effects;
}

export function parseLikeCount(content?: string) {
  const count = content?.match(/\((\d+)\)/)?.[1];
  return count ? Number(count) : 1;
}
