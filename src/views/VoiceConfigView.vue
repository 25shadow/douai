<template>
  <div class="voice-studio-page">
    <!-- 演播室顶部栏 -->
    <header class="studio-header">
      <div class="header-titles">
        <div class="sub-category-tag">
          <Sparkles :size="13" />
          <span>VOICE STUDIO & SYNTHESIS</span>
        </div>
        <h1>
          智能朗读工作台
          <span class="engine-badge">Browser Speech Engine</span>
        </h1>
        <p>配置直播间朗读音色、音量语速微调、动态试听与直播互动事件播报策略。</p>
      </div>

      <div class="header-actions">
        <!-- 待播队列与保存状态 -->
        <div class="status-summary">
          <span class="queue-chip">
            <span class="dot-online"></span>
            队列待播 {{ state.queueSize }} 条
          </span>
          <span class="save-status-text" aria-live="polite">
            {{ loading ? '正在加载…' : saving ? '正在保存…' : dirty ? '● 有未保存的更改' : message || '已同步至本地配置' }}
          </span>
        </div>

        <button 
          class="save-voice-btn" 
          :disabled="!loaded || loading || saving || !dirty" 
          @click="save"
        >
          <Save :size="15" />
          <span>{{ saving ? '保存中…' : '保存语音设置' }}</span>
        </button>
      </div>
    </header>

    <!-- 错误横幅提示 -->
    <div v-if="error" class="error-banner" role="alert">
      <AlertCircle :size="16" />
      <span>{{ error }}</span>
      <button v-if="!loaded" class="retry-btn" type="button" @click="load">重试连接</button>
    </div>

    <nav class="voice-tabs" aria-label="朗读设置板块">
      <button v-for="tab in tabs" :key="tab.id" type="button" :class="{ active: activeTab === tab.id }"
        :aria-current="activeTab === tab.id ? 'page' : undefined" @click="activeTab = tab.id">
        <component :is="tab.icon" :size="16" /><span>{{ tab.label }}</span><small>{{ tab.summary }}</small>
      </button>
    </nav>

    <section v-if="activeTab === 'ai'" class="interaction-panel">
      <header class="interaction-heading">
        <div><span class="section-kicker">02 / AI INTERACTION</span><h2>AI互动控制</h2>
          <p>告诉 AI 你希望它怎样参与直播，执行细节由 AI 自动判断。</p></div>
        <label class="master-switch-wrap"><span class="switch-label">允许 AI 互动</span>
          <input v-model="draft.aiInteraction.enabled" type="checkbox" role="switch" /><span class="switch-slider"></span>
        </label>
      </header>
      <div class="capability-notice"><span class="notice-icon"><Sparkles :size="17" /></span><div><strong>回复引擎已接入</strong>
        <p>AI 会读取系统设置中的模型配置，理解互动规则后自动决定是否回复、怎么回复。</p></div><span class="notice-status"><i></i>可用</span></div>
      <div class="smart-rule-card" :class="{ muted: !draft.aiInteraction.enabled }">
        <div class="smart-rule-card__head">
          <div><strong>互动规则</strong><small>先选一个方向，也可以直接改成你自己的说法</small></div>
          <span class="rule-state">{{ draft.aiInteraction.interactionRule.trim() ? '已设置' : '待填写' }}</span>
        </div>
        <div class="strategy-list" role="list" aria-label="互动策略">
          <button v-for="preset in strategyPresets" :key="preset.id" type="button" class="strategy-chip"
            :class="{ active: draft.aiInteraction.interactionRule === preset.rule }"
            :disabled="!draft.aiInteraction.enabled" @click="applyInteractionStrategy(preset.rule)">
            <b>{{ preset.label }}</b><small>{{ preset.description }}</small>
          </button>
        </div>
        <label class="rule-editor"><span>你希望 AI 怎么互动？</span>
          <textarea v-model.trim="draft.aiInteraction.interactionRule" :disabled="!draft.aiInteraction.enabled"
            maxlength="2000" rows="4"
            placeholder="例如：观众问游戏技巧时认真回答，闲聊时自然回应；重复刷屏、广告或无关内容不要回复；回答简短，不要抢主播的话。" />
        </label>
        <div class="rule-understanding"><Sparkles :size="15" /><div><b>AI 将自动判断</b><span>是否值得回复、使用什么语气、回答多长，以及何时保持安静。</span></div></div>
        <div class="channel-options">
          <span>AI 回复输出</span>
          <label><input v-model="draft.aiInteraction.output.voice" type="checkbox" />朗读</label>
          <label><input v-model="draft.aiInteraction.output.text" type="checkbox" />发文字</label>
        </div>
      </div>
      <div class="smart-context-row">
        <label class="field-control"><span>本场主题 <em>可选</em></span>
          <input v-model.trim="draft.aiInteraction.streamContext" maxlength="500" :disabled="!draft.aiInteraction.enabled"
            placeholder="例如：今晚是王者荣耀排位直播" />
        </label>
        <div class="context-hint">让 AI 结合当前直播内容回答，不需要填写技术指令。</div>
      </div>
      <details class="ai-advanced-settings">
        <summary><span class="summary-leading"><ShieldCheck :size="15" /><span><b>安全保护与异常兜底</b><small>系统自动拦截广告、链接和敏感内容</small></span></span><ChevronDown :size="17" class="summary-chevron" /></summary>
        <div class="interaction-grid">
          <label class="field-control"><span>链接消息</span><select v-model="draft.aiInteraction.blockLinks">
            <option :value="true">直接拦截</option><option :value="false">允许交给 AI</option>
          </select></label>
          <label class="field-control"><span>广告特征</span><select v-model="draft.aiInteraction.blockAds">
            <option :value="true">直接拦截</option><option :value="false">允许交给 AI</option>
          </select></label>
          <label class="field-control keyword-field"><span>禁用词（逗号分隔）</span>
            <input :value="draft.aiInteraction.blockedKeywords.join(', ')" placeholder="例如：政治, 投资推荐"
              @change="draft.aiInteraction.blockedKeywords = parseKeywords(($event.target as HTMLInputElement).value)" /></label>
          <label class="field-control keyword-field"><span>AI 失败时的兜底话术</span>
            <input v-model.trim="draft.aiInteraction.fallbackText" maxlength="200" /></label>
        </div>
      </details>
      <div class="guardrail-row"><strong>系统会自动处理</strong><span>重复内容</span><span>广告与链接</span><span>敏感内容</span><span>回复节奏</span></div>
    </section>

    <!-- 工作区按控制任务分段，长选项只在对应板块展开 -->
    <fieldset class="workbench-grid" :class="{ 'voice-layout': activeTab === 'voice' }" :disabled="loading || !loaded || saving">
      
      <!-- 1. 左侧：音色库组件 -->
      <div v-if="activeTab === 'voice'" class="catalog-column">
        <VoiceCatalog 
          v-model:search="search" 
          v-model:language="language" 
          v-model:favorites-only="favoritesOnly" 
          :voices="voices" 
          :filtered-voices="filteredVoices" 
          :languages="languages" 
          :draft="draft" 
          :supported="supported" 
          @refresh="refresh" 
          @select="selectVoice" 
          @favorite="favorite" 
        />
      </div>

      <!-- 2. 右侧：调谐工作台、试听台与场景触发 -->
      <div v-if="activeTab !== 'ai'" class="editor-column">
        
        <!-- 选定音色横幅与参数微调 -->
        <section v-if="activeTab === 'voice'" class="tuning-card">
          <div class="voice-hero-banner">
            <div class="voice-hero-left">
              <div class="hero-avatar">
                <Volume2 :size="24" />
              </div>
              <div class="hero-meta">
                <span class="hero-tag">CURRENT ACTIVE VOICE</span>
                <h2>{{ selectedName }}</h2>
                <div class="hero-details">
                  <span class="detail-pill">{{ draft.lang || '通用语言' }}</span>
                  <span class="detail-pill">{{ draft.voiceURI ? '指定音色' : '系统自动匹配' }}</span>
                </div>
              </div>
            </div>

            <!-- 主开关 -->
            <label class="master-switch-wrap">
              <span class="switch-label">项目全局语音播报</span>
              <input v-model="draft.enabled" type="checkbox" role="switch" />
              <span class="switch-slider"></span>
            </label>
          </div>

          <!-- 警示信息 -->
          <div v-if="selection.warning" class="warning-callout">
            <AlertCircle :size="15" />
            <span>{{ selection.warning }}</span>
          </div>

          <!-- 声音风格快捷预设 -->
          <div class="presets-row">
            <span class="section-label">声音风格预设：</span>
            <div class="preset-buttons">
              <button 
                v-for="preset in presets" 
                :key="preset.id" 
                type="button"
                class="preset-btn"
                :class="{ active: matchesPreset(preset.id) }" 
                @click="draft = applyVoicePreset(draft, preset.id)"
              >
                {{ preset.name }}
              </button>
            </div>
          </div>

          <!-- 三大声音参数滑块 (音量、语速、音高) -->
          <div class="sliders-grid">
            <div v-for="param in parameters" :key="param.key" class="slider-box">
              <div class="slider-top">
                <label :for="`voice-${param.key}`">{{ param.label }}</label>
                <div class="slider-val-box">
                  <input 
                    :id="`voice-num-${param.key}`"
                    v-model.number="draft[param.key]" 
                    type="number" 
                    :min="param.min" 
                    :max="param.max" 
                    :step="param.step" 
                  />
                  <span>{{ param.unit }}</span>
                </div>
              </div>
              <input 
                :id="`voice-${param.key}`" 
                v-model.number="draft[param.key]" 
                type="range" 
                :min="param.min" 
                :max="param.max" 
                :step="param.step" 
                class="modern-range-slider"
              />
              <div class="slider-scale">
                <span>{{ param.min }}{{ param.unit }}</span>
                <span>{{ param.max }}{{ param.unit }}</span>
              </div>
            </div>
          </div>

          <!-- 全局前缀与语言设置 -->
          <div class="prefix-inputs-row">
            <div class="input-item">
              <label>播报语言标准代码</label>
              <input v-model.trim="draft.lang" maxlength="50" placeholder="如 zh-CN" />
            </div>
            <div class="input-item">
              <label>全局播报前缀（可选）</label>
              <input v-model="draft.prefix" maxlength="100" placeholder="如 【DouAi提醒】" />
            </div>
          </div>
        </section>

        <!-- 实时试听演练台 -->
        <section v-if="activeTab === 'voice'" class="testing-studio-card">
          <div class="testing-top">
            <div class="testing-title">
              <Headphones :size="16" class="test-icon" />
              <h3>声音实时试听台</h3>
            </div>
            <select v-model="sample" class="sample-select" @change="text = samples[sample]">
              <option value="general">通用样例：欢迎来到直播间</option>
              <option value="gift">礼物样例：感谢送出爱心礼物</option>
              <option value="follow">关注样例：感谢新粉丝关注</option>
            </select>
          </div>

          <textarea 
            v-model="text" 
            class="sample-textarea" 
            maxlength="1000" 
            placeholder="输入想要试听的内容，点击下方播放按钮即可立即调用当前参数发声…"
          />

          <div class="testing-transport-footer">
            <div class="transport-controls">
              <!-- 播放 -->
              <button 
                class="play-main-btn" 
                :disabled="!supported || !text.trim()" 
                title="播放当前试听文本" 
                type="button"
                @click="preview"
              >
                <Play :size="16" fill="currentColor" />
                <span>试听声音</span>
              </button>

              <!-- 暂停 / 继续 -->
              <button 
                class="ctrl-icon-btn" 
                :disabled="!playing" 
                :title="state.status === 'paused' ? '继续播放' : '暂停播放'" 
                type="button"
                @click="state.status === 'paused' ? resume() : pause()"
              >
                <Play v-if="state.status === 'paused'" :size="14" />
                <Pause v-else :size="14" />
              </button>

              <!-- 停止 -->
              <button 
                class="ctrl-icon-btn" 
                :disabled="!playing" 
                title="停止播放" 
                type="button"
                @click="stop"
              >
                <Square :size="14" />
              </button>

              <!-- 播放动态状态条与音波动画 -->
              <div class="status-indicator-wrap">
                <div v-if="playing" class="equalizer-bars">
                  <span></span><span></span><span></span><span></span>
                </div>
                <span class="playback-badge" :class="{ active: playing }">
                  {{ statusLabel }}
                </span>
              </div>
            </div>

            <span class="char-counter">{{ [...text].length }} / 1000 字符</span>
          </div>

          <p v-if="state.currentText" class="current-speech-hint">
            正在朗读：{{ state.currentText }}
          </p>
        </section>

        <!-- 场景化事件播报设置组件 -->
        <template v-if="activeTab === 'danmaku'">
          <div class="interaction-panel">
            <header class="interaction-heading">
              <div><span class="section-kicker">01 / LIVE CHAT</span><h2>弹幕朗读控制</h2>
                <p>直播间消息统一进入语音队列，AI 互动与礼物播报会自动协调。</p></div>
              <span class="base-voice-status"><i></i>基础朗读已启用</span>
            </header>
            <div class="routing-overview">
              <article><MessageCircle :size="17" /><div><strong>观众弹幕</strong><small>按朗读范围加入队列</small></div><span>朗读</span></article>
              <article><Bot :size="17" /><div><strong>AI 互动</strong><small>命中规则后生成回应</small></div><span>协同</span></article>
              <article><Sparkles :size="17" /><div><strong>直播事件</strong><small>礼物、关注、点赞等</small></div><span>播报</span></article>
            </div>
            <div class="chat-rule-card">
              <div class="chat-rule-heading"><div><strong>朗读范围</strong><small>决定哪些普通弹幕可以进入语音队列</small></div><span>系统自动去重与控速</span></div>
              <div class="chat-rule-options" role="radiogroup" aria-label="朗读范围">
                <label :class="{ active: draft.chat.triggerMode === 'all' }"><input v-model="draft.chat.triggerMode" type="radio" value="all" />普通弹幕</label>
                <label :class="{ active: draft.chat.triggerMode === 'keyword' }"><input v-model="draft.chat.triggerMode" type="radio" value="keyword" />指定关键词</label>
              </div>
              <div class="channel-options">
                <span>输出方式</span>
                <label><input v-model="draft.chat.output.voice" type="checkbox" />朗读</label>
                <label><input v-model="draft.chat.output.text" type="checkbox" />发文字</label>
              </div>
              <label v-if="draft.chat.triggerMode === 'keyword'" class="field-control keyword-field"><span>关键词（逗号分隔）</span>
                <input :value="draft.chat.keywords.join(', ')" placeholder="例如：怎么参加, 规则是什么"
                  @change="draft.chat.keywords = parseKeywords(($event.target as HTMLInputElement).value)" /></label>
              <p class="chat-rule-note">主播自己发送的内容不重复朗读；AI 已回应的弹幕会自动避免二次播报。</p>
            </div>
          </div>
          <VoiceSceneSettings v-model="draft" />
        </template>
        
      </div>
    </fieldset>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { 
  Sparkles, Save, AlertCircle, Volume2, Headphones, Play, Pause, Square,
  MessageCircle, Bot, AudioLines, ChevronDown, ShieldCheck
} from '@lucide/vue';
import VoiceCatalog from '../components/voice/VoiceCatalog.vue';
import VoiceSceneSettings from '../components/voice/VoiceSceneSettings.vue';
import { useVoiceWorkbench } from '../voice/useVoiceWorkbench';
import { applyVoicePreset, createDefaultVoiceConfig } from '../voice/voiceConfig';

