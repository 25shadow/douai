<template>
  <div class="versus-config-view">
    <!-- 顶部导航与持久化保存控制栏 -->
    <header class="versus-header">
      <div class="header-left">
        <button class="back-link-btn" type="button" @click="$emit('back')">
          <ArrowLeft :size="14" />
          <span>返回游戏中心</span>
        </button>
        <div class="header-title-box">
          <div class="tag-row">
            <span class="sub-badge">FACTION BATTLE ARENA</span>
            <span class="version-badge">9:16 OBS 直播对决</span>
          </div>
          <h1>阵营对抗 · 配置与规则</h1>
          <p>配置红蓝双阵营答题对抗流程、抢答与入队指令、点赞排除错项与礼物暴击机制及专属 9:16 直播主题。</p>
        </div>
      </div>

      <!-- 右侧配置持久化保存工具组 -->
      <div class="persistence-toolbar">
        <div class="save-status-info">
          <span v-if="saveSuccess" class="status-tip success">
            <CheckCircle2 :size="13" /> 已保存至本地配置
          </span>
          <span v-else-if="saveMessage" class="status-tip">
            {{ saveMessage }}
          </span>
          <span v-else class="status-tip">
            参数编辑后点击保存，独立存储不与问答冲突
          </span>
        </div>

        <button 
          class="primary-save-btn" 
          type="button" 
          :disabled="saving"
          @click="saveVersusSettings"
        >
          <Save :size="15" />
          <span>{{ saving ? '正在保存…' : '保存对抗配置' }}</span>
        </button>
      </div>
    </header>

    <!-- 独立的生命周期与调试控制坞 -->
    <div class="runtime-control-deck" :class="{ active: versusState.running }">
      <div class="deck-meta">
        <div class="deck-title-row">
          <span class="deck-indicator-dot" :class="{ live: versusState.running }"></span>
          <strong class="deck-title">对决运行时控制与即时测试</strong>
          <span class="deck-badge" :class="{ live: versusState.running }">
            {{ versusState.running ? '对抗实例：正在激战中 (LIVE)' : '对抗实例：未启动 (IDLE)' }}
          </span>
        </div>
        <p class="deck-notice">
          💡 <strong>独立对决运行说明</strong>：阵营对抗与知识问答为完全独立的两个游戏。观众发送 <code>{{ config.redCommand }}</code> / <code>{{ config.blueCommand }}</code> 入队，发送 <code>A/B/C/D</code> 抢答；答对为本阵营拉扯拔河/血条！
        </p>

        <!-- 运行中的即时状态指标 -->
        <div v-if="versusState.running" class="deck-live-info">
          <span class="live-pill">第 <b>{{ versusState.questionIndex }}</b> 题 ({{ versusState.phase === 'answering' ? '抢答中' : '公布答案' }})</span>
          <span class="live-pill timer">剩余 <b>{{ versusState.timeLeft }}</b> 秒</span>
          <span class="live-pill red-score">🔴 {{ config.redTeamName }}: <b>{{ versusState.redScore }}</b> 分</span>
          <span class="live-pill vs-tag">VS</span>
          <span class="live-pill blue-score">🔵 {{ config.blueTeamName }}: <b>{{ versusState.blueScore }}</b> 分</span>
          <span class="live-pill target">目标: <b>{{ versusState.targetScore }}</b> 分</span>
        </div>
      </div>

      <!-- 运行时操作按钮组 -->
      <div class="deck-actions-wrapper">
        <div class="deck-actions">
          <template v-if="versusState.running">
            <button 
              class="action-btn next-btn" 
              type="button" 
              title="跳过当前题目直接进入下一题"
              @click="nextVersusQuestion"
            >
              <FastForward :size="14" />
              <span>进入下一题</span>
            </button>

            <button 
              class="action-btn obs-window-btn" 
              type="button" 
              title="预览当前对抗直播主题效果"
              @click="$emit('launch-obs')"
            >
              <Eye :size="14" />
              <span>主题预览 (OBS)</span>
            </button>

            <button 
              class="action-btn stop-game-btn" 
              type="button" 
              title="结束当前对决"
              @click="handleStopVersus"
            >
              <Square :size="14" />
              <span>关闭 / 结束对决</span>
            </button>
          </template>

          <template v-else>
            <button 
              class="action-btn launch-game-btn" 
              type="button" 
              title="直接以当前界面的参数启动阵营对抗"
              @click="handleLaunchVersus"
            >
              <Play :size="15" fill="currentColor" />
              <span>启动对决 (应用当前参数)</span>
            </button>

            <button 
              class="action-btn obs-window-btn" 
              type="button" 
              title="预览当前对抗直播主题效果"
              @click="$emit('launch-obs')"
            >
              <Eye :size="15" />
              <span>主题预览 (OBS)</span>
            </button>
          </template>
        </div>

        <!-- 联调模拟工具快捷条 -->
        <div v-if="versusState.running" class="sim-tools-row">
          <span class="sim-label">⚡ 快速联调：</span>
          <button class="sim-btn red" type="button" @click="simulateVersusAnswer('red', true)">
            🔴 模拟红队答对 (+{{ config.pointsPerCorrect }}分)
          </button>
          <button class="sim-btn blue" type="button" @click="simulateVersusAnswer('blue', true)">
            🔵 模拟蓝队答对 (+{{ config.pointsPerCorrect }}分)
          </button>
          <button class="sim-btn gift" type="button" @click="simulateVersusGift('red', 1)">
            🎁 模拟红队送礼 (暴击)
          </button>
          <button class="sim-btn gift-blue" type="button" @click="simulateVersusGift('blue', 1)">
            🎁 模拟蓝队送礼 (暴击)
          </button>
          <button class="sim-btn like" type="button" @click="simulateVersusLike">
            💖 模拟全员点赞 (+100)
          </button>
        </div>
      </div>
    </div>

    <!-- 配置分页导航 Tabs -->
    <nav class="config-tabs-nav" aria-label="阵营对抗配置选项卡">
      <button 
        type="button" 
        class="tab-btn" 
        :class="{ active: activeTab === 'banks' }" 
        @click="activeTab = 'banks'"
      >
        <BookOpen :size="15" />
        <span>题库与出题</span>
        <span class="count-pill">{{ availableVersusBankNames.length }}</span>
      </button>

      <button 
        type="button" 
        class="tab-btn" 
        :class="{ active: activeTab === 'factions' }" 
        @click="activeTab = 'factions'"
      >
        <Users :size="15" />
        <span>阵营与指令</span>
      </button>

      <button 
        type="button" 
        class="tab-btn" 
        :class="{ active: activeTab === 'victory' }" 
        @click="activeTab = 'victory'"
      >
        <Trophy :size="15" />
        <span>胜负机制与分值</span>
      </button>

      <button 
        type="button" 
        class="tab-btn" 
        :class="{ active: activeTab === 'assist' }" 
        @click="activeTab = 'assist'"
      >
        <Sparkles :size="15" />
        <span>点赞与送礼特权</span>
      </button>

      <button 
        type="button" 
        class="tab-btn" 
        :class="{ active: activeTab === 'theme' }" 
        @click="activeTab = 'theme'"
      >
        <Palette :size="15" />
        <span>对决主题视觉</span>
        <span class="count-pill">4</span>
      </button>

      <button 
        type="button" 
        class="tab-btn" 
        :class="{ active: activeTab === 'voice' }" 
        @click="activeTab = 'voice'"
      >
        <Volume2 :size="15" />
        <span>语音解说设置</span>
      </button>
    </nav>

    <!-- ================= 1. 题库与出题面板 ================= -->
    <section v-if="activeTab === 'banks'" class="config-panel-card">
      <div class="panel-header">
        <div>
          <span class="panel-kicker">FACTION QUIZ REPOSITORY</span>
          <h2>题库选择与出题时长设置</h2>
        </div>
        <span class="panel-tag">{{ availableVersusBankNames.length }} 个对抗题库 · {{ selectedQuestions.length }} 道候选题目</span>
      </div>

      <div class="bank-layout">
        <aside class="bank-list-sidebar" aria-label="题库列表">
          <button 
            v-for="name in availableVersusBankNames" 
            :key="name" 
            class="bank-item-btn" 
            :class="{ selected: config.bank === name }" 
            @click="config.bank = name"
          >
            <span class="bank-item-title">{{ name }}</span>
            <span class="bank-item-count">{{ getBankQuestions(name).length }} 题</span>
          </button>
        </aside>

        <div class="bank-preview-content">
          <div class="preview-header">
            <div>
              <h3>{{ config.bank }}</h3>
              <p class="preview-sub">共 {{ selectedQuestions.length }} 道题 · 对抗开始时将从中随机抽取</p>
            </div>
          </div>

          <ol class="question-preview-list">
            <li v-for="(question, index) in selectedQuestions.slice(0, 6)" :key="`${index}-${question.title}`">
              <strong class="q-title">{{ index + 1 }}. {{ question.title }}</strong>
              <div class="option-grid">
                <span 
                  v-for="key in (['A', 'B', 'C', 'D'] as const)" 
                  :key="key" 
                  class="option-pill"
                  :class="{ correct: question.answer === key }"
                >
                  <b>{{ key }}.</b> {{ question.options[key] }}
                </span>
              </div>
            </li>
          </ol>

          <div class="bank-settings-row">
            <div class="input-unit">
              <label>本场出题总数（0 为不限直至达到胜负分）</label>
              <input v-model.number="config.questionCount" type="number" min="0" max="100" />
              <small>填 0 则持续出题直到任一队伍达到目标胜负分</small>
            </div>

            <div class="input-unit">
              <label>每题抢答倒计时（秒）</label>
              <input v-model.number="config.answerTime" type="number" min="5" max="120" />
              <small>推荐 20 ~ 30 秒，节奏更快更刺激</small>
            </div>

            <div class="input-unit">
              <label>公布答案停留时长（秒）</label>
              <input v-model.number="config.revealTime" type="number" min="2" max="15" />
              <small>推荐 3 ~ 5 秒</small>
            </div>

            <div class="input-unit toggle-unit">
              <label>自动推进下一题</label>
              <div class="toggle-wrapper">
                <input id="autoNext" v-model="config.autoNext" type="checkbox" />
                <label for="autoNext" class="toggle-text">{{ config.autoNext ? '揭晓后自动出下一题' : '需主播手动点击下一题' }}</label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ================= 2. 阵营与指令面板 ================= -->
    <section v-if="activeTab === 'factions'" class="config-panel-card">
      <div class="panel-header">
        <div>
          <span class="panel-kicker">TEAMS & COMMANDS</span>
          <h2>阵营名称与弹幕互动指令</h2>
        </div>
        <span class="panel-tag">双阵营配置</span>
      </div>

      <div class="factions-config-grid">
        <!-- 红方阵营卡 -->
        <div class="faction-setting-card red-theme">
          <div class="faction-card-title">
            <span class="color-badge red"></span>
            <h3>红方阵营设置</h3>
          </div>

          <div class="form-group">
            <label>红方队伍名称</label>
            <input v-model="config.redTeamName" type="text" placeholder="例如：烈焰红队" />
            <small>将在大屏对决计分板与语音解说中展现</small>
          </div>

          <div class="form-group">
            <label>加入红队弹幕指令</label>
            <input v-model="config.redCommand" type="text" placeholder="1" />
            <small>观众在公屏发送该指令自动加入红方阵营</small>
          </div>
        </div>

        <!-- 蓝方阵营卡 -->
        <div class="faction-setting-card blue-theme">
          <div class="faction-card-title">
            <span class="color-badge blue"></span>
            <h3>蓝方阵营设置</h3>
          </div>

          <div class="form-group">
            <label>蓝方队伍名称</label>
            <input v-model="config.blueTeamName" type="text" placeholder="例如：极光蓝队" />
            <small>将在大屏对决计分板与语音解说中展现</small>
          </div>

          <div class="form-group">
            <label>加入蓝队弹幕指令</label>
            <input v-model="config.blueCommand" type="text" placeholder="2" />
            <small>观众在公屏发送该指令自动加入蓝方阵营</small>
          </div>
        </div>
      </div>

      <!-- 弹幕交互方式说明 -->
      <div class="interaction-rules-box">
        <h4>📢 观众在直播间如何参与答题对抗？</h4>
        <div class="rule-steps-row">
          <div class="step-card">
            <div class="step-num">1</div>
            <strong>发送入队指令</strong>
            <p>公屏发送 <code>{{ config.redCommand }}</code> 加入 {{ config.redTeamName }}；发送 <code>{{ config.blueCommand }}</code> 加入 {{ config.blueTeamName }}。</p>
          </div>
          <div class="step-card">
            <div class="step-num">2</div>
            <strong>直接公屏抢答</strong>
            <p>入队后直接发送 <code>A</code>、<code>B</code>、<code>C</code>、<code>D</code>。答对即可为所在阵营累加 <b>+{{ config.pointsPerCorrect }}</b> 积分并拉扯血条！</p>
          </div>
          <div class="step-card">
            <div class="step-num">3</div>
            <strong>一键复合指令</strong>
            <p>观众亦可发送 <code>{{ config.redCommand }}A</code> 或 <code>{{ config.blueCommand }}B</code> 快速加入并立即为对应队伍抢答！</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ================= 3. 胜负机制面板 ================= -->
    <section v-if="activeTab === 'victory'" class="config-panel-card">
      <div class="panel-header">
        <div>
          <span class="panel-kicker">VICTORY CONDITIONS & SCORING</span>
          <h2>胜负判定机制与得分设置</h2>
        </div>
        <span class="panel-tag">拔河与积分制</span>
      </div>

      <div class="rules-form-grid">
        <div class="rule-input-card">
          <label class="card-label">胜利目标分数 (Target Score)</label>
          <input v-model.number="config.targetScore" type="number" min="20" max="5000" step="10" />
          <p class="card-desc">任何一方阵营率先达到此分数即可达成 KO / 拔河胜利，触发大屏胜利特效与语音报捷。</p>
        </div>

        <div class="rule-input-card">
          <label class="card-label">每名观众答对单题奖励阵营分</label>
          <input v-model.number="config.pointsPerCorrect" type="number" min="1" max="100" />
          <p class="card-desc">每位队伍成员答对题目为阵营增加的积分（推荐 10 分，拔河更具博弈拉扯感）。</p>
        </div>

        <div class="rule-input-card">
          <label class="card-label">对决结束后自动轮次重置</label>
          <div class="toggle-wrapper" style="margin-top: 10px;">
            <input id="autoRematch" v-model="config.autoRematch" type="checkbox" />
            <label for="autoRematch" class="toggle-text">{{ config.autoRematch ? '胜利揭晓后保留队伍开启新轮次' : '手动点击重新开始' }}</label>
          </div>
          <p class="card-desc">连续开播时推荐开启，保持直播间对战热度不间断。</p>
        </div>
      </div>
    </section>

    <!-- ================= 4. 点赞与礼物特权面板 ================= -->
    <section v-if="activeTab === 'assist'" class="config-panel-card">
      <div class="panel-header">
        <div>
          <span class="panel-kicker">INTERACTIVE BUFFS</span>
          <h2>全员点赞助力与礼物暴击特权</h2>
        </div>
        <span class="panel-tag">高收益互动机制</span>
      </div>

      <div class="buffs-container">
        <!-- 点赞助力卡 -->
        <div class="buff-card">
          <div class="buff-title-row">
            <span class="buff-icon like-color">💖</span>
            <div>
              <h3>全员点赞排除错误项 (Like Assistance)</h3>
              <p>观众点赞可为全场积攒助力能量，突破阈值自动排除 1 个错误选项（最多排除 2 项）。</p>
            </div>
          </div>

          <div class="buff-inputs">
            <div class="input-unit">
              <label>每排除 1 个错误项所需累计点赞数</label>
              <input v-model.number="config.likeThreshold" type="number" min="50" max="2000" step="50" />
              <small>例如设为 300 赞，达到 300 赞排除第 1 个错项，再积累 300 赞排除第 2 个错项</small>
            </div>
          </div>
        </div>

        <!-- 礼物暴击卡 -->
        <div class="buff-card">
          <div class="buff-title-row">
            <span class="buff-icon gift-color">🎁</span>
            <div>
              <h3>礼物积分暴击加成 (Gift Multiplier)</h3>
              <p>观众送出付费礼物时，为所在阵营直接献上大额暴击助威积分，大幅逆转战局！</p>
            </div>
          </div>

          <div class="buff-inputs">
            <div class="input-unit">
              <label>每 1 抖币折合阵营助威分</label>
              <input v-model.number="config.giftMultiplier" type="number" min="1" max="100" />
              <small>推荐 10 倍（例如送出 10 抖币气球直接为队伍 +100 分，瞬间逆风翻盘）</small>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ================= 5. 对决主题视觉选择 ================= -->
    <section v-if="activeTab === 'theme'" class="config-panel-card">
      <div class="panel-header">
        <div>
          <span class="panel-kicker">9:16 LIVE VISUAL THEMES</span>
          <h2>专属对抗主题视觉风格</h2>
        </div>
        <span class="panel-tag">已内置 4 款高燃对抗主题</span>
      </div>

      <div class="themes-grid">
        <div 
          v-for="t in versusThemes" 
          :key="t.id" 
          class="theme-card"
          :class="{ selected: config.theme === t.id }"
          @click="selectTheme(t.id)"
        >
          <div class="theme-card-thumb" :class="t.id">
            <div class="thumb-badge">{{ t.badge }}</div>
            <div class="thumb-title">{{ t.name }}</div>
          </div>
          <div class="theme-card-body">
            <div class="theme-title-row">
              <strong>{{ t.name }}</strong>
              <span v-if="config.theme === t.id" class="active-badge">当前使用</span>
            </div>
            <p class="theme-desc">{{ t.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ================= 6. 语音解说设置 ================= -->
    <section v-if="activeTab === 'voice'" class="config-panel-card">
      <div class="panel-header">
        <div>
          <span class="panel-kicker">AI VOICE ANNOUNCER</span>
          <h2>语音裁判与实时解说设置</h2>
        </div>
        <span class="panel-tag">本地合成语音</span>
      </div>

      <div class="voice-settings-grid">
        <div class="voice-toggle-card">
          <div class="toggle-wrapper">
            <input id="voiceMain" v-model="config.voice" type="checkbox" />
            <label for="voiceMain" class="toggle-text">启用阵营对抗语音裁判与解说</label>
          </div>
          <p class="card-desc">开启后，系统将使用真人语音播报开赛指令、领先队伍提示与决胜获胜宣言。</p>
        </div>

        <div class="voice-toggle-card">
          <div class="toggle-wrapper">
            <input id="readQ" v-model="config.readQuestionVoice" type="checkbox" />
            <label for="readQ" class="toggle-text">自动朗读题目及 A/B/C/D 选项</label>
          </div>
          <p class="card-desc">出题时自动朗读题干与四个选项，极大方便不看画面的挂机观众参与抢答。</p>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import {
  ArrowLeft, Save, CheckCircle2, FastForward, Eye, Square, Play,
  BookOpen, Users, Trophy, Sparkles, Palette, Volume2
} from '@lucide/vue';
import {
  versusState,
  versusRuntimeSettings,
  versusThemes,
  versusBuiltinBanks,
  availableVersusBankNames,
  updateVersusConfig,
  setVersusTheme,
  startVersus,
  stopVersus,
  nextVersusQuestion,
  simulateVersusAnswer,
  simulateVersusGift,
  simulateVersusLike,
  type VersusThemeId,
  type VersusConfig,
  type VersusQuestion
} from '@/game/versus/versusStore';

defineEmits<{
  (e: 'back'): void;
  (e: 'launch-obs'): void;
}>();

type TabId = 'banks' | 'factions' | 'victory' | 'assist' | 'theme' | 'voice';
const activeTab = ref<TabId>('banks');

// Deep copy settings into local editable configuration
const config = reactive<VersusConfig>({ ...versusRuntimeSettings });

const saving = ref(false);
const saveSuccess = ref(false);
const saveMessage = ref('');

function getBankQuestions(bankName: string): VersusQuestion[] {
  return versusBuiltinBanks[bankName] || versusBuiltinBanks['基础知识题库'] || [];
}

const selectedQuestions = computed<VersusQuestion[]>(() => {
  return getBankQuestions(config.bank);
});

function selectTheme(themeId: VersusThemeId) {
  config.theme = themeId;
  setVersusTheme(themeId);
}

function saveVersusSettings() {
  saving.value = true;
  saveSuccess.value = false;
  saveMessage.value = '';

  try {
    updateVersusConfig({ ...config });
    saveSuccess.value = true;
    setTimeout(() => {
      saveSuccess.value = false;
    }, 2500);
  } catch (err) {
    saveMessage.value = '保存失败，请重试';
  } finally {
    saving.value = false;
  }
}

function handleLaunchVersus() {
  updateVersusConfig({ ...config });
  startVersus(config);
}

function handleStopVersus() {
  stopVersus();
}
</script>

<style scoped>
.versus-config-view {
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px 28px 48px;
  color: var(--text-main);
  box-sizing: border-box;
}

/* 顶部 Header */
.versus-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--line);
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.back-link-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  transition: color 0.15s;
}
.back-link-btn:hover {
  color: #3b82f6;
}

