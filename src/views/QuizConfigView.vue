<template>
  <section class="page">
    <header class="page-heading">
      <div>
        <button class="back" @click="$emit('back')">← 游戏列表</button>
        <span class="eyebrow">KNOWLEDGE QUIZ</span>
        <h1>知识问答</h1>
        <p>配置答题流程、互动规则与 OBS 直播主题。</p>
      </div>
      <span class="module-id">{{ quizState.running ? '运行中' : '未启动' }}</span>
    </header>

    <nav class="config-tabs" aria-label="问答配置分区">
      <button type="button" :class="{ active: activeTab === 'banks' }" @click="activeTab = 'banks'">题库 <small>{{ allBankNames.length }}</small></button>
      <button type="button" :class="{ active: activeTab === 'ai' }" @click="activeTab = 'ai'">AI 生成</button>
      <button type="button" :class="{ active: activeTab === 'rules' }" @click="activeTab = 'rules'">互动规则</button>
      <button type="button" :class="{ active: activeTab === 'theme' }" @click="activeTab = 'theme'">直播主题</button>
    </nav>

    <section v-if="activeTab === 'banks'" class="config-section">
    <section class="section">
      <div class="section-heading"><div><span class="panel-kicker">QUESTION BANK</span><h2>题库</h2></div><span>{{ allBankNames.length }} 个题库</span></div>
      <div class="bank-layout">
        <aside class="bank-list" aria-label="题库列表">
          <button v-for="name in allBankNames" :key="name" class="bank-item" :class="{ selected: config.bank === name }" @click="config.bank = name">
            <span>{{ name }}</span><small>{{ bankQuestions(name).length }} 题</small>
          </button>
        </aside>
        <div class="bank-preview">
          <div class="preview-heading"><div><h3>{{ config.bank }}</h3><span>{{ selectedQuestions.length }} 道题 · 随机抽取</span></div>
            <button v-if="config.customBanks?.[config.bank]" class="text-action" @click="deleteBank(config.bank)">删除题库</button>
          </div>
          <ol class="question-list">
            <li v-for="(question, index) in selectedQuestions.slice(0, 8)" :key="`${index}-${question.title}`">
              <strong>{{ question.title }}</strong>
              <div class="option-list"><span v-for="key in optionKeys" :key="key" :class="{ answer: question.answer === key }">{{ key }}. {{ question.options[key] }}</span></div>
            </li>
          </ol>
          <p v-if="!selectedQuestions.length" class="empty">这个题库还没有题目，请前往 AI 生成。</p>
          <div class="bank-controls">
            <label>本场抽题数 <input v-model.number="config.count" type="number" min="1" :max="Math.max(1, selectedQuestions.length)" /></label>
            <label>每题答题时间（秒） <input v-model.number="config.answerTime" type="number" min="5" max="600" /></label>
          </div>
        </div>
      </div>
    </section>
    </section>

    <section v-if="activeTab === 'theme'" class="config-section">
      <section class="section theme-section">
        <div class="section-heading"><div><span class="panel-kicker">OBS BROADCAST THEMES</span><h2>选择直播画面主题</h2></div><span>当前：{{ selectedTheme.name }}</span></div>
        <div class="theme-grid" role="radiogroup" aria-label="直播画面主题">
          <button v-for="theme in quizThemes" :key="theme.id" type="button" class="theme-option" :class="[`theme-${theme.id}`, { selected: config.theme === theme.id }]" role="radio" :aria-checked="config.theme === theme.id" @click="config.theme = theme.id">
            <span class="theme-thumb" aria-hidden="true">
              <span class="thumb-head">DOUAI · LIVE</span>
              <span class="thumb-question">{{ quizState.question.title }}</span>
              <span class="thumb-answers"><i>A · 选项一</i><i>B · 选项二</i><i>C · 选项三</i><i>D · 选项四</i></span>
              <span class="thumb-footer">回答进度　　01:25</span>
            </span>
            <span class="theme-copy"><strong>{{ theme.name }}</strong><small>{{ theme.subtitle }}</small></span>
            <span class="theme-check" aria-hidden="true">{{ config.theme === theme.id ? '已选择' : '选择主题' }}</span>
          </button>
        </div>
      </section>
    </section>

    <section v-if="activeTab === 'ai'" class="config-section">
    <section class="section">
      <div class="section-heading"><div><span class="panel-kicker">AI QUESTION GENERATOR</span><h2>AI 生成题库</h2></div></div>
      <div class="ai-fields">
        <label>兼容接口地址<input v-model.trim="aiConfig.baseUrl" placeholder="https://api.openai.com/v1" /></label>
        <label>API Key<input v-model="aiConfig.apiKey" type="password" autocomplete="off" placeholder="sk-..." /></label>
        <label>模型<input v-model.trim="aiConfig.model" placeholder="gpt-4o-mini" /></label>
      </div>
      <div class="generate-row">
        <label>题目主题<input v-model.trim="generation.theme" placeholder="例如：中国历史、天文常识" /></label>
        <label>生成数量<input v-model.number="generation.count" type="number" min="1" max="100" /></label>
        <label>难度<select v-model="generation.difficulty"><option value="easy">简单</option><option value="mixed">混合</option><option value="hard">困难</option></select></label>
        <button class="generate-btn" :disabled="generating || !generation.theme || !aiConfig.apiKey" @click="generateBank">{{ generating ? '生成中…' : '生成并预览' }}</button>
      </div>
      <div v-if="generatedQuestions.length" class="generated-preview">
        <div class="preview-heading"><div><h3>生成结果：{{ generatedName }}</h3><span>{{ generatedQuestions.length }} 道有效题目，预览后再保存</span></div><button class="save-bank-btn" @click="saveGeneratedBank">保存为题库</button></div>
        <p>{{ generatedQuestions.slice(0, 3).map(question => question.title).join(' / ') }}</p>
      </div>
      <p v-if="aiMessage" class="ai-message" :class="{ error: aiError }">{{ aiMessage }}</p>
    </section>
    </section>

    <section v-if="activeTab === 'rules'" class="config-section">
    <section class="section">
      <div class="section-heading"><div><span class="panel-kicker">INTERACTION RULES</span><h2>游戏时长与互动规则</h2></div><span>数值均可自行设置</span></div>
      <div class="duration-row">
        <label>整场游戏时长（分钟）<input v-model.number="config.gameDurationMinutes" type="number" min="0" max="1440" /></label>
        <small>填 0 表示不限制时长</small>
        <label>答案展示（秒）<input v-model.number="config.revealTime" type="number" min="1" max="120" /></label>
        <label>题间休息（秒）<input v-model.number="config.interval" type="number" min="0" max="120" /></label>
      </div>
      <h3 class="subheading">点赞助力</h3>
      <div class="rule-table">
        <div class="rule-header"><span>每题达到点赞数</span><span>触发效果</span><span>效果数量</span></div>
        <div v-for="(rule, index) in config.likeRules" :key="index" class="rule-row">
          <label><input v-model.number="rule.threshold" type="number" min="0" /><span>赞</span></label>
          <select v-model="rule.effect"><option value="eliminate">随机排除错误选项</option><option value="extend-time">延长答题时间</option><option value="none">不触发</option></select>
          <label><input v-model.number="rule.amount" type="number" min="1" /><span>{{ rule.effect === 'eliminate' ? '个选项' : '秒' }}</span></label>
        </div>
        <button class="text-action add-rule" @click="config.likeRules.push({ threshold: 1500, effect: 'extend-time', amount: 10 })">＋ 添加点赞规则</button>
      </div>
      <h3 class="subheading">礼物规则</h3>
      <div class="rule-table">
        <div class="rule-header"><span>礼物最低价值（抖币）</span><span>触发效果</span><span></span></div>
        <div v-for="(rule, index) in config.giftRules" :key="index" class="rule-row">
          <label><input v-model.number="rule.minimumCoins" type="number" min="0" /><span>抖币</span></label>
          <select v-model="rule.effect"><option value="answer">送礼者本题答对</option><option value="win">送礼者赢得本题</option><option value="none">不触发</option></select>
          <button class="text-action remove-rule" :disabled="config.giftRules.length <= 1" @click="config.giftRules.splice(index, 1)">移除</button>
        </div>
        <button class="text-action add-rule" @click="config.giftRules.push({ minimumCoins: 20, effect: 'win' })">＋ 添加礼物规则</button>
      </div>
      <div class="run-options">
        <label class="check-row"><span>自动进入下一题</span><input v-model="config.autoNext" type="checkbox" /></label>
        <label class="check-row"><span>使用项目语音播报</span><input v-model="config.voice" type="checkbox" /></label>
      </div>
    </section>
    </section>

    <footer class="action-bar">
      <p>{{ actionMessage || (quizState.running ? `${quizState.status} · ${quizState.timeLeft} 秒` : quizState.status) }}</p>
      <div class="action-buttons">
        <button class="action-btn" :disabled="configLoading || saving" @click="saveSettings">{{ saving ? '保存中…' : '保存配置' }}</button>
        <button class="action-btn start-action" :disabled="configLoading || quizState.running || !selectedQuestions.length" @click="launchGame">启动游戏</button>
        <button class="action-btn close-action" :disabled="!quizState.running" @click="closeGame">关闭游戏</button>
      </div>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { generateQuestionBank, loadConfig, saveConfig } from '@/services/configApi';