const { 
  draft, dirty, loading, saving, loaded, error, message, load, save, voices, state, 
  search, language, favoritesOnly, text, languages, filteredVoices, selection, 
  selectedName, selectVoice, favorite, refresh, preview, supported, pause, resume, stop 
} = useVoiceWorkbench();
const activeTab = ref<'danmaku' | 'ai' | 'voice'>('danmaku');
const tabs = [
  { id: 'danmaku' as const, label: '弹幕朗读控制', summary: '消息与播报', icon: MessageCircle },
  { id: 'ai' as const, label: 'AI互动控制', summary: '理解与回应', icon: Bot },
  { id: 'voice' as const, label: '朗读音色选择', summary: '音色与试听', icon: AudioLines }
];
const strategyPresets = [
  {
    id: 'natural',
    label: '自然陪聊',
    description: '像主播一样自然回应',
    rule: '只回答和当前直播有关的问题；闲聊时自然回应，遇到重复刷屏、广告或无意义内容时保持安静；回答简短，不要抢主播的话。'
  },
  {
    id: 'qa',
    label: '认真答疑',
    description: '优先解决观众问题',
    rule: '优先回答观众关于当前直播内容的具体问题；无法确认时坦诚说明，不要编造；不相关、重复或广告内容不要回复。'
  },
  {
    id: 'lively',
    label: '热场互动',
    description: '保持轻松和现场感',
    rule: '用轻松有现场感的方式回应观众，适度接话和活跃气氛；不要连续刷屏，不要索要礼物，遇到无关或敏感内容保持安静。'
  }
] as const;
function applyInteractionStrategy(rule: string) {
  draft.value.aiInteraction.interactionRule = rule;
  draft.value.aiInteraction.triggerMode = 'smart';
}
function parseKeywords(value: string) {
  return [...new Set(value.split(/[,，\n]/).map(item => item.trim()).filter(Boolean))].slice(0, 20);
}

