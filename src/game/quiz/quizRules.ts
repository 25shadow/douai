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
  { threshold: 300, effect: 'eliminate', amount: 1 },
  { threshold: 600, effect: 'eliminate', amount: 1 },
  { threshold: 1000, effect: 'extend-time', amount: 15 }
];
export const defaultGiftRules: GiftRule[] = [
  { minimumCoins: 1, effect: 'answer' },
  { minimumCoins: 30, effect: 'win' }
];

export function parseQuizAnswer(
  content?: string,
  options?: Record<QuizOption, string>
): QuizOption | null {
  const raw = content?.trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();

  // 1. 直接匹配 A/B/C/D（支持 "A"、"选A"、"我选B"、"答案C"、"D选项"、"AAA"、"A." 等常见弹幕格式）
  const directMatch = upper.match(
    /^(?:我)?(?:选择|选|答案是|答案|选的是|来个|蒙个)?\s*([ABCD])\1{0,5}\s*(?:选项|吧|呀|啊|哦|啦)?[。.!！~～?？]*$/
  );
  if (directMatch?.[1]) {
    return directMatch[1] as QuizOption;
  }

  // 2. 支持数字 1/2/3/4 映射为 A/B/C/D（仅当未与选项文本冲突时）
  if (options) {
    for (const key of ['A', 'B', 'C', 'D'] as QuizOption[]) {
      const optText = options[key]?.trim();
      if (optText && (raw === optText || (optText.length >= 2 && raw.includes(optText)))) {
        return key;
      }
    }
  }

  const numMatch = upper.match(/^(?:我)?(?:选择|选)?\s*([1234])\s*[。.!！]?$/);
  if (numMatch?.[1]) {
    const map: Record<string, QuizOption> = { '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
    return map[numMatch[1]] ?? null;
  }

  return null;
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