import { createQuizActions } from '@/services/quizActions';
import { quizRuntimeSettings, quizState, startQuiz, stopQuiz, type QuizConfig, type QuizQuestion } from '@/game/quiz/quizStore';
import { parseCustomQuestions, quizQuestionBanks } from '@/game/quiz/questionBanks';
import { publishQuizTheme, quizThemes } from '@/game/quiz/quizThemes';
import { defaultGiftRules, defaultLikeRules } from '@/game/quiz/quizRules';

defineEmits<{ back: [] }>();
const quizActions = createQuizActions({ loadConfig, saveConfig, startQuiz, stopQuiz });
const activeTab = ref<'banks' | 'ai' | 'rules' | 'theme'>('banks');
const config = reactive<QuizConfig>({
  theme: 'arena', bank: '基础知识题库', count: 3, answerTime: 30, revealTime: 5, interval: 3, countdown: 5,
  voice: true, autoNext: true, likes: true, gameDurationMinutes: 60,
  likeRules: defaultLikeRules.map(rule => ({ ...rule })),
  giftRules: defaultGiftRules.map(rule => ({ ...rule })), customBanks: {}, customQuestions: []
});
const aiConfig = reactive({ baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-4o-mini' });
const generation = reactive({ theme: '', count: 20, difficulty: 'mixed' });
const optionKeys = ['A', 'B', 'C', 'D'] as const;
const aiMessage = ref('');
const aiError = ref(false);
const generatedQuestions = ref<QuizQuestion[]>([]);
const generatedName = ref('');
const actionMessage = ref('');
const configLoading = ref(true);
const saving = ref(false);
const generating = ref(false);
const allBankNames = computed(() => [...Object.keys(quizQuestionBanks), ...Object.keys(config.customBanks || {})]);
const selectedQuestions = computed(() => bankQuestions(config.bank));
const selectedTheme = computed(() => quizThemes.find(theme => theme.id === config.theme) || quizThemes[0]);
watch(() => config.theme, theme => {
  quizRuntimeSettings.theme = theme;
  publishQuizTheme(theme);
}, { immediate: true });
watch(selectedQuestions, questions => { config.count = Math.min(config.count, Math.max(1, questions.length)); });
watch(() => config.bank, () => { config.count = Math.min(config.count, Math.max(1, selectedQuestions.value.length)); });

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
  aiMessage.value = `“${name}”已加入题库，点击保存配置后写入本地数据库。`;
}

async function saveSettings() {
  saving.value = true;
  try {
    const saved = await loadConfig();
    await saveConfig({ ...saved, quizConfig: { ...saved.quizConfig, ...config }, aiConfig: { ...aiConfig } });
    actionMessage.value = '游戏和 AI 配置已保存，游戏状态未改变';
  } catch (error) {
    actionMessage.value = error instanceof Error ? error.message : 'SQLite 配置保存失败';
  } finally {
    saving.value = false;
  }
}

function launchGame() {
  if (!selectedQuestions.value.length) return;
  actionMessage.value = '';
  quizActions.start(config);
  if (!quizState.running) actionMessage.value = quizState.status;
}

function closeGame() {
  quizActions.close();
  actionMessage.value = '游戏已关闭，当前配置未保存';
}
</script>

<style scoped>
.theme-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;max-width:1000px}.theme-option{display:grid;grid-template-columns:minmax(90px,132px) minmax(0,1fr);grid-template-rows:1fr auto;gap:12px;width:100%;padding:12px;border:1px solid var(--line);border-radius:6px;background:#141a17;color:var(--ink);text-align:left;transition:border-color .15s,background .15s}.theme-option:hover{border-color:rgba(137,207,189,.5)}.theme-option.selected{border-color:var(--accent);background:#1a2520;box-shadow:inset 0 0 0 1px var(--accent)}.theme-thumb{grid-row:1/3;display:flex;flex-direction:column;justify-content:space-between;aspect-ratio:9/15;min-width:0;overflow:hidden;padding:9px;border:1px solid rgba(255,255,255,.17);border-radius:3px;background:#080a10;color:#f4f4ed;font:5px/1.4 ui-monospace,monospace}.thumb-head{font-size:5px;color:#e7c532}.thumb-question{display:block;padding:7px 5px;border-left:2px solid #f0ce36;background:rgba(240,206,54,.08);font:700 9px/1.5 'Douyin Sans','Microsoft YaHei',sans-serif;overflow:hidden}.thumb-answers{display:grid;grid-template-columns:1fr 1fr;gap:3px}.thumb-answers i{padding:4px 3px;border:1px solid rgba(255,255,255,.16);border-radius:2px;font-style:normal}.thumb-footer{padding-top:5px;border-top:1px solid rgba(255,255,255,.16);font-size:5px;color:#aaa}.theme-neon .theme-thumb{justify-content:center;gap:10px;border-color:#40e8de;background:linear-gradient(145deg,#071d22,#111126 65%,#24102c)}.theme-neon .thumb-head{color:#57f2df}.theme-neon .thumb-question{text-align:center;border:1px solid #d950d0;border-radius:20px;background:rgba(217,80,208,.12);color:#fff;font-size:10px}.theme-neon .thumb-answers{grid-template-columns:1fr}.theme-neon .thumb-answers i{border-color:rgba(87,242,223,.5)}.theme-neon .thumb-footer{color:#d950d0}.theme-classroom .theme-thumb{gap:9px;padding:10px;border-color:#c9d6d1;background:#eef4f1;color:#16362f;font-family:'Douyin Sans','Microsoft YaHei',sans-serif}.theme-classroom .thumb-head{color:#15745f}.theme-classroom .thumb-question{border:0;border-bottom:2px solid #e26d54;background:transparent;color:#16362f;font-family:serif;font-size:10px}.theme-classroom .thumb-answers{grid-template-columns:1fr}.theme-classroom .thumb-answers i{border-color:#bdcec6}.theme-classroom .thumb-footer{border-color:#bdcec6;color:#536b63}.theme-copy{align-self:end;display:grid;gap:6px;min-width:0}.theme-copy strong{font-size:13px}.theme-copy small{color:var(--muted);font-size:10px;line-height:1.5}.theme-check{align-self:start;font-size:9px;color:var(--accent)}.theme-option:not(.selected) .theme-check{color:var(--faint)}
.config-tabs{display:flex;gap:3px;margin:18px 0 16px;padding:3px;border-bottom:1px solid var(--line)}.config-tabs button{display:flex;align-items:center;gap:7px;padding:9px 13px;border:0;border-bottom:2px solid transparent;color:var(--muted);background:transparent;font-size:11px}.config-tabs button.active{border-bottom-color:var(--accent);color:var(--ink)}.config-tabs small{display:grid;place-items:center;min-width:17px;height:17px;border-radius:9px;color:var(--muted);background:var(--panel-2);font-size:9px}.config-section>.section{padding:8px 0 18px;border-top:0}
.page{max-width:1260px;margin:0 auto;padding:30px clamp(20px,4vw,54px) 36px}.page-heading{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:24px}.back{display:block;border:0;background:none;color:var(--accent-2);padding:0;margin-bottom:13px;font-size:12px}.eyebrow,.panel-kicker{color:var(--accent-2);font-size:10px;font-weight:750;letter-spacing:.12em}.page h1{margin:7px 0 4px;font-size:27px}.page-heading p,.section-heading>span{margin:0;color:var(--muted);font-size:12px}.module-id{font:11px ui-monospace,monospace;color:var(--muted)}.section{padding:20px 0;border-top:1px solid var(--line)}.section-heading{display:flex;justify-content:space-between;align-items:center;margin-bottom:15px}.section-heading h2{margin:5px 0 0;font-size:17px}.bank-layout{display:grid;grid-template-columns:210px minmax(0,1fr);border:1px solid var(--line);border-radius:6px;overflow:hidden}.bank-list{border-right:1px solid var(--line);background:rgba(0,0,0,.08)}.bank-item{display:flex;justify-content:space-between;align-items:center;width:100%;padding:11px 12px;border:0;border-bottom:1px solid rgba(203,216,208,.08);color:var(--ink);background:transparent;text-align:left;font-size:12px}.bank-item.selected{box-shadow:inset 2px 0 var(--accent);background:rgba(137,207,189,.1)}.bank-item small{color:var(--muted);font-size:10px}.bank-import{display:grid;gap:8px;padding:12px}.bank-import input:not(.file-input){height:32px;padding:0 8px;border:1px solid var(--line);border-radius:4px;color:var(--ink);background:#111917;font-size:11px}.import-btn{padding:8px;border:1px solid var(--line);border-radius:4px;color:var(--accent);text-align:center;font-size:11px;cursor:pointer}.file-input{display:none}.error,.ai-message.error{color:#e5968b}.bank-preview{min-width:0;padding:14px 16px}.preview-heading{display:flex;justify-content:space-between;align-items:center;gap:10px}.preview-heading h3{margin:0 0 4px;font-size:14px}.preview-heading span{color:var(--muted);font-size:10px}.question-list{display:grid;gap:9px;max-height:230px;overflow:auto;padding:0 5px 0 25px}.question-list li{padding:0 0 8px;border-bottom:1px solid rgba(203,216,208,.08)}.question-list li>strong{font-size:11px}.option-list{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:6px}.option-list span{font-size:10px;color:var(--muted)}.option-list .answer{color:var(--accent)}.bank-controls,.duration-row{display:grid;grid-template-columns:repeat(2,minmax(130px,1fr));gap:12px;margin-top:14px}.page label{display:grid;gap:6px;color:var(--muted);font-size:11px}.page input:not([type=checkbox]),.page select{width:100%;min-width:0;height:34px;padding:0 9px;border:1px solid var(--line);border-radius:4px;outline:0;color:var(--ink);background:#111917;font-size:11px}.empty{color:var(--muted);font-size:11px}.text-action{border:0;color:var(--accent);background:none;font-size:10px}.text-action:disabled{opacity:.4}.ai-fields{display:grid;grid-template-columns:1.3fr 1.2fr .8fr;gap:12px}.generate-row{display:grid;grid-template-columns:1.4fr .55fr .7fr 126px;gap:12px;align-items:end;margin-top:12px}.generate-btn,.save-bank-btn{height:34px;padding:0 12px;border:1px solid var(--accent);border-radius:4px;color:#122019;background:var(--accent);font-size:11px;font-weight:700}.generate-btn:disabled{opacity:.5}.generated-preview{margin-top:12px;padding:11px;border-left:2px solid var(--accent);background:rgba(137,207,189,.06)}.generated-preview p,.ai-message{margin:8px 0 0;color:var(--muted);font-size:11px}.duration-row{grid-template-columns:1.15fr .7fr 1fr 1fr;align-items:end}.duration-row small{padding:0 0 9px;color:var(--muted);font-size:10px}.subheading{margin:18px 0 9px;font-size:12px}.rule-table{border:1px solid var(--line);border-radius:5px;overflow:hidden}.rule-header,.rule-row{display:grid;grid-template-columns:1fr 1.2fr .7fr;gap:12px;align-items:center;padding:8px 11px}.rule-header{background:rgba(255,255,255,.025);color:var(--muted);font-size:10px}.rule-row{border-top:1px solid rgba(203,216,208,.08)}.rule-row label{display:flex;align-items:center;gap:6px}.rule-row label span{white-space:nowrap}.add-rule{padding:9px 11px}.remove-rule{justify-self:start}.run-options{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:17px}.check-row{display:flex!important;justify-content:space-between;align-items:center;padding:10px 12px;border:1px solid var(--line);border-radius:4px;color:var(--ink)!important}.check-row input{accent-color:var(--accent)}.action-bar{display:flex;justify-content:space-between;align-items:center;gap:14px;padding-top:14px;border-top:1px solid var(--line)}.action-bar p{margin:0;color:var(--muted);font-size:11px}.action-buttons{display:flex;gap:7px}.action-btn{height:34px;padding:0 11px;border:1px solid var(--line);border-radius:4px;color:var(--ink);background:transparent;font-size:11px}.action-btn:disabled{opacity:.4}.start-action{border-color:var(--accent);color:#122019;background:var(--accent)}.close-action{border-color:rgba(205,120,105,.5);color:#e29b8d}@media(max-width:850px){.bank-layout{grid-template-columns:170px minmax(0,1fr)}.duration-row{grid-template-columns:1fr 1fr}.generate-row{grid-template-columns:1fr 1fr}.ai-fields{grid-template-columns:1fr 1fr}.ai-fields label:first-child{grid-column:1/-1}}@media(max-width:620px){.config-launchers{grid-template-columns:1fr}.bank-layout{grid-template-columns:1fr}.bank-list{display:grid;grid-template-columns:1fr 1fr;border-right:0;border-bottom:1px solid var(--line)}.bank-import{grid-column:1/-1}.ai-fields,.generate-row,.duration-row,.run-options{grid-template-columns:1fr}.rule-header,.rule-row{grid-template-columns:1fr 1fr}.rule-header span:last-child,.rule-row label:last-of-type{display:none}.action-bar{align-items:stretch;flex-direction:column}.action-buttons>*{flex:1}}
</style>
