import { computed, reactive, watch } from 'vue';
import type { DyMessage } from '../../core/type.ts';
import { CastMethod } from '../../core/type.ts';
import { speak, clearVoiceOwner } from '../../voice/voiceManager.ts';
import { soundEffects } from '../../utils/soundEffects.ts';

export type VersusThemeId = 'tug' | 'mecha' | 'arcade' | 'colosseum';

export interface VersusThemeMeta {
  id: VersusThemeId;
  name: string;
  badge: string;
  desc: string;
}

export const versusThemes: VersusThemeMeta[] = [
  { id: 'tug', name: '能量拔河巨力流', badge: '经典拔河', desc: '中央巨型等离子拉扯条，红蓝双方角力碰撞，双列荣誉贡献榜' },
  { id: 'mecha', name: '赛博要塞机甲流', badge: '机甲双塔', desc: '双塔要塞基地血条轰击，扣1发射红光火炮，扣2发射离子激光' },
  { id: 'arcade', name: '像素街机格斗流', badge: '拳皇血条', desc: '街机复古格斗血条与KO终结，像素HIT打击感与名人堂' },
  { id: 'colosseum', name: '巅峰角斗擂台流', badge: '聚光拳击', desc: '红角蓝角重拳出击，观众欢呼化身火花连击，拳王金腰带' }
];

export interface VersusConfig {
  theme: VersusThemeId;
  targetScore: number;
  redTeamName: string;
  blueTeamName: string;
  redCommand: string;
  blueCommand: string;
  giftMultiplier: number;
  voice: boolean;
  autoRematch: boolean;
}

export const defaultVersusConfig: VersusConfig = {
  theme: 'tug',
  targetScore: 200,
  redTeamName: '烈焰红队',
  blueTeamName: '极光蓝队',
  redCommand: '1',
  blueCommand: '2',
  giftMultiplier: 5,
  voice: true,
  autoRematch: true
};

const VERSUS_CONFIG_STORAGE_KEY = 'douai:versus-runtime-config-v1';