const parameters = [
  { key: 'volume', label: '音量调节', min: 0, max: 1, step: 0.05, unit: '' },
  { key: 'rate', label: '语速倍率', min: 0.5, max: 2, step: 0.05, unit: 'x' },
  { key: 'pitch', label: '音高音调', min: 0, max: 2, step: 0.05, unit: '' }
] as const;

const presets = [
  { id: 'natural', name: '自然亲和' },
  { id: 'live', name: '直播激动' },
  { id: 'quick', name: '快速提醒' }
] as const;

function matchesPreset(id: 'natural' | 'live' | 'quick') {
  const value = applyVoicePreset(createDefaultVoiceConfig(), id);
  return parameters.every(p => draft.value[p.key] === value[p.key]);
}

const samples = {
  general: '欢迎来到直播间，动动发财的小手点点赞，点个关注不迷路！',
  gift: '感谢榜一大哥送出的浪漫热气球礼物，祝老板财源滚滚！',
  follow: '感谢新朋友关注主播，快快加入粉丝团解锁更多特权！'
};

const sample = ref<keyof typeof samples>('general');
const playing = computed(() => ['starting', 'speaking', 'paused'].includes(state.value.status));
const statusLabel = computed(() => ({
  idle: '待机中',
  starting: '正在启动语音…',
  speaking: '正在朗读中',
  paused: '已暂停',
  unsupported: '引擎不可用',
  error: '播报失败'
})[state.value.status]);
</script>

