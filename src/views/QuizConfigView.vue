<template>
  <div class="quiz-config-view">
    <!-- 顶部导航与持久化保存控制栏 (完全与游戏启动运行解耦) -->
    <header class="quiz-header">
      <div class="header-left">
        <button class="back-link-btn" type="button" @click="$emit('back')">
          <ArrowLeft :size="14" />
          <span>返回游戏中心</span>
        </button>
        <div class="header-title-box">
          <div class="tag-row">
            <span class="sub-badge">INTERACTIVE GAME MODULE</span>
            <span class="version-badge">9:16 OBS 直播采集</span>
          </div>
          <h1>知识问答 · 配置与规则</h1>
          <p>配置答题竞技流程、互动点赞与送礼规则、AI 智能生成题库及 9:16 OBS 专属画面主题。</p>
        </div>
      </div>

      <!-- 右侧配置持久化保存工具组 (与游戏启动解耦) -->
      <div class="persistence-toolbar">
        <div class="save-status-info">
          <span v-if="saveSuccess" class="status-tip success">
            <CheckCircle2 :size="13" /> 已保存至本地 SQLite 数据库
          </span>
          <span v-else-if="actionMessage" class="status-tip" :class="{ error: isSaveError }">
            {{ actionMessage }}
          </span>
          <span v-else class="status-tip">
            配置修改后点击保存写入本地数据库
          </span>
        </div>

        <button 
          class="primary-save-btn" 
          type="button" 
          :disabled="configLoading || saving"
          @click="saveSettings"
        >
          <Save :size="15" />
          <span>{{ saving ? '正在写入数据库…' : '保存配置 (SQLite)' }}</span>
        </button>
      </div>
    </header>

    <!-- 独立的生命周期与调试控制坞 (完全独立于配置持久化) -->
    <div class="runtime-control-deck" :class="{ active: quizState.running }">
      <div class="deck-meta">
        <div class="deck-title-row">
          <span class="deck-indicator-dot" :class="{ live: quizState.running }"></span>
          <strong class="deck-title">运行时控制与即时测试</strong>
          <span class="deck-badge" :class="{ live: quizState.running }">
            {{ quizState.running ? '游戏实例：正在运行中 (LIVE)' : '游戏实例：未启动 (IDLE)' }}
          </span>
        </div>
        <p class="deck-notice">
          💡 <strong>运行逻辑说明</strong>：点击「保存配置」将题目与规则持久化写入 SQLite；点击「启动游戏」直接应用当前编辑中的参数试玩对局（无需事先保存即可测试）；点击「关闭游戏」仅终止当前对局，三者职责明确、完全解耦。
        </p>

        <!-- 运行中的即时状态指标 -->
        <div v-if="quizState.running" class="deck-live-info">
          <span class="live-pill">当前：第 <b>{{ quizProgress }}</b> 题</span>
          <span class="live-pill timer">剩余 <b>{{ quizState.timeLeft }}</b> 秒</span>
          <span class="live-question-preview">{{ quizState.question?.title || quizState.status }}</span>
        </div>
      </div>

      <!-- 运行时操作按钮组 -->
      <div class="deck-actions">
        <!-- 运行中操作 -->
        <template v-if="quizState.running">
          <button 
            v-if="quizState.phase === 'waiting'" 
            class="action-btn next-btn" 
            type="button" 
            title="跳过休息直接进入下一题"
            @click="nextQuestion"
          >
            <FastForward :size="14" />
            <span>进入下一题</span>
          </button>

          <button 
            class="action-btn obs-window-btn" 
            type="button" 
            title="预览当前直播主题效果"
            @click="$emit('launch-obs')"
          >
            <Eye :size="14" />
            <span>主题预览</span>
          </button>

          <button 
            class="action-btn stop-game-btn" 
            type="button" 
            title="结束当前游戏对局，不影响已保存的配置"
            @click="closeGame"
          >
            <Square :size="14" />
            <span>关闭 / 结束游戏</span>
          </button>
        </template>

        <!-- 待机中操作 -->
        <template v-else>
          <button 
            class="action-btn launch-game-btn" 
            type="button" 
            :disabled="configLoading || !selectedQuestions.length"
            title="直接以当前界面的参数启动游戏试玩或开播"
            @click="launchGame"
          >
            <Play :size="15" fill="currentColor" />
            <span>启动游戏 (应用当前参数)</span>
          </button>

          <button 
            class="action-btn obs-window-btn" 
            type="button" 
            title="预览当前直播主题效果"
            @click="$emit('launch-obs')"
          >
            <Eye :size="15" />
            <span>主题预览</span>
          </button>
        </template>
      </div>
    </div>

    <!-- 配置分页导航 Tabs -->
    <nav class="config-tabs-nav" aria-label="知识问答配置选项卡">
      <button 
        type="button" 
        class="tab-btn" 
        :class="{ active: activeTab === 'banks' }" 
        @click="activeTab = 'banks'"
      >
        <BookOpen :size="15" />
        <span>题库管理</span>
        <span class="count-pill">{{ allBankNames.length }}</span>
      </button>

      <button 
        type="button" 
        class="tab-btn" 
        :class="{ active: activeTab === 'ai' }" 
        @click="activeTab = 'ai'"
      >
        <Bot :size="15" />
        <span>AI 智能生成</span>
      </button>

      <button 
        type="button" 
        class="tab-btn" 
        :class="{ active: activeTab === 'rules' }" 
        @click="activeTab = 'rules'"
      >
        <Sliders :size="15" />
        <span>互动与奖惩规则</span>
      </button>

      <button 
        type="button" 
        class="tab-btn" 
        :class="{ active: activeTab === 'theme' }" 
        @click="activeTab = 'theme'"
      >
        <Palette :size="15" />
        <span>直播主题</span>
      </button>
    </nav>

    <!-- ================= 1. 题库管理面板 ================= -->
    <section v-if="activeTab === 'banks'" class="config-panel-card">
      <div class="panel-header">
        <div>
          <span class="panel-kicker">QUESTION BANK REPOSITORY</span>
          <h2>题库选择与抽题设置</h2>
        </div>
        <span class="panel-tag">{{ allBankNames.length }} 个可用题库 · {{ selectedQuestions.length }} 道候选题目</span>
      </div>

      <div class="bank-layout">
        <aside class="bank-list-sidebar" aria-label="题库列表">
          <button 
            v-for="name in allBankNames" 
            :key="name" 
            class="bank-item-btn" 
            :class="{ selected: config.bank === name }" 
            @click="config.bank = name"
          >
            <span class="bank-item-title">{{ name }}</span>
            <span class="bank-item-count">{{ bankQuestions(name).length }} 题</span>
          </button>
        </aside>

        <div class="bank-preview-content">
          <div class="preview-header">
            <div>
              <h3>{{ config.bank }}</h3>
              <p class="preview-sub">共 {{ selectedQuestions.length }} 道题 · 比赛开始时将从中随机抽取</p>
            </div>
            <button 
              v-if="config.customBanks?.[config.bank]" 
              class="danger-text-btn" 
              type="button"
              @click="deleteBank(config.bank)"
            >
              <Trash2 :size="13" />
              <span>删除此自定义题库</span>
            </button>
          </div>

          <ol class="question-preview-list">
            <li v-for="(question, index) in selectedQuestions.slice(0, 8)" :key="`${index}-${question.title}`">
              <strong class="q-title">{{ index + 1 }}. {{ question.title }}</strong>
              <div class="option-grid">
                <span 
                  v-for="key in optionKeys" 
                  :key="key" 
                  class="option-pill"
                  :class="{ correct: question.answer === key }"
                >
                  <b>{{ key }}.</b> {{ question.options[key] }}
                </span>
              </div>
            </li>
          </ol>

          <p v-if="!selectedQuestions.length" class="empty-state-notice">
            当前题库暂无题目数据，请切换到「AI 智能生成」标签页生成题目或导入自定义题库。
          </p>

          <div class="bank-settings-row">
            <div class="input-unit">
              <label>本场抽题数</label>
              <input v-model.number="config.count" type="number" min="1" :max="Math.max(1, selectedQuestions.length)" />
              <small>最大支持 {{ Math.max(1, selectedQuestions.length) }} 题</small>
            </div>

            <div class="input-unit">
              <label>每题答题倒计时（秒）</label>
              <input v-model.number="config.answerTime" type="number" min="5" max="600" />
              <small>推荐 20 ~ 45 秒</small>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ================= 2. AI 智能出题面板 ================= -->
    <section v-if="activeTab === 'ai'" class="config-panel-card">
      <div class="panel-header">
        <div>
          <span class="panel-kicker">AI QUESTION GENERATOR</span>
          <h2>AI 一键生成专属题库</h2>
        </div>
        <span class="panel-tag">基于大模型兼容接口</span>
      </div>

      <div class="ai-config-grid">
        <div class="input-unit">
          <label>兼容接口 Base URL</label>
          <input v-model.trim="aiConfig.baseUrl" placeholder="https://api.openai.com/v1" />
        </div>
        <div class="input-unit">
          <label>API Key (密钥)</label>
          <input v-model="aiConfig.apiKey" type="password" autocomplete="off" placeholder="sk-..." />
        </div>
        <div class="input-unit">
          <label>模型名称 (Model)</label>
          <input v-model.trim="aiConfig.model" placeholder="gpt-4o-mini" />
        </div>
      </div>

      <div class="generate-controls-card">
        <div class="input-unit flex-grow">
          <label>题目主题与范围</label>
          <input v-model.trim="generation.theme" placeholder="例如：中国历朝古诗词、航天科技常识、二次元动漫知识" />
        </div>
        <div class="input-unit">
          <label>生成题目数量</label>
          <input v-model.number="generation.count" type="number" min="1" max="100" />
        </div>
        <div class="input-unit">
          <label>难度梯度</label>
          <select v-model="generation.difficulty">
            <option value="easy">简单 (大众娱乐)</option>
            <option value="mixed">混合 (由浅入深)</option>
            <option value="hard">困难 (硬核烧脑)</option>
          </select>
        </div>
        <button 
          class="generate-action-btn" 
          type="button"
          :disabled="generating || !generation.theme || !aiConfig.apiKey" 
          @click="generateBank"
        >
          <Sparkles :size="15" />
          <span>{{ generating ? 'AI 正在极速生成…' : '开始智能生成' }}</span>
        </button>
      </div>

      <div v-if="generatedQuestions.length" class="generated-preview-card">
        <div class="preview-header">
          <div>
            <h3>生成结果预览：{{ generatedName }}</h3>
            <span class="preview-sub">已生成 {{ generatedQuestions.length }} 道符合规范的题目，确认无误后点击保存到题库</span>
          </div>
          <button class="save-bank-btn" type="button" @click="saveGeneratedBank">
            <Plus :size="14" />
            <span>保存为新题库</span>
          </button>
        </div>
        <div class="generated-samples">
          <span v-for="(q, i) in generatedQuestions.slice(0, 4)" :key="i" class="sample-pill">
            {{ i + 1 }}. {{ q.title }}
          </span>
        </div>
      </div>

      <p v-if="aiMessage" class="ai-status-message" :class="{ error: aiError }">
        {{ aiMessage }}
      </p>
    </section>

    <!-- ================= 3. 互动与奖惩规则面板 ================= -->
    <section v-if="activeTab === 'rules'" class="config-panel-card">
      <div class="panel-header">
        <div>
          <span class="panel-kicker">INTERACTION RULES & TIMING</span>
          <h2>互动节奏与奖惩机制</h2>
        </div>
        <span class="panel-tag">弹幕抢答 · 点赞助力 · 送礼加分</span>
      </div>

      <div class="timing-settings-grid">
        <div class="input-unit">
          <label>整场比赛最大时长（分钟）</label>
          <input v-model.number="config.gameDurationMinutes" type="number" min="0" max="1440" />
          <small>填 0 表示不限制，直到题目全部答完</small>
        </div>
        <div class="input-unit">
          <label>公布答案展示时间（秒）</label>
          <input v-model.number="config.revealTime" type="number" min="1" max="120" />
          <small>公布正确选项与排名的停留时间</small>
        </div>
        <div class="input-unit">
          <label>题间休息间隔（秒）</label>
          <input v-model.number="config.interval" type="number" min="0" max="120" />
          <small>进入下一题前的转场缓冲时长</small>
        </div>
      </div>

      <div class="rule-group-box">
        <div class="rule-group-header">
          <div>
            <h3>💖 点赞助力规则</h3>
            <p>当观众在当前题目答题期间达到指定点赞数时，自动触发互动效果帮助全场作答。</p>
          </div>
          <button class="add-rule-btn" type="button" @click="config.likeRules.push({ threshold: 1500, effect: 'extend-time', amount: 10 })">
            <Plus :size="13" />
            <span>添加点赞规则</span>
          </button>
        </div>

        <div class="rule-table-wrap">
          <table class="rule-table">
            <thead>
              <tr>
                <th>每题累计点赞数</th>
                <th>触发互动效果</th>
                <th>数值增量</th>
                <th style="width: 80px;">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(rule, index) in config.likeRules" :key="index">
                <td>
                  <div class="table-input-unit">
                    <input v-model.number="rule.threshold" type="number" min="0" />
                    <span>赞</span>
                  </div>
                </td>
                <td>
                  <select v-model="rule.effect" class="table-select">
                    <option value="eliminate">随机排除一个错误选项</option>
                    <option value="extend-time">延长当前题目作答时间</option>
                    <option value="none">仅播报不触发辅助</option>
                  </select>
                </td>
                <td>
                  <div class="table-input-unit">
                    <input v-model.number="rule.amount" type="number" min="1" />
                    <span>{{ rule.effect === 'eliminate' ? '个选项' : '秒' }}</span>
                  </div>
                </td>
                <td>
                  <button 
                    class="table-remove-btn" 
                    type="button" 
                    :disabled="config.likeRules.length <= 1"
                    @click="config.likeRules.splice(index, 1)"
                  >
                    删除
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="rule-group-box">
        <div class="rule-group-header">
          <div>
            <h3>🎁 礼物特权规则</h3>
            <p>观众送出达到价值门槛的礼物时，自动赋予本题特权（大幅提升直播间打赏转化）。</p>
          </div>
          <button class="add-rule-btn" type="button" @click="config.giftRules.push({ minimumCoins: 20, effect: 'win' })">
            <Plus :size="13" />
            <span>添加礼物特权</span>
          </button>
        </div>

        <div class="rule-table-wrap">
          <table class="rule-table">
            <thead>
              <tr>
                <th>礼物最低门槛 (抖币)</th>
                <th>送礼专属特权效果</th>
                <th style="width: 80px;">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(rule, index) in config.giftRules" :key="index">
                <td>
                  <div class="table-input-unit">
                    <input v-model.number="rule.minimumCoins" type="number" min="0" />
                    <span>抖币</span>
                  </div>
                </td>
                <td>
                  <select v-model="rule.effect" class="table-select">
                    <option value="answer">送礼者本题自动答对 (免淘汰)</option>
                    <option value="win">送礼者直接赢得本题最高分</option>
                    <option value="none">仅鸣谢不触发特权</option>
                  </select>
                </td>
                <td>
                  <button 
                    class="table-remove-btn" 
                    type="button" 
                    :disabled="config.giftRules.length <= 1"
                    @click="config.giftRules.splice(index, 1)"
                  >
                    删除
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="switches-card">
        <label class="switch-item">
          <input v-model="config.autoNext" type="checkbox" />
          <div class="switch-content">
            <strong>自动进入下一题</strong>
            <small>在题目公布答案与转场倒计时结束后，无需主播手动点击即可自动切题。</small>
          </div>
        </label>

        <label class="switch-item">
          <input v-model="config.voice" type="checkbox" />
          <div class="switch-content">
            <strong>使用语音播报题目与胜负</strong>
            <small>开启后将调用本地 TTS 引擎自动朗读题目、选项、中奖名单及送礼感谢。</small>
          </div>
        </label>
      </div>
    </section>

    <!-- ================= 4. 直播主题面板 ================= -->
    <section v-if="activeTab === 'theme'" class="config-panel-card">
      <div class="panel-header">
        <div>
          <span class="panel-kicker">BROADCAST THEMES</span>
          <h2>选择直播画面主题</h2>
        </div>
        <div class="theme-header-actions">
          <span class="panel-tag">当前生效主题：{{ selectedTheme.name }}</span>
          <button
            type="button"
            class="theme-preview-trigger-btn"
            @click="$emit('launch-obs')"
          >
            <Eye :size="14" />
            <span>主题预览</span>
          </button>
        </div>
      </div>

      <div class="theme-grid" role="radiogroup" aria-label="直播画面主题">
        <div 
          v-for="theme in quizThemes" 
          :key="theme.id" 
          class="theme-card" 
          :class="[`theme-${theme.id}`, { selected: config.theme === theme.id }]" 
          role="radio" 
          :aria-checked="config.theme === theme.id" 
          tabindex="0"
          @click="config.theme = theme.id"
          @keydown.enter.prevent="config.theme = theme.id"
        >
          <div class="theme-preview-box" aria-hidden="true">
            <div class="mock-head">
              <span>{{ theme.name }}</span>
              <span class="mock-badge">{{ theme.badge }}</span>
            </div>
            <div class="mock-question">{{ quizState.question?.title || '题目预览：我国第一大淡水湖是？' }}</div>
            <div class="mock-options">
              <i>A · 洞庭湖</i>
              <i>B · 鄱阳湖</i>
              <i>C · 太湖</i>
              <i>D · 洪泽湖</i>
            </div>
            <div class="mock-foot">👑 冠亚季军领奖台 · 33人紧凑天梯榜 · 礼物特效</div>
          </div>

          <div class="theme-meta-row">
            <div>
              <strong>{{ theme.name }}</strong>
              <small>{{ theme.subtitle }}</small>
            </div>
            <div class="theme-card-actions">
              <button
                type="button"
                class="card-preview-btn"
                title="预览此主题效果"
                @click.stop="previewTheme(theme.id)"
              >
                <Eye :size="12" />
                <span>主题预览</span>
              </button>
              <span class="theme-check-pill">
                {{ config.theme === theme.id ? '✓ 正在使用' : '切换此主题' }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 底部状态提示条 (右上角单点保存，避免按钮重复) -->
    <footer class="config-footer-bar">
      <div class="footer-note">
        <Info :size="14" />
        <span>提示：修改题库、规则与主题后，请在页面右上角点击「保存配置 (SQLite)」写入本地数据库；随时可在上方运行时控制台启动即时测试。</span>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { 
  ArrowLeft, Save, Play, Square, FastForward, Eye, 
  BookOpen, Bot, Sliders, Palette, CheckCircle2, 
  Trash2, Plus, Sparkles, Info 
} from '@lucide/vue';
import { generateQuestionBank, loadConfig, saveConfig } from '@/services/configApi';
import { createQuizActions } from '@/services/quizActions';
import { 
  quizRuntimeSettings, quizState, quizProgress, 
  startQuiz, stopQuiz, nextQuestion, 
  type QuizConfig, type QuizQuestion 
} from '@/game/quiz/quizStore';
import { parseCustomQuestions, quizQuestionBanks } from '@/game/quiz/questionBanks';
import { publishQuizTheme, quizThemes, type QuizThemeId } from '@/game/quiz/quizThemes';
import { defaultGiftRules, defaultLikeRules } from '@/game/quiz/quizRules';

const emit = defineEmits<{
  back: [];
  'launch-obs': [];
}>();

function previewTheme(themeId: QuizThemeId) {
  config.theme = themeId;
  emit('launch-obs');
}

const quizActions = createQuizActions({ loadConfig, saveConfig, startQuiz, stopQuiz });
const activeTab = ref<'banks' | 'ai' | 'rules' | 'theme'>('banks');

const config = reactive<QuizConfig>({
  theme: 'arena',
  bank: '基础知识题库',
  count: 3,
  answerTime: 30,
  revealTime: 5,
  interval: 3,
  countdown: 5,
  voice: true,
  autoNext: true,
  likes: true,
  gameDurationMinutes: 60,
  likeRules: defaultLikeRules.map(rule => ({ ...rule })),
  giftRules: defaultGiftRules.map(rule => ({ ...rule })),
  customBanks: {},
  customQuestions: []
});

const aiConfig = reactive({
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini'
});

const generation = reactive({
  theme: '',
  count: 20,
  difficulty: 'mixed'
});

const optionKeys = ['A', 'B', 'C', 'D'] as const;
const aiMessage = ref('');
const aiError = ref(false);
const generatedQuestions = ref<QuizQuestion[]>([]);
const generatedName = ref('');

const actionMessage = ref('');
const isSaveError = ref(false);
const saveSuccess = ref(false);
const configLoading = ref(true);
const saving = ref(false);
const generating = ref(false);

const allBankNames = computed(() => [
  ...Object.keys(quizQuestionBanks),
  ...Object.keys(config.customBanks || {})
]);

const selectedQuestions = computed(() => bankQuestions(config.bank));
const selectedTheme = computed(() => quizThemes.find(theme => theme.id === config.theme) || quizThemes[0]);

watch(() => config.theme, theme => {
  quizRuntimeSettings.theme = theme;
  publishQuizTheme(theme);
}, { immediate: true });

watch(selectedQuestions, questions => {
  config.count = Math.min(config.count, Math.max(1, questions.length));
});

watch(() => config.bank, () => {
  config.count = Math.min(config.count, Math.max(1, selectedQuestions.value.length));
});

function bankQuestions(name: string): QuizQuestion[] {
  return config.customBanks?.[name] || (name === '自定义题库' ? config.customQuestions || [] : quizQuestionBanks[name] || []);
}

onMounted(async () => {
  try {
    const saved = await loadConfig();
    Object.assign(config, saved.quizConfig);
    Object.assign(aiConfig, saved.aiConfig);
    if (!config.likeRules?.length) config.likeRules = defaultLikeRules.map(rule => ({ ...rule }));
    if (!config.giftRules?.length) config.giftRules = defaultGiftRules.map(rule => ({ ...rule }));
    if (!config.customBanks) config.customBanks = {};
  } catch (error) {
    actionMessage.value = error instanceof Error ? error.message : 'SQLite 配置读取失败';
    isSaveError.value = true;
  } finally {
    configLoading.value = false;
  }
});

function deleteBank(name: string) {
  if (!config.customBanks) return;
  const { [name]: _removed, ...remaining } = config.customBanks;
  config.customBanks = remaining;
  config.bank = '基础知识题库';
}

async function generateBank() {
  generating.value = true;
  aiError.value = false;
  aiMessage.value = '正在请求模型生成题目…';
  try {
    const result = await generateQuestionBank({ ...generation, aiConfig });
    generatedQuestions.value = parseCustomQuestions(JSON.stringify(result));
    generatedName.value = result.category || generation.theme;
    aiMessage.value = `已生成 ${generatedQuestions.value.length} 道题，请检查预览后保存。`;
  } catch (error) {
    aiError.value = true;
    aiMessage.value = error instanceof Error ? error.message : '题库生成失败';
  } finally {
    generating.value = false;
  }
}

function saveGeneratedBank() {
  if (!generatedQuestions.value.length) return;
  const name = generatedName.value || generation.theme;
  config.customBanks = { ...config.customBanks, [name]: generatedQuestions.value };
  config.bank = name;
  aiMessage.value = `“${name}”已加入题库，点击右上角保存配置后写入本地数据库。`;
}

async function saveSettings() {
  saving.value = true;
  isSaveError.value = false;
  saveSuccess.value = false;
  try {
    const saved = await loadConfig();
    await saveConfig({
      ...saved,
      quizConfig: { ...saved.quizConfig, ...config },
      aiConfig: { ...aiConfig }
    });
    saveSuccess.value = true;
    actionMessage.value = '配置已成功写入本地 SQLite 数据库';
    setTimeout(() => {
      saveSuccess.value = false;
    }, 4000);
  } catch (error) {
    isSaveError.value = true;
    actionMessage.value = error instanceof Error ? error.message : 'SQLite 配置保存失败';
  } finally {
    saving.value = false;
  }
}

function launchGame() {
  if (!selectedQuestions.value.length) return;
  actionMessage.value = '';
  quizActions.start(config);
  if (!quizState.running) {
    actionMessage.value = quizState.status;
  }
}

function closeGame() {
  quizActions.close();
  actionMessage.value = '游戏已终止，当前配置未变动';
}
</script>

<style scoped>
.quiz-config-view {
  max-width: 1260px;
  margin: 0 auto;
  padding: 20px 24px 48px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

/* 顶部标题与保存持久化工具栏 */
.quiz-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--line);
  gap: 20px;
  flex-wrap: wrap;
}

