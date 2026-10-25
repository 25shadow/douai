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

    <!-- 工作台主体两列布局：左侧音色库 | 右侧声音调谐与场景 -->
    <fieldset class="workbench-grid" :disabled="loading || !loaded || saving">
      
      <!-- 1. 左侧：音色库组件 -->
      <div class="catalog-column">
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
      <div class="editor-column">
        
        <!-- 选定音色横幅与参数微调 -->
        <section class="tuning-card">
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
        <section class="testing-studio-card">
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
        <VoiceSceneSettings v-model="draft" />
        
      </div>
    </fieldset>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { 
  Sparkles, Save, AlertCircle, Volume2, Headphones, 
  Play, Pause, Square 
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
  color: #10b981;
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
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
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
  background: #10b981;
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
  background: #10b981;
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.25);
  transition: all 0.15s;
}

.save-voice-btn:hover:not(:disabled) {
  background: #059669;
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
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: #ffffff;
  display: grid;
  place-items: center;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25);
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
  color: #10b981;
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
  background-color: #10b981;
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
  background: #ecfdf5;
  border-color: #10b981;
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
  border-color: #10b981;
}

.modern-range-slider {
  width: 100%;
  accent-color: #10b981;
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
  border-color: #10b981;
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
  color: #10b981;
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
  border-color: #10b981;
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
  background: #10b981;
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
  transition: all 0.15s;
}
.play-main-btn:hover:not(:disabled) {
  background: #059669;
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
  background: #10b981;
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
  color: #10b981;
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
  color: #059669;
  background: #ecfdf5;
  padding: 6px 10px;
  border-radius: 6px;
}

@media (max-width: 960px) {
  .workbench-grid {
    grid-template-columns: 1fr;
  }
  .sliders-grid {
    grid-template-columns: 1fr;
  }
}
</style>
