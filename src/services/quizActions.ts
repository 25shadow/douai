import type { ProjectConfig } from './configApi';
import type { QuizConfig } from '../game/quiz/quizStore';

interface QuizActionDependencies {
  loadConfig: () => Promise<ProjectConfig>;
  saveConfig: (config: ProjectConfig) => Promise<void>;
  startQuiz: (config: Partial<QuizConfig>) => void;
  stopQuiz: () => void;
}

export function createQuizActions(dependencies: QuizActionDependencies) {
  return {
    async save(config: QuizConfig) {
      const saved = await dependencies.loadConfig();
      await dependencies.saveConfig({
        ...saved,
        quizConfig: { ...saved.quizConfig, ...config }
      });
    },
    start(config: QuizConfig) {
      dependencies.startQuiz(config);
    },
    close() {
      dependencies.stopQuiz();
    }
  };
}