function loadSavedVersusConfig(): VersusConfig {
  if (typeof window === 'undefined') return { ...defaultVersusConfig };
  try {
    const raw = window.localStorage.getItem(VERSUS_CONFIG_STORAGE_KEY);
    if (raw) return { ...defaultVersusConfig, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...defaultVersusConfig };
}

export const versusRuntimeSettings = reactive<VersusConfig>(loadSavedVersusConfig());

export interface VersusPlayer {
  id: string;
  name: string;
  avatar?: string;
  team: 'red' | 'blue';
  score: number;
}

export interface VersusRecentHit {
  id: string;
  name: string;
  avatar?: string;
  team: 'red' | 'blue';
  choice: '1' | '2';
  pts: number;
}

export const versusState = reactive({
  running: false,
  status: '待机中',
  redScore: 0,
  blueScore: 0,
  targetScore: versusRuntimeSettings.targetScore,
  winner: null as null | 'red' | 'blue',
  players: {} as Record<string, VersusPlayer>,
  recentHits: [] as VersusRecentHit[]
});

const VERSUS_SYNC_STORAGE_KEY = 'douai:versus-live-state-v1';
const VERSUS_SYNC_CHANNEL_NAME = 'douai:versus-live-sync-v1';

const isObsMirrorWindow =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('page') === 'obs';

let syncChannel: BroadcastChannel | null = null;
let isApplyingRemote = false;

interface VersusSyncSnapshot {
  state: typeof versusState;
  settings: typeof versusRuntimeSettings;
  updatedAt: number;
}

function publishVersusSync() {
  if (typeof window === 'undefined' || isObsMirrorWindow || isApplyingRemote) return;
  try {
    const snap: VersusSyncSnapshot = {
      state: JSON.parse(JSON.stringify(versusState)),
      settings: JSON.parse(JSON.stringify(versusRuntimeSettings)),
      updatedAt: Date.now()
    };
    window.localStorage.setItem(VERSUS_SYNC_STORAGE_KEY, JSON.stringify(snap));
    syncChannel?.postMessage({ type: 'SYNC_VERSUS', payload: snap });
  } catch { /* ignore */ }
}

function applyVersusSync(snap: VersusSyncSnapshot | null | undefined) {
  if (!snap || !snap.state) return;
  isApplyingRemote = true;
  try {
    Object.assign(versusState, snap.state);
    if (snap.settings) {
      Object.assign(versusRuntimeSettings, snap.settings);
    }
  } finally {
    isApplyingRemote = false;
  }
}

if (typeof window !== 'undefined') {
  try {
    if ('BroadcastChannel' in window) {
      syncChannel = new BroadcastChannel(VERSUS_SYNC_CHANNEL_NAME);
      syncChannel.addEventListener('message', (ev: MessageEvent) => {
        if (ev.data?.type === 'SYNC_VERSUS' && isObsMirrorWindow && ev.data.payload) {
          applyVersusSync(ev.data.payload);
        } else if (ev.data?.type === 'REQUEST_VERSUS' && !isObsMirrorWindow) {
          publishVersusSync();
        }
      });
    }
  } catch {
    syncChannel = null;
  }

  if (isObsMirrorWindow) {
    try {
      const raw = window.localStorage.getItem(VERSUS_SYNC_STORAGE_KEY);
      if (raw) applyVersusSync(JSON.parse(raw));
    } catch { /* ignore */ }
    window.addEventListener('storage', (ev) => {
      if (ev.key === VERSUS_SYNC_STORAGE_KEY && ev.newValue) {
        try { applyVersusSync(JSON.parse(ev.newValue)); } catch { /* ignore */ }
      }
    });
    syncChannel?.postMessage({ type: 'REQUEST_VERSUS' });
  } else {
    publishVersusSync();
    watch([versusState, versusRuntimeSettings], () => publishVersusSync(), { deep: true });
  }
}

export function updateVersusConfig(partial: Partial<VersusConfig>) {
  Object.assign(versusRuntimeSettings, partial);
  versusState.targetScore = versusRuntimeSettings.targetScore;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(VERSUS_CONFIG_STORAGE_KEY, JSON.stringify(versusRuntimeSettings));
    } catch { /* ignore */ }
  }
  publishVersusSync();
}

export function setVersusTheme(themeId: VersusThemeId) {
  updateVersusConfig({ theme: themeId });
}

export function startVersus(nextConfig?: Partial<VersusConfig>) {
  clearVoiceOwner('versus');
  if (nextConfig) {
    updateVersusConfig(nextConfig);
  }
  versusState.running = true;
  versusState.status = '对抗进行中';
  versusState.redScore = 0;
  versusState.blueScore = 0;
  versusState.targetScore = versusRuntimeSettings.targetScore;
  versusState.winner = null;
  versusState.players = {};
  versusState.recentHits = [];

  if (versusRuntimeSettings.voice) {
    speak(
      `阵营对抗赛开始！发送 ${versusRuntimeSettings.redCommand} 加入 ${versusRuntimeSettings.redTeamName}，发送 ${versusRuntimeSettings.blueCommand} 加入 ${versusRuntimeSettings.blueTeamName}！`,
      { scene: 'system', owner: 'versus' }
    );
  }
}

export function stopVersus() {
  if (!versusState.running) return;
  versusState.running = false;
  versusState.status = '对抗已结束';
  clearVoiceOwner('versus');
}