.back-link-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 0;
  background: none;
  color: #10b981;
  padding: 0;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}
.back-link-btn:hover {
  opacity: 0.8;
}

.tag-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.sub-badge {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #059669;
}

.version-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  background: #f1f5f9;
  color: #64748b;
}

.header-title-box h1 {
  margin: 2px 0 4px;
  font-size: 24px;
  font-weight: 800;
  color: var(--text-main);
}

.header-title-box p {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
}

.persistence-toolbar {
  display: flex;
  align-items: center;
  gap: 14px;
}

.save-status-info {
  text-align: right;
}

.status-tip {
  font-size: 12px;
  color: var(--text-muted);
}
.status-tip.success {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #059669;
  font-weight: 600;
}
.status-tip.error {
  color: #dc2626;
  font-weight: 600;
}

.primary-save-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 18px;
  height: 38px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
  background: #10b981;
  color: #ffffff;
  border: none;
  box-shadow: 0 1px 3px rgba(16, 185, 129, 0.3);
  cursor: pointer;
  transition: all 0.15s;
}
.primary-save-btn:hover:not(:disabled) {
  background: #059669;
  transform: translateY(-1px);
}
.primary-save-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* 独立的运行时控制坞 (与保存解耦) */
.runtime-control-deck {
  background: #ffffff;
  border-radius: var(--radius-md);
  border: 1px solid var(--line);
  box-shadow: var(--card-shadow);
  padding: 18px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  position: relative;
  overflow: hidden;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.runtime-control-deck.active {
  background: #f0fdf4;
  border-color: #86efac;
}

.deck-meta {
  flex: 1;
  min-width: 0;
}

.deck-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.deck-indicator-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #94a3b8;
}
.deck-indicator-dot.live {
  background: #10b981;
  box-shadow: 0 0 6px rgba(16, 185, 129, 0.8);
}

