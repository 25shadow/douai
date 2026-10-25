<template>
  <div class="home-dashboard">
    <!-- 顶部问候与实时时钟横幅 (参考图 Hero Banner) -->
    <section class="hero-banner">
      <div class="hero-content">
        <div class="greeting-row">
          <h1>{{ greetingText }}，主播 👋</h1>
        </div>
        <p class="greeting-subtitle">
          今天是 {{ dateString }}，祝直播顺利、人气爆棚！
        </p>
        <div class="hero-tags">
          <span class="hero-tag">
            <Gamepad2 :size="13" />
            <span>119 款游戏畅播</span>
          </span>
          <span class="hero-tag">
            <Radio :size="13" />
            <span>真弹幕互动</span>
          </span>
          <span class="hero-tag">
            <Volume2 :size="13" />
            <span>智能朗读</span>
          </span>
        </div>
      </div>

      <div class="hero-clock">
        <span class="clock-time">{{ currentTimeString }}</span>
        <span class="clock-day">{{ weekDayString }}</span>
      </div>
    </section>

    <!-- 四项快捷指标/操作卡片 (参考图 4 Grid Cards) -->
    <section class="metric-cards-row">
      <!-- 直播间状态卡片 -->
      <div class="quick-card" @click="$emit('navigate', 'connect')">
        <div class="card-icon-wrap icon-live">
          <Radio :size="22" />
        </div>
        <div class="card-body">
          <span class="card-label">直播间</span>
          <strong class="card-value" :class="{ active: liveState.connection === 'live' }">
            {{ liveState.connection === 'live' ? '已连接' : simulationState.active ? '模拟中' : '未连接' }}
          </strong>
        </div>
        <span class="card-action-link">去连接 ›</span>
      </div>

      <!-- 游戏库状态卡片 -->
      <div class="quick-card" @click="$emit('navigate', 'games')">
        <div class="card-icon-wrap icon-games">
          <Gamepad2 :size="22" />
        </div>
        <div class="card-body">
          <span class="card-label">游戏库</span>
          <strong class="card-value">{{ quizState.running ? '问答运行中' : '知识问答等' }}</strong>
        </div>
        <span class="card-action-link">去开播 ›</span>
      </div>

      <!-- 弹幕消息卡片 -->
      <div class="quick-card" @click="$emit('navigate', 'console')">
        <div class="card-icon-wrap icon-chat">
          <MessageSquare :size="22" />
        </div>
        <div class="card-body">
          <span class="card-label">弹幕消息</span>
          <strong class="card-value">{{ liveState.activityFeed.length }} 条</strong>
        </div>
        <span class="card-action-link">看弹幕 ›</span>
      </div>

      <!-- 会员状态卡片 -->
      <div class="quick-card" @click="$emit('open-license')">
        <div class="card-icon-wrap icon-vip">
          <Crown :size="22" />
        </div>
        <div class="card-body">
          <span class="card-label">会员状态</span>
          <strong class="card-value">2027/10/22</strong>
        </div>
        <span class="card-action-link">去充值 ›</span>
      </div>
    </section>

    <!-- 开播三步走引导卡片 (参考图 开播三步走) -->
    <section class="onboarding-guide-section">
      <div class="section-title-row">
        <div class="title-with-dot">
          <span class="guide-dot"></span>
          <h2>开播三步走</h2>
        </div>
        <span class="guide-tip">新手主播指南，轻松实现无人/半无人智能直播</span>
      </div>

      <div class="step-cards-container">
        <!-- 步骤 1 -->
        <div class="step-card" @click="$emit('navigate', 'connect')">
          <div class="step-num-badge">1</div>
          <div class="step-content">
            <h3>连接直播间</h3>
            <p>输入直播间链接连上抖音，弹幕、礼物、点赞实时接入</p>
          </div>
        </div>

        <div class="step-arrow">
          <ChevronRight :size="20" />
        </div>

        <!-- 步骤 2 -->
        <div class="step-card" @click="handleStep2Click">
          <div class="step-num-badge">2</div>
          <div class="step-content">
            <h3>挑游戏开播</h3>
            <p>点「进入游戏」弹出 9:16 竖屏窗口，OBS 或直播伴侣直接捕获</p>
          </div>
        </div>

        <div class="step-arrow">
          <ChevronRight :size="20" />
        </div>

        <!-- 步骤 3 -->
        <div class="step-card" @click="$emit('navigate', 'voice')">
          <div class="step-num-badge">3</div>
          <div class="step-content">
            <h3>声卡进直播</h3>
            <p>报时/朗读走 CABLE 虚拟声卡，直播伴侣「桌面音频」收进去</p>
          </div>
        </div>
      </div>
    </section>

    <!-- 最新弹幕实时墙 (参考图 最新弹幕) -->
    <section class="live-feed-section">
      <div class="feed-header">
        <div class="title-with-dot">
          <span class="feed-dot"></span>
          <h2>最新弹幕</h2>
          <span class="feed-badge">{{ liveState.activityFeed.length }} 条互动</span>
        </div>

        <div class="feed-controls">
          <button 
            v-if="simulationState.active"
            class="simulation-switch-btn stop"
            type="button"
            @click="stopLiveSimulation"
          >
            结束本地模拟
          </button>
          <button 
            v-else
            class="simulation-switch-btn start"
            type="button"
            title="无需连接真实直播间，一键模拟真实弹幕与送礼答题"
            @click="quickDemo"
          >
            <Sparkles :size="13" />
            <span>模拟弹幕演示</span>
          </button>
        </div>
      </div>

      <div class="feed-list-wrap">
        <div v-if="liveState.activityFeed.length" class="feed-items-list">
          <div 
            v-for="item in liveState.activityFeed" 
            :key="item.id" 
            class="feed-row"
            :class="`kind-${item.kind}`"
          >
            <UserAvatar :src="item.userAvatar" :name="item.userName" />
            <div class="feed-info">
              <div class="feed-user-meta">
                <span class="user-name">{{ item.userName }}</span>
                <span class="event-chip" :class="item.kind">
                  {{ item.kind === 'gift' ? '送出礼物' : item.kind === 'like' ? '点赞' : '发送评论' }}
                </span>
                <span class="event-time">{{ formatTime(item.timestamp) }}</span>
              </div>
              <p class="feed-message">
                <img v-if="item.kind === 'gift' && item.giftIcon" class="gift-icon" :src="item.giftIcon" alt="" />
                {{ item.detail }}
              </p>
            </div>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-else class="feed-empty-state">
          <div class="empty-icon-wrap">
            <MessageSquare :size="32" />
          </div>
          <p>暂无实时互动弹幕</p>
          <small>连接抖音直播间或点击右上角「模拟弹幕演示」体验实时答题与礼物特效</small>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { 
  Gamepad2, Radio, Volume2, MessageSquare, Crown, 
  ChevronRight, Sparkles 
} from '@lucide/vue';
import { liveState, simulationState, startLiveSimulation, stopLiveSimulation } from '@/stores/liveStore';
import { quizState, startQuiz } from '@/game/quiz/quizStore';
import UserAvatar from '@/components/UserAvatar.vue';