.tag-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sub-badge {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
  color: #f97316;
}

.version-badge {
  font-size: 11px;
  color: var(--text-muted);
  background: #f1f5f9;
  padding: 2px 8px;
  border-radius: 4px;
}

.header-title-box h1 {
  margin: 4px 0 6px;
  font-size: 24px;
  font-weight: 800;
  color: var(--text-main);
}

.header-title-box p {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
}

/* 保存工具栏 */
.persistence-toolbar {
  display: flex;
  align-items: center;
  gap: 14px;
}

.status-tip {
  font-size: 12px;
  color: var(--text-muted);
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.status-tip.success {
  color: #10b981;
  font-weight: 600;
}

.primary-save-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 8px;
  background: #2563eb;
  color: #ffffff;
  border: none;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(37, 99, 235, 0.25);
  transition: all 0.15s;
}
.primary-save-btn:hover:not(:disabled) {
  background: #1d4ed8;
  transform: translateY(-1px);
}

/* 运行时控制 Deck */
.runtime-control-deck {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px 20px;
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid var(--line);
  box-shadow: var(--card-shadow);
  transition: all 0.2s;
}
.runtime-control-deck.active {
  border-color: #f97316;
  background: linear-gradient(180deg, #fff7ed 0%, #ffffff 100%);
}

.deck-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.deck-indicator-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #94a3b8;
}
.deck-indicator-dot.live {
  background: #f97316;
  box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.25);
}