.deck-title {
  font-size: 15px;
  font-weight: 800;
  color: var(--text-main);
}

.deck-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  background: #f1f5f9;
  color: #64748b;
}
.deck-badge.live {
  background: #dcfce7;
  color: #15803d;
}

.deck-notice {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: #64748b;
}

.deck-live-info {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.live-pill {
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 4px;
  background: #e2e8f0;
  color: #334155;
  font-weight: 600;
}
.live-pill.timer {
  background: #fee2e2;
  color: #b91c1c;
}

.live-question-preview {
  font-size: 13px;
  font-weight: 700;
  color: #15803d;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 380px;
}

.deck-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 38px;
  padding: 0 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
}

.launch-game-btn {
  background: #10b981;
  color: #ffffff;
  border: none;
  box-shadow: 0 1px 3px rgba(16, 185, 129, 0.3);
}
.launch-game-btn:hover:not(:disabled) {
  background: #059669;
}
.launch-game-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.obs-window-btn {
  background: #f8fafc;
  color: #334155;
  border: 1px solid #cbd5e1;
}
.obs-window-btn:hover {
  background: #f1f5f9;
  border-color: #94a3b8;
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
  background: #ecfdf5;
  color: #059669;
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
  border-radius: var(--radius-md);
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
  color: #059669;
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
  border: 0;
  border-bottom: 1px solid #e2e8f0;
  color: var(--text-main);
  background: transparent;
  text-align: left;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}