const emit = defineEmits<{
  navigate: [page: 'home' | 'connect' | 'games' | 'quiz' | 'voice' | 'bgm' | 'settings' | 'console'];
  'open-license': [];
  'toggle-obs-window': [];
}>();

// 实时时钟
const now = ref(new Date());
let timerId: number | undefined;

onMounted(() => {
  timerId = window.setInterval(() => {
    now.value = new Date();
  }, 1000);
});

onBeforeUnmount(() => {
  if (timerId) clearInterval(timerId);
});

const currentTimeString = computed(() => {
  const h = String(now.value.getHours()).padStart(2, '0');
  const m = String(now.value.getMinutes()).padStart(2, '0');
  const s = String(now.value.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
});

const weekDayString = computed(() => {
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return days[now.value.getDay()];
});

const dateString = computed(() => {
  const y = now.value.getFullYear();
  const m = now.value.getMonth() + 1;
  const d = now.value.getDate();
  const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  return `${y} 年 ${m} 月 ${d} 日 ${days[now.value.getDay()]}`;
});

const greetingText = computed(() => {
  const hour = now.value.getHours();
  if (hour < 6) return '夜深了';
  if (hour < 11) return '早上好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
});

function formatTime(timestamp?: number) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
}

function handleStep2Click() {
  // 打开 OBS 画面窗口并启动游戏
  emit('toggle-obs-window');
  if (!quizState.running) {
    startQuiz();
  }
}

async function quickDemo() {
  if (simulationState.active) return;
  await startLiveSimulation({
    durationMinutes: 10,
    audience: 150,
    eventIntervalSeconds: 3
  }, 'quiz');
}
</script>

<style scoped>
.home-dashboard {
  padding: 16px 20px 30px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 1320px;
  margin: 0 auto;
  min-height: 100%;
}

/* 顶部大横幅 (Hero) */
.hero-banner {
  border-radius: var(--radius-lg);
  background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 45%, #ec4899 100%);
  padding: 24px 28px;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 10px 25px -5px rgba(124, 58, 237, 0.35);
  position: relative;
  overflow: hidden;
}

.hero-banner::after {
  content: '';
  position: absolute;
  top: -40%;
  right: -10%;
  width: 320px;
  height: 320px;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.15) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
}

.hero-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 1;
}

.greeting-row h1 {
  margin: 0;
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.greeting-subtitle {
  margin: 0;
  font-size: 13px;
  opacity: 0.9;
  letter-spacing: 0.02em;
}

.hero-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 6px;
}

.hero-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  background: rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(8px);
  border-radius: 20px;
  font-size: 11px;
  font-weight: 500;
}

.hero-clock {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  z-index: 1;
}

.clock-time {
  font-size: 38px;
  font-weight: 800;
  font-family: ui-monospace, 'SF Pro Display', -apple-system, sans-serif;
  letter-spacing: 0.04em;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.clock-day {
  font-size: 13px;
  font-weight: 600;
  opacity: 0.85;
}

/* 四张指标快捷卡片 */
.metric-cards-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}