<style scoped>
.voice-studio-page {
  padding: 18px 24px 36px;
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

/* 顶部栏 */
.studio-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--line);
  flex-wrap: wrap;
  gap: 16px;
}

.sub-category-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: #0b8f69;
}

.header-titles h1 {
  margin: 4px 0 2px;
  font-size: 24px;
  font-weight: 800;
  color: var(--text-main);
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.engine-badge {
  font-size: 10px;
  font-family: ui-monospace, monospace;
  padding: 2px 8px;
  border-radius: 4px;
  background: #e7f5ef;
  border: 1px solid #b8e3d0;
  color: #065f46;
}

.header-titles p {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.status-summary {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
}

.queue-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 20px;
  background: #f1f5f9;
  color: #475569;
}

.dot-online {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #0b8f69;
}

.save-status-text {
  font-size: 11px;
  color: var(--text-muted);
}

.save-voice-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 20px;
  border-radius: 8px;
  background: #0b8f69;
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(11, 143, 105, 0.25);
  transition: all 0.15s;
}

.save-voice-btn:hover:not(:disabled) {
  background: #087a5a;
}
.save-voice-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 8px;
  background: #fef2f2;
  border: 1px solid #fca5a5;
  color: #991b1b;
  font-size: 12px;
}

.retry-btn {
  margin-left: auto;
  font-size: 12px;
  color: #ef4444;
  font-weight: 600;
  text-decoration: underline;
}