.bank-item-btn:hover {
  background: #f1f5f9;
}
.bank-item-btn.selected {
  background: #ecfdf5;
  color: #059669;
  font-weight: 700;
  box-shadow: inset 3px 0 #10b981;
}

.bank-item-count {
  font-size: 11px;
  color: var(--text-muted);
}

.bank-preview-content {
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.preview-header h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 800;
  color: var(--text-main);
}
.preview-sub {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--text-muted);
}

.danger-text-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 0;
  background: transparent;
  color: #ef4444;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.danger-text-btn:hover {
  text-decoration: underline;
}

.question-preview-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 380px;
  overflow-y: auto;
}

.question-preview-list li {
  padding: 10px 12px;
  border-radius: 8px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.q-title {
  display: block;
  font-size: 13px;
  color: var(--text-main);
  margin-bottom: 6px;
}

.option-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 6px;
}

.option-pill {
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  color: #475569;
}
.option-pill.correct {
  background: #ecfdf5;
  border-color: #a7f3d0;
  color: #065f46;
  font-weight: 700;
}

.empty-state-notice {
  margin: 0;
  padding: 24px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
  background: #f8fafc;
  border-radius: 8px;
}

.bank-settings-row {
  display: flex;
  gap: 16px;
  padding-top: 10px;
  border-top: 1px solid #f1f5f9;
}