export function handleVersusMessages(messages: DyMessage[]) {
  if (!versusState.running || versusState.winner) return;

  const redCmd = (versusRuntimeSettings.redCommand || '1').trim().toLowerCase();
  const blueCmd = (versusRuntimeSettings.blueCommand || '2').trim().toLowerCase();
  const giftMult = versusRuntimeSettings.giftMultiplier || 5;

  for (const msg of messages) {
    if (msg.method === CastMethod.CHAT) {
      const text = (msg.content || '').trim().toLowerCase();
      const userId = msg.user?.id || msg.user?.name;
      if (!userId) continue;

      let chosenTeam: 'red' | 'blue' | null = null;
      let choiceNum: '1' | '2' | null = null;

      if (
        text === redCmd ||
        text.startsWith(redCmd) ||
        text.includes(versusRuntimeSettings.redTeamName.toLowerCase()) ||
        text.includes('红') ||
        text.includes('red')
      ) {
        chosenTeam = 'red';
        choiceNum = '1';
      } else if (
        text === blueCmd ||
        text.startsWith(blueCmd) ||
        text.includes(versusRuntimeSettings.blueTeamName.toLowerCase()) ||
        text.includes('蓝') ||
        text.includes('blue')
      ) {
        chosenTeam = 'blue';
        choiceNum = '2';
      }

      if (chosenTeam && choiceNum) {
        const player = versusState.players[userId] || {
          id: userId,
          name: msg.user?.name || '观众',
          avatar: msg.user?.avatar,
          team: chosenTeam,
          score: 0
        };
        player.team = chosenTeam;
        player.score += 1;
        versusState.players[userId] = player;

        if (chosenTeam === 'red') {
          versusState.redScore += 1;
        } else {
          versusState.blueScore += 1;
        }

        try { soundEffects.playCorrect(); } catch { /* ignore */ }

        versusState.recentHits.unshift({
          id: `${userId}-${Date.now()}-${Math.random()}`,
          name: player.name,
          avatar: player.avatar,
          team: chosenTeam,
          choice: choiceNum,
          pts: 1
        });
        versusState.recentHits.splice(8);

        // 胜负判定
        if (versusState.redScore >= versusState.targetScore) {
          versusState.winner = 'red';
          versusState.status = `${versusRuntimeSettings.redTeamName} 获胜！`;
          if (versusRuntimeSettings.voice) {
            speak(`恭喜${versusRuntimeSettings.redTeamName}拔得头筹，赢得了本场对抗胜利！`, { scene: 'system', owner: 'versus' });
          }
        } else if (versusState.blueScore >= versusState.targetScore) {
          versusState.winner = 'blue';
          versusState.status = `${versusRuntimeSettings.blueTeamName} 获胜！`;
          if (versusRuntimeSettings.voice) {
            speak(`恭喜${versusRuntimeSettings.blueTeamName}逆转夺魁，赢得了本场对抗胜利！`, { scene: 'system', owner: 'versus' });
          }
        }
      }
    } else if (msg.method === CastMethod.GIFT && msg.gift) {
      // 礼物暴击支持当前阵营
      const userId = msg.user?.id || msg.user?.name;
      if (!userId) continue;
      const count = Math.max(1, Number(msg.gift.count) || 1);
      const player = versusState.players[userId];
      const team = player ? player.team : (Math.random() > 0.5 ? 'red' : 'blue');
      const bonus = count * giftMult;

      if (team === 'red') versusState.redScore += bonus;
      else versusState.blueScore += bonus;

      if (player) player.score += bonus;
      try { soundEffects.playGift(); } catch { /* ignore */ }

      // 胜负判定
      if (versusState.redScore >= versusState.targetScore) {
        versusState.winner = 'red';
        versusState.status = `${versusRuntimeSettings.redTeamName} 获胜！`;
        if (versusRuntimeSettings.voice) {
          speak(`恭喜${versusRuntimeSettings.redTeamName}送礼绝杀，赢得了本场对抗胜利！`, { scene: 'system', owner: 'versus' });
        }
      } else if (versusState.blueScore >= versusState.targetScore) {
        versusState.winner = 'blue';
        versusState.status = `${versusRuntimeSettings.blueTeamName} 获胜！`;
        if (versusRuntimeSettings.voice) {
          speak(`恭喜${versusRuntimeSettings.blueTeamName}送礼绝杀，赢得了本场对抗胜利！`, { scene: 'system', owner: 'versus' });
        }
      }
    }
  }
}