.quick-card {
  background: #ffffff;
  border-radius: var(--radius-md);
  border: 1px solid var(--line);
  padding: 14px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: var(--card-shadow);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
}

.quick-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--card-shadow-hover);
  border-color: rgba(16, 185, 129, 0.3);
}

.card-icon-wrap {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.icon-live {
  background: #fef2f2;
  color: #ef4444;
}

.icon-games {
  background: #ecfdf5;
  color: #10b981;
}

.icon-chat {
  background: #fffbeb;
  color: #f59e0b;
}

.icon-vip {
  background: #fdf2f8;
  color: #ec4899;
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.card-label {
  font-size: 12px;
  color: var(--text-muted);
}

.card-value {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-value.active {
  color: #10b981;
}

.card-action-link {
  font-size: 12px;
  color: #94a3b8;
  font-weight: 600;
  transition: color 0.15s;
}

.quick-card:hover .card-action-link {
  color: #10b981;
}

/* 开播三步走 */
.onboarding-guide-section {
  background: #ffffff;
  border-radius: var(--radius-md);
  border: 1px solid var(--line);
  padding: 18px 20px;
  box-shadow: var(--card-shadow);
}

.section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.title-with-dot {
  display: flex;
  align-items: center;
  gap: 8px;
}

.guide-dot, .feed-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10b981;
}

.title-with-dot h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-main);
}

.guide-tip {
  font-size: 12px;
  color: var(--text-muted);
}

.step-cards-container {
  display: grid;
  grid-template-columns: 1fr auto 1fr auto 1fr;
  align-items: center;
  gap: 12px;
}

.step-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: var(--radius-md);
  padding: 14px 16px;
  display: flex;
  gap: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.step-card:hover {
  background: #ffffff;
  border-color: #10b981;
  box-shadow: 0 4px 14px rgba(16, 185, 129, 0.12);
  transform: translateY(-2px);
}

.step-num-badge {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: #10b981;
  color: #ffffff;
  display: grid;
  place-items: center;
  font-weight: 800;
  font-size: 14px;
  flex-shrink: 0;
  box-shadow: 0 2px 6px rgba(16, 185, 129, 0.3);
}

.step-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.step-content h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-main);
}

.step-content p {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.5;
}

.step-arrow {
  color: #cbd5e1;
  display: grid;
  place-items: center;
}

/* 最新弹幕互动墙 */
.live-feed-section {
  background: #ffffff;
  border-radius: var(--radius-md);
  border: 1px solid var(--line);
  padding: 18px 20px;
  box-shadow: var(--card-shadow);
  display: flex;
  flex-direction: column;
  gap: 14px;
  flex: 1;
}

.feed-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.feed-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 12px;
  background: #ecfdf5;
  color: #059669;
}

.simulation-switch-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  transition: all 0.15s;
}

.simulation-switch-btn.start {
  background: #f5f3ff;
  border: 1px solid #ddd6fe;
  color: #7c3aed;
}
.simulation-switch-btn.start:hover {
  background: #ede9fe;
  border-color: #c4b5fd;
}

.simulation-switch-btn.stop {
  background: #fee2e2;
  border: 1px solid #fca5a5;
  color: #b91c1c;
}
.simulation-switch-btn.stop:hover {
  background: #fecaca;
}

.feed-list-wrap {
  min-height: 200px;
  max-height: 380px;
  overflow-y: auto;
}

.feed-items-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.feed-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 9px 12px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #f1f5f9;
  transition: all 0.15s;
}

.feed-row:hover {
  background: #ffffff;
  border-color: #e2e8f0;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
}

.feed-row.kind-gift {
  background: #fefce8;
  border-color: #fef08a;
}

.feed-row.kind-like {
  background: #fdf2f8;
  border-color: #fbcfe8;
}

.feed-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.feed-user-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-name {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-main);
}

.event-chip {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
}

.event-chip.comment {
  background: #e2e8f0;
  color: #475569;
}
.event-chip.like {
  background: #fce7f3;
  color: #db2777;
}
.event-chip.gift {
  background: #fef3c7;
  color: #d97706;
}

.event-time {
  margin-left: auto;
  font-size: 11px;
  color: var(--text-faint);
  font-family: ui-monospace, monospace;
}

.feed-message {
  margin: 0;
  font-size: 13px;
  color: #334155;
  display: flex;
  align-items: center;
  gap: 6px;
}

.gift-icon {
  width: 18px;
  height: 18px;
  object-fit: contain;
}

.feed-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--text-muted);
  text-align: center;
  gap: 8px;
}

.empty-icon-wrap {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: #f1f5f9;
  display: grid;
  place-items: center;
  color: #94a3b8;
  margin-bottom: 4px;
}

.feed-empty-state p {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-main);
}

.feed-empty-state small {
  font-size: 12px;
  color: var(--text-muted);
}

@media (max-width: 900px) {
  .metric-cards-row {
    grid-template-columns: repeat(2, 1fr);
  }
  .step-cards-container {
    grid-template-columns: 1fr;
  }
  .step-arrow {
    transform: rotate(90deg);
  }
}
</style>