.input-unit {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.input-unit.flex-grow {
  flex: 1;
}
.input-unit label {
  font-size: 12px;
  font-weight: 600;
  color: #334155;
}
.input-unit input, .input-unit select {
  height: 34px;
  padding: 0 10px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  font-size: 13px;
  background: #ffffff;
}
.input-unit small {
  font-size: 11px;
  color: var(--text-muted);
}

/* AI 出题 */
.ai-config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
}

.generate-controls-card {
  display: flex;
  align-items: flex-end;
  gap: 14px;
  background: #f8fafc;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  flex-wrap: wrap;
}

.generate-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 18px;
  border-radius: 6px;
  background: #10b981;
  color: #ffffff;
  border: none;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
}
.generate-action-btn:hover:not(:disabled) {
  background: #059669;
}
.generate-action-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.generated-preview-card {
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.save-bank-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 32px;
  padding: 0 12px;
  border-radius: 6px;
  background: #059669;
  color: #ffffff;
  border: none;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.generated-samples {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.sample-pill {
  font-size: 12px;
  background: #ffffff;
  padding: 4px 10px;
  border-radius: 4px;
  color: #065f46;
}

.ai-status-message {
  margin: 0;
  font-size: 13px;
  color: #059669;
}
.ai-status-message.error {
  color: #dc2626;
}

/* 互动规则 */
.timing-settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.rule-group-box {
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.rule-group-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.rule-group-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-main);
}
.rule-group-header p {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--text-muted);
}