/* 演播室工作区 */
.workbench-grid {
  display: grid;
  grid-template-columns: 310px minmax(0, 1fr);
  gap: 18px;
  border: 0;
  padding: 0;
  margin: 0;
}

.catalog-column {
  min-height: 0;
}

.editor-column {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

/* 选定音色与参数调谐卡片 */
.tuning-card {
  background: #ffffff;
  border-radius: var(--radius-md);
  border: 1px solid var(--line);
  box-shadow: var(--card-shadow);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.voice-hero-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 16px;
  border-bottom: 1px solid #f1f5f9;
  flex-wrap: wrap;
  gap: 12px;
}

.voice-hero-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.hero-avatar {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, #0b8f69 0%, #087a5a 100%);
  color: #ffffff;
  display: grid;
  place-items: center;
  box-shadow: 0 4px 12px rgba(11, 143, 105, 0.25);
  flex-shrink: 0;
}

.hero-meta {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.hero-tag {
  font-size: 10px;
  font-weight: 700;
  color: #0b8f69;
  letter-spacing: 0.1em;
  font-family: ui-monospace, monospace;
}

.hero-meta h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-main);
}

.hero-details {
  display: flex;
  gap: 6px;
}

.detail-pill {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background: #f1f5f9;
  color: #475569;
}

/* 主开关控件 */
.master-switch-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  position: relative;
}

.switch-label {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
}

.master-switch-wrap input {
  opacity: 0;
  width: 0;
  height: 0;
}

.master-switch-wrap .switch-slider {
  width: 42px;
  height: 22px;
  background-color: #cbd5e1;
  border-radius: 22px;
  position: relative;
  transition: 0.2s;
}

.master-switch-wrap .switch-slider:before {
  content: "";
  position: absolute;
  width: 18px;
  height: 18px;
  left: 2px;
  bottom: 2px;
  background: white;
  border-radius: 50%;
  transition: 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.master-switch-wrap input:checked + .switch-slider {
  background-color: #0b8f69;
}

.master-switch-wrap input:checked + .switch-slider:before {
  transform: translateX(20px);
}

.warning-callout {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 8px;
  background: #fffbeb;
  border: 1px solid #fde68a;
  color: #92400e;
  font-size: 12px;
}

.presets-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.section-label {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
}

.preset-buttons {
  display: flex;
  gap: 6px;
}

.preset-btn {
  padding: 5px 14px;
  border-radius: 20px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  color: #475569;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.15s;
}

.preset-btn:hover {
  background: #ffffff;
  border-color: #cbd5e1;
}

.preset-btn.active {
  background: #e7f5ef;
  border-color: #0b8f69;
  color: #065f46;
  font-weight: 700;
}

.sliders-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
}