.deck-title {
  font-size: 15px;
  font-weight: 800;
}

.deck-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background: #f1f5f9;
  color: #64748b;
  font-weight: 700;
}
.deck-badge.live {
  background: #ffedd5;
  color: #c2410c;
}

.deck-notice {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--text-muted);
}
.deck-notice code {
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 4px;
  color: #f97316;
  font-weight: 700;
}

.deck-live-info {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 6px;
}

.live-pill {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 6px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}
.live-pill.timer {
  background: #fef2f2;
  color: #b91c1c;
  border-color: #fecaca;
}
.live-pill.red-score {
  background: #fef2f2;
  color: #dc2626;
  border-color: #fca5a5;
  font-weight: 700;
}
.live-pill.blue-score {
  background: #eff6ff;
  color: #2563eb;
  border-color: #93c5fd;
  font-weight: 700;
}
.live-pill.vs-tag {
  font-weight: 900;
  color: #f97316;
  background: #fff7ed;
  border-color: #fed7aa;
}

.deck-actions-wrapper {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.deck-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
}

.launch-game-btn {
  background: #f97316;
  color: #ffffff;
  border: none;
  box-shadow: 0 1px 3px rgba(249, 115, 22, 0.3);
}
.launch-game-btn:hover {
  background: #ea580c;
}