.add-rule-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
}
.add-rule-btn:hover {
  background: #f1f5f9;
}

.rule-table-wrap {
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  overflow: hidden;
}

.rule-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.rule-table th, .rule-table td {
  padding: 8px 12px;
  text-align: left;
}

.rule-table th {
  background: #f8fafc;
  color: #475569;
  font-weight: 600;
  font-size: 12px;
  border-bottom: 1px solid #e2e8f0;
}

.rule-table td {
  border-bottom: 1px solid #f1f5f9;
}

.table-input-unit {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.table-input-unit input {
  width: 80px;
  height: 30px;
  padding: 0 8px;
  border-radius: 4px;
  border: 1px solid #cbd5e1;
}

.table-select {
  height: 30px;
  padding: 0 8px;
  border-radius: 4px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
}

.table-remove-btn {
  border: 0;
  background: transparent;
  color: #ef4444;
  font-size: 12px;
  cursor: pointer;
}
.table-remove-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.switches-card {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 14px;
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.switch-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  cursor: pointer;
}
.switch-item input {
  margin-top: 3px;
}
.switch-content strong {
  display: block;
  font-size: 13px;
  color: var(--text-main);
}
.switch-content small {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

/* 主题选择 */
.theme-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
}

.theme-card {
  display: flex;
  flex-direction: column;
  padding: 12px;
  border-radius: 10px;
  border: 2px solid #e2e8f0;
  background: #ffffff;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;
}
.theme-card:hover {
  border-color: #cbd5e1;
  transform: translateY(-2px);
}
.theme-card.selected {
  border-color: #10b981;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.15);
}

.theme-preview-box {
  height: 200px;
  border-radius: 6px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  margin-bottom: 10px;
  color: #ffffff;
  background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%);
  font-size: 11px;
}