.slider-box {
  background: #f8fafc;
  border: 1px solid #f1f5f9;
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.slider-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.slider-top label {
  font-size: 12px;
  font-weight: 600;
  color: #334155;
}

.slider-val-box {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 12px;
  font-weight: 700;
  font-family: ui-monospace, monospace;
}

.slider-val-box input {
  width: 52px;
  padding: 3px 4px;
  border-radius: 4px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  font-size: 11px;
  text-align: center;
  color: var(--text-main);
  outline: none;
}
.slider-val-box input:focus {
  border-color: #0b8f69;
}

.modern-range-slider {
  width: 100%;
  accent-color: #0b8f69;
  cursor: pointer;
}

.slider-scale {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--text-faint);
  font-family: ui-monospace, monospace;
}

.prefix-inputs-row {
  display: grid;
  grid-template-columns: 180px 1fr;
  gap: 14px;
}

.input-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.input-item label {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
}

.input-item input {
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  font-size: 12px;
  outline: none;
  color: var(--text-main);
}
.input-item input:focus {
  border-color: #0b8f69;
  background: #ffffff;
}

/* 试听演练台 */
.testing-studio-card {
  background: #ffffff;
  border-radius: var(--radius-md);
  border: 1px solid var(--line);
  box-shadow: var(--card-shadow);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.testing-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.testing-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.test-icon {
  color: #0b8f69;
}

.testing-title h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-main);
}

.sample-select {
  padding: 5px 10px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  font-size: 12px;
  color: #475569;
  outline: none;
}

.sample-textarea {
  width: 100%;
  min-height: 72px;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-main);
  outline: none;
  resize: vertical;
}
.sample-textarea:focus {
  border-color: #0b8f69;
  background: #ffffff;
}

.testing-transport-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 6px;
}

.transport-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.play-main-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 16px;
  border-radius: 6px;
  background: #0b8f69;
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
  transition: all 0.15s;
}
.play-main-btn:hover:not(:disabled) {
  background: #087a5a;
}
.play-main-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ctrl-icon-btn {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  display: grid;
  place-items: center;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #475569;
  transition: all 0.15s;
}
.ctrl-icon-btn:hover:not(:disabled) {
  background: #f8fafc;
  border-color: #94a3b8;
}
.ctrl-icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.status-indicator-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 6px;
}

.equalizer-bars {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 14px;
}
.equalizer-bars span {
  width: 3px;
  background: #0b8f69;
  border-radius: 2px;
  animation: barBounce 0.8s infinite ease-in-out;
}
.equalizer-bars span:nth-child(1) { height: 60%; animation-delay: 0.1s; }
.equalizer-bars span:nth-child(2) { height: 100%; animation-delay: 0.3s; }
.equalizer-bars span:nth-child(3) { height: 40%; animation-delay: 0.2s; }
.equalizer-bars span:nth-child(4) { height: 80%; animation-delay: 0.4s; }

@keyframes barBounce {
  0%, 100% { transform: scaleY(0.4); }
  50% { transform: scaleY(1); }
}

.playback-badge {
  font-size: 11px;
  color: #64748b;
  font-weight: 500;
}
.playback-badge.active {
  color: #0b8f69;
  font-weight: 700;
}

.char-counter {
  font-size: 11px;
  color: var(--text-faint);
  font-family: ui-monospace, monospace;
}

.current-speech-hint {
  margin: 4px 0 0;
  font-size: 12px;
  color: #087a5a;
  background: #e7f5ef;
  padding: 6px 10px;
  border-radius: 6px;
}

.voice-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-bottom: 1px solid var(--line-strong);
}

.voice-tabs button {
  min-width: 0;
  min-height: 58px;
  display: grid;
  grid-template-columns: 18px auto;
  grid-template-rows: 1fr 1fr;
  align-content: center;
  align-items: center;
  justify-content: center;
  column-gap: 8px;
  border-bottom: 2px solid transparent;
  color: var(--text-muted);
}

.voice-tabs button.active {
  color: #087f68;
  border-bottom-color: #0b8f69;
  background: rgba(11, 143, 105, 0.045);
}

.voice-tabs button > svg { grid-row: 1 / 3; }
.voice-tabs button span { font-size: 13px; font-weight: 700; }
.voice-tabs button small { font-size: 10px; color: var(--text-faint); }

.interaction-panel {
  padding: 22px;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  box-shadow: var(--card-shadow);
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.interaction-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--line);
}

.section-kicker { color: #087f68; font-size: 10px; font-weight: 700; }
.interaction-heading h2 { margin: 4px 0; font-size: 19px; }
.interaction-heading p, .capability-notice p { margin: 0; color: var(--text-muted); font-size: 12px; line-height: 1.6; }

.chat-policy-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-radius: 6px;
}