.obs-window-btn {
  background: #f8fafc;
  color: #334155;
  border: 1px solid #cbd5e1;
}
.obs-window-btn:hover {
  background: #f1f5f9;
}

.next-btn {
  background: #f0fdf4;
  color: #15803d;
  border: 1px solid #bbf7d0;
}
.next-btn:hover {
  background: #dcfce7;
}

.stop-game-btn {
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
}
.stop-game-btn:hover {
  background: #fee2e2;
}

/* 联调快捷条 */
.sim-tools-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px dashed #cbd5e1;
}

.sim-label {
  font-size: 11px;
  font-weight: 700;
  color: #64748b;
}

.sim-btn {
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.15s;
}
.sim-btn.red {
  background: #fef2f2;
  color: #b91c1c;
  border-color: #fca5a5;
}
.sim-btn.red:hover { background: #fee2e2; }
.sim-btn.blue {
  background: #eff6ff;
  color: #1d4ed8;
  border-color: #93c5fd;
}
.sim-btn.blue:hover { background: #dbeafe; }
.sim-btn.gift {
  background: #fdf4ff;
  color: #c026d3;
  border-color: #f0abfc;
}
.sim-btn.gift:hover { background: #fae8ff; }
.sim-btn.gift-blue {
  background: #f0fdfa;
  color: #0d9488;
  border-color: #99f6e4;
}
.sim-btn.gift-blue:hover { background: #ccfbf1; }
.sim-btn.like {
  background: #fff1f2;
  color: #e11d48;
  border-color: #fecdd3;
}
.sim-btn.like:hover { background: #ffe4e6; }

/* 导航 Tabs */
.config-tabs-nav {
  display: flex;
  gap: 6px;
  background: #ffffff;
  padding: 4px;
  border-radius: 10px;
  border: 1px solid var(--line);
  box-shadow: var(--card-shadow);
  width: fit-content;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  border: 0;
  background: transparent;
  cursor: pointer;
  transition: all 0.15s;
}
.tab-btn:hover {
  color: var(--text-main);
  background: #f8fafc;
}
.tab-btn.active {
  background: #fff7ed;
  color: #ea580c;
  font-weight: 700;
}

.count-pill {
  min-width: 18px;
  height: 18px;
  border-radius: 9px;
  background: rgba(0, 0, 0, 0.05);
  display: grid;
  place-items: center;
  font-size: 11px;
}

/* 通用配置面板卡片 */
.config-panel-card {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid var(--line);
  box-shadow: var(--card-shadow);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 12px;
  border-bottom: 1px solid #f1f5f9;
}

.panel-kicker {
  font-size: 11px;
  font-weight: 700;
  color: #f97316;
  letter-spacing: 0.08em;
}

.panel-header h2 {
  margin: 2px 0 0;
  font-size: 16px;
  font-weight: 800;
  color: var(--text-main);
}

.panel-tag {
  font-size: 12px;
  color: var(--text-muted);
  background: #f8fafc;
  padding: 3px 10px;
  border-radius: 6px;
}

/* 题库布局 */
.bank-layout {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  border: 1px solid var(--line);
  border-radius: 10px;
  overflow: hidden;
  background: #ffffff;
}

.bank-list-sidebar {
  border-right: 1px solid var(--line);
  background: #f8fafc;
}

.bank-item-btn {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 12px 14px;
  border: none;
  border-bottom: 1px solid #eef2f6;
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;
}
.bank-item-btn:hover {
  background: #f1f5f9;
}
.bank-item-btn.selected {
  background: #fff7ed;
  border-left: 3px solid #f97316;
}
.bank-item-title {
  font-size: 13px;
  font-weight: 600;
  color: #334155;
}
.bank-item-btn.selected .bank-item-title {
  color: #c2410c;
  font-weight: 700;
}
.bank-item-count {
  font-size: 11px;
  color: #94a3b8;
  background: #ffffff;
  padding: 2px 6px;
  border-radius: 4px;
}

.bank-preview-content {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.preview-header h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 800;
}
.preview-sub {
  margin: 3px 0 0;
  font-size: 12px;
  color: var(--text-muted);
}

.question-preview-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 280px;
  overflow-y: auto;
}

.question-preview-list li {
  padding: 10px 12px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #eef2f6;
}

.q-title {
  font-size: 13px;
  display: block;
  margin-bottom: 6px;
}

.option-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}

.option-pill {
  font-size: 11px;
  padding: 4px 8px;
  background: #ffffff;
  border-radius: 4px;
  border: 1px solid #e2e8f0;
  color: #64748b;
}
.option-pill.correct {
  background: #f0fdf4;
  border-color: #86efac;
  color: #166534;
  font-weight: 700;
}

.bank-settings-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 14px;
  padding-top: 14px;
  border-top: 1px solid #f1f5f9;
}

.input-unit {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.input-unit label {
  font-size: 12px;
  font-weight: 700;
  color: #475569;
}
.input-unit input[type="number"],
.input-unit input[type="text"] {
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  font-size: 13px;
  background: #ffffff;
}
.input-unit small {
  font-size: 11px;
  color: #94a3b8;
}

.toggle-unit {
  justify-content: center;
}

.toggle-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}
.toggle-wrapper input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: #f97316;
  cursor: pointer;
}
.toggle-text {
  font-size: 13px;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
}

/* 阵营卡片 */
.factions-config-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.faction-setting-card {
  padding: 16px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.faction-setting-card.red-theme {
  background: #fff8f8;
  border-color: #fecaca;
}
.faction-setting-card.blue-theme {
  background: #f8faff;
  border-color: #bfdbfe;
}

.faction-card-title {
  display: flex;
  align-items: center;
  gap: 8px;
}
.faction-card-title h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 800;
}
.color-badge {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.color-badge.red { background: #ef4444; }
.color-badge.blue { background: #3b82f6; }

.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.form-group label {
  font-size: 12px;
  font-weight: 700;
  color: #475569;
}
.form-group input {
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  font-size: 13px;
  background: #ffffff;
}
.form-group small {
  font-size: 11px;
  color: #94a3b8;
}

.interaction-rules-box {
  padding: 16px;
  border-radius: 10px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}
.interaction-rules-box h4 {
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: 800;
}
.rule-steps-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.step-card {
  padding: 12px;
  background: #ffffff;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}
.step-num {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #f97316;
  color: #ffffff;
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 800;
  margin-bottom: 6px;
}
.step-card strong {
  display: block;
  font-size: 13px;
  margin-bottom: 4px;
}
.step-card p {
  margin: 0;
  font-size: 11px;
  color: #64748b;
  line-height: 1.5;
}
.step-card code {
  background: #f1f5f9;
  padding: 2px 4px;
  border-radius: 4px;
  color: #f97316;
  font-weight: 700;
}

/* 胜负规则 */
.rules-form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}

.rule-input-card {
  padding: 16px;
  border-radius: 10px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.card-label {
  font-size: 13px;
  font-weight: 700;
  color: #334155;
}
.rule-input-card input {
  padding: 9px 12px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  font-size: 14px;
  font-weight: 700;
  background: #ffffff;
}
.card-desc {
  margin: 0;
  font-size: 11px;
  color: #94a3b8;
  line-height: 1.5;
}

/* 点赞与礼物特权 */
.buffs-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.buff-card {
  padding: 16px;
  border-radius: 10px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.buff-title-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.buff-icon {
  font-size: 24px;
  padding: 8px;
  border-radius: 8px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
}
.buff-title-row h3 {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 800;
}
.buff-title-row p {
  margin: 0;
  font-size: 12px;
  color: #64748b;
}

/* 主题 Grid */
.themes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 14px;
}

.theme-card {
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  overflow: hidden;
  background: #ffffff;
  cursor: pointer;
  transition: all 0.2s;
}
.theme-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}
.theme-card.selected {
  border-color: #f97316;
  box-shadow: 0 0 0 2px rgba(249, 115, 22, 0.3);
}

.theme-card-thumb {
  height: 100px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 12px;
  color: #ffffff;
  position: relative;
}
.theme-card-thumb.tug {
  background: linear-gradient(135deg, #ef4444 0%, #3b82f6 100%);
}
.theme-card-thumb.mecha {
  background: linear-gradient(135deg, #0284c7 0%, #6366f1 100%);
}
.theme-card-thumb.arcade {
  background: linear-gradient(135deg, #d97706 0%, #dc2626 100%);
}
.theme-card-thumb.colosseum {
  background: linear-gradient(135deg, #7c3aed 0%, #db2777 100%);
}

.thumb-badge {
  font-size: 10px;
  font-weight: 800;
  background: rgba(0, 0, 0, 0.4);
  padding: 2px 6px;
  border-radius: 4px;
  width: fit-content;
}
.thumb-title {
  font-size: 14px;
  font-weight: 800;
}

.theme-card-body {
  padding: 12px;
}
.theme-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}
.active-badge {
  font-size: 10px;
  font-weight: 800;
  color: #ea580c;
  background: #fff7ed;
  padding: 2px 6px;
  border-radius: 4px;
}
.theme-desc {
  margin: 0;
  font-size: 11px;
  color: #64748b;
  line-height: 1.4;
}

/* 语音设置 */
.voice-settings-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.voice-toggle-card {
  padding: 16px;
  border-radius: 10px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