.theme-arena .theme-preview-box {
  background: linear-gradient(180deg, #1d3c37 0%, #0c1b18 100%);
  border: 1px solid #34d399;
}
.theme-classroom .theme-preview-box {
  background-color: #f4f5ef;
  background-image:
    linear-gradient(to right, rgba(148, 163, 184, 0.25) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(148, 163, 184, 0.25) 1px, transparent 1px);
  background-size: 16px 16px;
  color: #0f172a;
  border: 1px solid #cbd5e1;
}
.theme-neon .theme-preview-box {
  background: linear-gradient(135deg, #14072b 0%, #3b0764 55%, #090418 100%);
  border: 1px solid #00f5d4;
}
.theme-arcade .theme-preview-box {
  background: linear-gradient(180deg, #1f244d 0%, #0e1024 100%);
  border: 2px solid #ffd60a;
}
.theme-scroll .theme-preview-box {
  background: linear-gradient(180deg, #5c1116 0%, #240507 100%);
  color: #fef3c7;
  border: 1px solid #e5b869;
}

.mock-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 800;
  font-size: 10px;
}
.mock-badge {
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(16, 185, 129, 0.25);
  font-size: 10px;
}
.mock-question {
  font-weight: 700;
  font-size: 12px;
  line-height: 1.3;
}
.mock-options {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 4px;
}
.mock-options i {
  font-style: normal;
  padding: 3px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.14);
}
.theme-classroom .mock-options i {
  background: #ffffff;
  border: 1px solid #cbd5e1;
}
.mock-foot {
  opacity: 0.7;
  font-size: 10px;
}

.theme-header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.theme-preview-trigger-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 8px;
  border: 1px solid #10b981;
  background: #ecfdf5;
  color: #059669;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
}
.theme-preview-trigger-btn:hover {
  background: #10b981;
  color: #ffffff;
}

.theme-meta-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.theme-meta-row strong {
  display: block;
  font-size: 13px;
  color: var(--text-main);
}
.theme-meta-row small {
  display: block;
  font-size: 11px;
  color: var(--text-muted);
}
.theme-card-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.card-preview-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  color: #334155;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.card-preview-btn:hover {
  border-color: #10b981;
  background: #ecfdf5;
  color: #059669;
}
.theme-check-pill {
  font-size: 11px;
  font-weight: 700;
  color: #10b981;
}

/* 底部操作条 */
.config-footer-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 16px;
  border-top: 1px solid var(--line);
  gap: 20px;
  flex-wrap: wrap;
}

.footer-note {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-muted);
}
</style>