.chat-policy-row div { display: flex; flex-direction: column; gap: 4px; }
.chat-policy-row strong, .control-copy strong { font-size: 13px; }
.chat-policy-row small, .control-copy small { color: var(--text-muted); font-size: 11px; }
.base-voice-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 9px;
  border: 1px solid #b8e3d0;
  border-radius: 999px;
  background: #f0fdf4;
  color: #15803d;
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
}
.base-voice-status i { width: 6px; height: 6px; border-radius: 50%; background: #22c55e; }
.routing-overview {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.routing-overview article {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 11px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: #fff;
}
.routing-overview article > svg { color: #0b8f69; }
.routing-overview article div { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.routing-overview strong { font-size: 12px; }
.routing-overview small { color: var(--text-muted); font-size: 10px; white-space: nowrap; }
.routing-overview article > span { color: #087f68; font-size: 10px; font-weight: 700; }
.chat-rule-card {
  padding: 15px;
  border: 1px solid #dbe7e3;
  border-radius: 8px;
  background: #fbfefd;
}
.chat-rule-heading {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 12px;
}
.chat-rule-heading div { display: flex; flex-direction: column; gap: 4px; }
.chat-rule-heading strong { font-size: 13px; }
.chat-rule-heading small, .chat-rule-heading > span { color: var(--text-muted); font-size: 11px; }
.chat-rule-options { display: flex; gap: 8px; margin: 13px 0 11px; }
.chat-rule-options label {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 11px;
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  background: #fff;
  color: #475569;
  cursor: pointer;
  font-size: 11px;
}
.chat-rule-options label.active { border-color: #0b8f69; background: #e7f5ef; color: #087f68; }
.chat-rule-options input { accent-color: #0b8f69; }
.chat-rule-note { margin: 10px 0 0; color: var(--text-muted); font-size: 11px; line-height: 1.55; }
.channel-options { display: flex; align-items: center; gap: 10px; margin-top: 12px; color: var(--text-muted); font-size: 11px; }
.channel-options label { display: inline-flex; align-items: center; gap: 5px; color: #475569; }
.channel-options input { accent-color: #0b8f69; }

.interaction-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  transition: opacity .15s;
}
.interaction-grid.muted { opacity: .48; }
.smart-rule-card {
  border: 1px solid #cfe8df;
  border-radius: 8px;
  background: #fbfffd;
  padding: 16px;
}
.smart-rule-card.muted { opacity: .52; }
.smart-rule-card__head {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 12px;
}
.smart-rule-card__head > div { display: flex; flex-direction: column; gap: 4px; }
.smart-rule-card__head strong { font-size: 14px; }
.smart-rule-card__head small { color: var(--text-muted); font-size: 11px; }
.rule-state {
  padding: 4px 8px;
  border-radius: 999px;
  background: #dcfce7;
  color: #15803d;
  font-size: 10px;
  font-weight: 700;
}
.strategy-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin: 14px 0;
}
.strategy-chip {
  display: flex;
  flex-direction: column;
  align-items: start;
  gap: 4px;
  min-height: 58px;
  padding: 10px;
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  background: #fff;
  text-align: left;
  transition: border-color .15s ease, background .15s ease, transform .15s ease;
}
.strategy-chip:hover:not(:disabled) { border-color: #6ee7b7; transform: translateY(-1px); }
.strategy-chip.active { border-color: #0b8f69; background: #e7f5ef; }
.strategy-chip b { color: var(--text-main); font-size: 12px; }
.strategy-chip small { color: var(--text-muted); font-size: 10px; }
.strategy-chip:disabled { cursor: not-allowed; }
.rule-editor { display: flex; flex-direction: column; gap: 7px; }
.rule-editor > span { color: #475569; font-size: 11px; font-weight: 650; }
.rule-editor textarea { min-height: 92px; }
.rule-understanding {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 10px;
  padding: 9px 10px;
  border-radius: 6px;
  background: #f0fdf4;
  color: #166534;
}
.rule-understanding svg { flex: none; margin-top: 1px; }
.rule-understanding div { display: flex; flex-direction: column; gap: 3px; }
.rule-understanding b { font-size: 11px; }
.rule-understanding span { font-size: 11px; line-height: 1.5; }
.smart-context-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(220px, .7fr);
  align-items: end;
  gap: 16px;
}
.field-control em { margin-left: 4px; color: var(--text-faint); font-size: 10px; font-style: normal; font-weight: 400; }
.context-hint { padding-bottom: 9px; color: var(--text-muted); font-size: 11px; line-height: 1.6; }
.field-control { min-width: 0; display: flex; flex-direction: column; gap: 7px; }
.field-control > span { color: #475569; font-size: 11px; font-weight: 650; }
.field-control select, .field-control input {
  width: 100%;
  min-height: 36px;
  padding: 7px 10px;
  border: 1px solid var(--line-strong);
  border-radius: 5px;
  background: #fff;
  color: var(--text-main);
  font-size: 12px;
}
.field-control select:disabled, .field-control input:disabled,
.field-control textarea:disabled {
  cursor: not-allowed;
  background: #f8fafc;
  color: #94a3b8;
  border-color: #e2e8f0;
}
.field-control select:focus-visible, .field-control input:focus-visible,
.field-control textarea:focus-visible {
  outline: 2px solid rgba(11, 143, 105, .28);
  outline-offset: 1px;
  border-color: #0b8f69;
}
.field-control textarea {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--line-strong);
  border-radius: 5px;
  background: #fff;
  color: var(--text-main);
  font-size: 12px;
  line-height: 1.6;
  resize: vertical;
}
.keyword-field { grid-column: 1 / -1; }
.keyword-field > span { margin-bottom: 0; }
.keyword-field input { background: var(--bg-input); }

.capability-notice {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto;
  align-items: start;
  gap: 10px;
  padding: 13px 14px;
  border-left: 3px solid #d97706;
  background: #fffbeb;
  color: #92400e;
}
.notice-icon {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 7px;
  background: #fef3c7;
  color: #b45309;
}
.capability-notice strong { font-size: 12px; }
.capability-notice p { margin-top: 4px; color: #78551b; }
.notice-status { align-self: start; display: inline-flex; align-items: center; gap: 5px; padding: 5px 8px; border-radius: 4px; background: #fef3c7; color: #92400e; font-size: 10px; font-weight: 700; }
.notice-status i { width: 5px; height: 5px; border-radius: 50%; background: #d97706; }

.guardrail-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.guardrail-row strong { margin-right: 4px; font-size: 11px; }
.guardrail-row span { padding: 5px 8px; background: #f1f5f9; border-radius: 4px; color: #475569; font-size: 10px; }

.ai-advanced-settings {
  border-top: 1px solid var(--line);
  padding-top: 2px;
}
.ai-advanced-settings > summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 54px;
  padding: 10px 8px;
  margin: 0 -8px;
  border-radius: 7px;
  cursor: pointer;
  color: var(--text-main);
  font-size: 12px;
  font-weight: 700;
  list-style: none;
  transition: background .15s ease, color .15s ease;
}
.ai-advanced-settings > summary::-webkit-details-marker { display: none; }
.ai-advanced-settings > summary:hover,
.ai-advanced-settings[open] > summary { background: #f8fafc; color: #087f68; }
.summary-leading { display: inline-flex; align-items: center; gap: 10px; }
.summary-leading > svg { color: #0b8f69; }
.summary-leading > span { display: flex; flex-direction: column; gap: 3px; }
.ai-advanced-settings > summary small { color: var(--text-muted); font-size: 11px; font-weight: 400; }
.summary-chevron { color: #94a3b8; transition: transform .2s ease; }
.ai-advanced-settings[open] .summary-chevron { transform: rotate(180deg); color: #0b8f69; }
.ai-advanced-settings[open] .interaction-grid { padding: 4px 0 12px; animation: disclosureIn .18s ease-out; }
@keyframes disclosureIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }

.voice-panel { display: contents; }
.workbench-grid { grid-template-columns: minmax(0, 1fr); }
.workbench-grid.voice-layout { grid-template-columns: 310px minmax(0, 1fr); }
.editor-column:has(.tuning-card) { grid-column: 2; }
.catalog-column:has(.voice-catalog-card) { grid-column: 1; }
.catalog-column { min-height: 420px; }

@media (max-width: 960px) {
  .voice-tabs button { grid-template-columns: 16px auto; column-gap: 5px; }
  .voice-tabs button span { font-size: 11px; }
  .voice-tabs button small { display: none; }
  .interaction-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .routing-overview { grid-template-columns: 1fr; }
  .strategy-list { grid-template-columns: 1fr; }
  .smart-context-row { grid-template-columns: 1fr; gap: 8px; }
  .context-hint { padding-bottom: 0; }
  .workbench-grid {
    grid-template-columns: 1fr;
  }
  .editor-column:has(.tuning-card), .catalog-column:has(.voice-catalog-card) { grid-column: 1; }
  .sliders-grid {
    grid-template-columns: 1fr;
  }
}

/* Strata page treatment */
.voice-studio-page { background:#f3f4f2; }
.voice-studio-page .voice-panel, .voice-studio-page .editor-card, .voice-studio-page .catalog-card, .voice-studio-page .tuning-card { border-color:#e3e5e1; border-radius:12px; box-shadow:0 1px 2px rgba(17,24,23,.04); }
.voice-studio-page .primary-btn, .voice-studio-page .save-btn, .voice-studio-page .test-btn { background:#0b8f69; border-color:#0b8f69; box-shadow:none; }
.voice-studio-page .primary-btn:hover, .voice-studio-page .save-btn:hover, .voice-studio-page .test-btn:hover { background:#087a5a; }
</style>