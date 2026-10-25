import { computed, type Component } from 'vue';
import type { DyMessage } from '@/core/type';
import type { ProjectConfig } from '@/services/configApi';
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
  component: Component;
  isRunning: () => boolean;
  getStatusText: () => string;
  applySavedConfig: (projectConfig: ProjectConfig) => void;
  start: (projectConfig?: ProjectConfig) => void;
  stop: () => void;
  handleMessages: (messages: DyMessage[]) => void;
}

const quizGameModule: GameModuleDefinition = {
  id: 'quiz',
  name: '知识问答',
  badge: '弹幕抢答',
  component: QuizBroadcastCanvas,
  isRunning: () => quizState.running,
  getStatusText: () => quizState.question?.title || quizState.status,
  applySavedConfig: (projectConfig: ProjectConfig) => {
    if (projectConfig.quizConfig) {
      setQuizPreviewConfig(projectConfig.quizConfig);
    }
  },
  start: (projectConfig?: ProjectConfig) => {
    if (projectConfig?.quizConfig) {
      startQuiz(projectConfig.quizConfig);
    } else {
      startQuiz(quizRuntimeSettings);
    }
  },
  stop: () => {
    stopQuiz();
  },
  handleMessages: (messages: DyMessage[]) => {
    if (quizState.running) {
      handleQuizMessages(messages);
    }
  }
};

const versusGameModule: GameModuleDefinition = {
  id: 'versus',
  name: '红蓝阵营对抗',
  badge: '扣1扣2PK',
  component: VersusBroadcastCanvas,
  isRunning: () => versusState.running,
  getStatusText: () => versusState.status,
  applySavedConfig: () => {},
  start: () => {
    startVersus();
  },
  stop: () => {
    stopVersus();
  },
  handleMessages: (messages: DyMessage[]) => {
    if (versusState.running) {
      handleVersusMessages(messages);
    }
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
 * 将直播间收到的弹幕、点赞、礼物消息仅转发给当前正在运行的游戏模块
 */
export function dispatchMessagesToActiveGame(messages: DyMessage[]) {
  const active = activeGameModule.value;
  if (!active) return;
  active.handleMessages(messages);
}

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
