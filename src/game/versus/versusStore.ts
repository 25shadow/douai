import { computed, reactive, watch } from 'vue';
import type { DyMessage } from '../../core/type.ts';
import { CastMethod } from '../../core/type.ts';
import { speak, clearVoiceOwner } from '../../voice/voiceManager.ts';
import { soundEffects } from '../../utils/soundEffects.ts';

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
  targetScore: 200,
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

function publishVersusSync() {
  if (typeof window === 'undefined' || isObsMirrorWindow || isApplyingRemote) return;
  try {
    const snap = JSON.parse(JSON.stringify(versusState));
    window.localStorage.setItem(VERSUS_SYNC_STORAGE_KEY, JSON.stringify(snap));
    syncChannel?.postMessage({ type: 'SYNC_VERSUS', payload: snap });
  } catch { /* ignore */ }
}

function applyVersusSync(snap: any) {
  if (!snap) return;
  isApplyingRemote = true;
  try {
    Object.assign(versusState, snap);
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
    watch(versusState, () => publishVersusSync(), { deep: true });
  }
}

export function startVersus() {
  clearVoiceOwner('versus');
  versusState.running = true;
  versusState.status = '对抗进行中';
  versusState.redScore = 0;
  versusState.blueScore = 0;
  versusState.winner = null;
  versusState.players = {};
  versusState.recentHits = [];

  speak('红蓝阵营对抗赛开始！发送1加入红队，发送2加入蓝队！', { scene: 'system', owner: 'versus' });
}

export function stopVersus() {
  if (!versusState.running) return;
  versusState.running = false;
  versusState.status = '对抗已结束';
  clearVoiceOwner('versus');
}

export function handleVersusMessages(messages: DyMessage[]) {
  if (!versusState.running || versusState.winner) return;

  for (const msg of messages) {
    if (msg.method === CastMethod.CHAT) {
      const text = (msg.content || '').trim();
      const userId = msg.user?.id || msg.user?.name;
      if (!userId) continue;

      let chosenTeam: 'red' | 'blue' | null = null;
      let choiceNum: '1' | '2' | null = null;

      if (text === '1' || text.startsWith('1') || text.includes('红') || text.toLowerCase().includes('red')) {
        chosenTeam = 'red';
        choiceNum = '1';
      } else if (text === '2' || text.startsWith('2') || text.includes('蓝') || text.toLowerCase().includes('blue')) {
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
        // 允许切换或固定阵营
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
          versusState.status = '红队获胜！';
          speak('恭喜烈焰红队拔得头筹，赢得了本场对抗胜利！', { scene: 'system', owner: 'versus' });
        } else if (versusState.blueScore >= versusState.targetScore) {
          versusState.winner = 'blue';
          versusState.status = '蓝队获胜！';
          speak('恭喜极光蓝队逆转夺魁，赢得了本场对抗胜利！', { scene: 'system', owner: 'versus' });
        }
      }
    } else if (msg.method === CastMethod.GIFT && msg.gift) {
      // 礼物暴击支持当前阵营
      const userId = msg.user?.id || msg.user?.name;
      if (!userId) continue;
      const count = Math.max(1, Number(msg.gift.count) || 1);
      const player = versusState.players[userId];
      const team = player ? player.team : (Math.random() > 0.5 ? 'red' : 'blue');
      const bonus = count * 5;

      if (team === 'red') versusState.redScore += bonus;
      else versusState.blueScore += bonus;

      if (player) player.score += bonus;
      try { soundEffects.playGift(); } catch { /* ignore */ }
    }
  }
}
