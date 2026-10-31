import { computed, type Component } from 'vue';
import type { ProjectConfig } from '@/services/configApi';
import type { GameEventContext, GameEventResult, GameInteractionDefaults, RoutedLiveEvent } from './interactionTypes';
import {
  handleQuizMessages,
  quizRuntimeSettings,
  quizState,
  setQuizPreviewConfig,
  startQuiz,
  stopQuiz
} from './quiz/quizStore';
import {
  handleVersusMessages,
  startVersus,
  stopVersus,
  versusState
} from './versus/versusStore';
import QuizBroadcastCanvas from '@/views/QuizBroadcastCanvas.vue';
import VersusBroadcastCanvas from '@/views/VersusBroadcastCanvas.vue';

export type GameModuleId = 'quiz' | 'versus';

export interface GameModuleDefinition {
  id: GameModuleId;
  name: string;
  badge: string;
  description?: string;
  component: Component;
  isRunning: () => boolean;
  getStatusText: () => string;
  applySavedConfig: (projectConfig: ProjectConfig) => void;
  start: (projectConfig?: ProjectConfig) => void;
  stop: () => void;
  instanceId?: string;
  interactionDefaults?: GameInteractionDefaults;
  handleEvent: (event: RoutedLiveEvent, context: GameEventContext) => GameEventResult;
}

let quizInstanceSequence = 0;
let versusInstanceSequence = 0;

const quizGameModule: GameModuleDefinition = {
  id: 'quiz',
  name: '知识问答',
  badge: '弹幕抢答',
  description: '全员弹幕抢答 A/B/C/D，点赞排除错项与礼物免死',
  component: QuizBroadcastCanvas,
  isRunning: () => quizState.running,
  getStatusText: () => quizState.question?.title || quizState.status,
  applySavedConfig: (projectConfig: ProjectConfig) => {
    if (projectConfig.quizConfig) {
      setQuizPreviewConfig(projectConfig.quizConfig);
    }
  },
  start: (projectConfig?: ProjectConfig) => {
    quizGameModule.instanceId = `quiz-${++quizInstanceSequence}`;
    if (projectConfig?.quizConfig) {
      startQuiz(projectConfig.quizConfig);
    } else {
      startQuiz(quizRuntimeSettings);
    }
  },
  stop: () => {
    stopQuiz();
  },
  instanceId: 'quiz-0',
  interactionDefaults: { version: 1, chat: 'ignore' },
  handleEvent: (event, context) => {
    if (!quizState.running) return { claimed: false, speechIntents: [], aiIntents: [] };
    const claimed = handleQuizMessages([event.message]);
    return { claimed, speechIntents: [], aiIntents: [] };
  }
};

const versusGameModule: GameModuleDefinition = {
  id: 'versus',
  name: '阵营对抗',
  badge: '阵营PK',
  description: '红蓝阵营答题拉扯拔河/血条，点赞破译错项与礼物暴击',
  component: VersusBroadcastCanvas,
  isRunning: () => versusState.running,
  getStatusText: () => versusState.status,
  applySavedConfig: () => {},
  start: () => {
    versusGameModule.instanceId = `versus-${++versusInstanceSequence}`;
    startVersus();
  },
  stop: () => {
    stopVersus();
  },
  instanceId: 'versus-0',
  interactionDefaults: { version: 1, chat: 'ignore' },
  handleEvent: (event, context) => {
    if (!versusState.running) return { claimed: false, speechIntents: [], aiIntents: [] };
    const claimed = handleVersusMessages([event.message]);
    return { claimed, speechIntents: [], aiIntents: [] };
  }
};

export const registeredGames: GameModuleDefinition[] = [quizGameModule, versusGameModule];

export function getGameModule(id: unknown): GameModuleDefinition | undefined {
  return registeredGames.find(game => game.id === id);
}

/**
 * 当前正在运行中的唯一活动游戏模块（没有任何游戏启动时为 null，实现控制台与具体游戏完全隔离）
 */
export const activeGameModule = computed<GameModuleDefinition | null>(() => {
  return registeredGames.find(game => game.isRunning()) || null;
});

/**
 * 停止当前所有正在运行的游戏模块
 */
export function stopAllRunningGames() {
  for (const game of registeredGames) {
    if (game.isRunning()) {
      game.stop();
    }
  }
}
