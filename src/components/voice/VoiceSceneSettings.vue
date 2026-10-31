<template>
  <section class="scenes-workbench-card">
    <div class="scenes-card-top">
      <div class="top-title-wrap">
        <Sparkles :size="16" class="brand-icon" />
        <div>
          <h3>直播事件语音播报触发器</h3>
          <p>开启后，当直播间发生对应事件时将自动合成语音并加入播报队列</p>
        </div>
      </div>
      <span class="active-scenes-badge">
        已启用 <b>{{ enabledCount }}</b> / {{ Object.keys(sceneNames).length }} 个场景
      </span>
    </div>

    <details class="scene-settings-disclosure">
      <summary>配置各类事件播报 <span>展开 5 类互动事件</span></summary>
    <div class="scenes-cards-grid">
      <article 
        v-for="(name, key) in sceneNames" 
        :key="key" 
        class="scene-event-card"
        :class="{ enabled: config.scenes[key].enabled }"
      >
        <div class="event-card-header">
          <div class="event-header-left">
            <div class="scene-icon-wrap" :class="key">
              <Gift v-if="key === 'gift'" :size="16" />
              <Heart v-else-if="key === 'like'" :size="16" />
              <UserCheck v-else-if="key === 'follow'" :size="16" />
              <DoorOpen v-else-if="key === 'join'" :size="16" />
              <Share2 v-else :size="16" />
            </div>
            <div class="scene-title-box">
              <h4>{{ name }}</h4>
              <small>{{ descriptions[key] }}</small>
            </div>
          </div>

          <!-- iOS/Mac 风格开关 -->
          <label class="mac-switch" :aria-label="`启用${name}`">
            <input v-model="config.scenes[key].enabled" type="checkbox" />
            <span class="switch-slider"></span>
          </label>
        </div>

        <div class="event-card-body" :class="{ disabled: !config.scenes[key].enabled }">
          <label :for="`template-${key}`" class="input-label">播报文案模版</label>
          <textarea 
            :id="`template-${key}`" 
            v-model="config.scenes[key].template" 
            maxlength="300" 
            :disabled="!config.scenes[key].enabled"
            placeholder="请输入播报文案，点击下方变量可快速插入" 
          />

          <div class="event-card-footer">
            <div class="output-switches">
              <label><input v-model="config.scenes[key].output.voice" type="checkbox" /> 朗读</label>
              <label><input v-model="config.scenes[key].output.text" type="checkbox" /> 发文字</label>
            </div>
            <!-- 可点击动态变量标签 -->
            <div class="variables-selector">
              <span class="var-title">点击插入变量：</span>
              <button 
                v-for="v in variables[key]" 
                :key="v"
                type="button"
                class="var-chip"
                :disabled="!config.scenes[key].enabled"
                :title="`插入 ${v}`"
                @click="insertVariable(key, v)"
              >
                {{ v }}
              </button>
            </div>

            <!-- 冷却间隔 -->
            <div class="cooldown-box">
              <span>最小间隔：</span>
              <input 
                v-model.number="config.scenes[key].cooldownMs" 
                type="number" 
                min="0" 
                max="60000" 
                step="500"
                :disabled="!config.scenes[key].enabled"
              />
              <small>毫秒</small>
            </div>
          </div>
        </div>
      </article>
    </div>
    </details>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Sparkles, Gift, Heart, UserCheck, DoorOpen, Share2 } from '@lucide/vue';
import { sceneNames, type LiveVoiceScene, type VoiceConfig } from '../../voice/voiceConfig';

const config = defineModel<VoiceConfig>({ required: true });

const enabledCount = computed(() => Object.values(config.value.scenes).filter(v => v.enabled).length);

const descriptions: Record<LiveVoiceScene, string> = {
  gift: '观众送出礼物或礼物连击结算时自动感谢',
  like: '观众累计点赞达到一定频次时触发播报',
  follow: '新观众关注主播或加入粉丝团时播报',
  join: '观众进入直播间时触发个性化欢迎',
  share: '观众转发分享直播间时触发感谢'
};

const variables: Record<LiveVoiceScene, string[]> = {
  gift: ['{昵称}', '{礼物}', '{数量}'],
  like: ['{昵称}', '{点赞数}'],
  follow: ['{昵称}'],
  join: ['{昵称}'],
  share: ['{昵称}']
};

function insertVariable(key: LiveVoiceScene, variable: string) {
  config.value.scenes[key].template = (config.value.scenes[key].template || '') + variable;
}
</script>

<style scoped>
.scenes-workbench-card {
  background: #ffffff;
  border-radius: var(--radius-md);
  border: 1px solid var(--line);
  box-shadow: var(--card-shadow);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.scenes-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 14px;
  border-bottom: 1px solid #f1f5f9;
  flex-wrap: wrap;
  gap: 10px;
}

.scene-settings-disclosure > summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #f8fafc;
  font-size: 12px;
  font-weight: 650;
  color: var(--text-main);
}

.scene-settings-disclosure > summary span {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 400;
}

.scene-settings-disclosure[open] .scenes-cards-grid {
  margin-top: 10px;
}

.top-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.brand-icon {
  color: #0b8f69;
}

.top-title-wrap h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-main);
}

.top-title-wrap p {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--text-muted);
}

.active-scenes-badge {
  font-size: 12px;
  color: #64748b;
  padding: 4px 10px;
  border-radius: 20px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.active-scenes-badge b {
  color: #0b8f69;
}

.scenes-cards-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.scene-event-card {
  background: #f8fafc;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.scene-event-card:hover {
  background: #ffffff;
  border-color: #cbd5e1;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
}

.scene-event-card.enabled {
  background: #ffffff;
  border-color: rgba(11, 143, 105, 0.4);
  box-shadow: 0 4px 14px rgba(11, 143, 105, 0.06);
}

.event-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.event-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.scene-icon-wrap {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.scene-icon-wrap.gift {
  background: #fef3c7;
  color: #d97706;
}
.scene-icon-wrap.like {
  background: #fce7f3;
  color: #db2777;
}
.scene-icon-wrap.follow {
  background: #e7f5ef;
  color: #087a5a;
}
.scene-icon-wrap.join {
  background: #eff6ff;
  color: #2563eb;
}
.scene-icon-wrap.share {
  background: #f5f3ff;
  color: #7c3aed;
}

.scene-title-box h4 {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-main);
}

.scene-title-box small {
  margin: 2px 0 0;
  font-size: 11px;
  color: var(--text-muted);
}

/* Mac 极简切换开关 */
.mac-switch {
  position: relative;
  display: inline-block;
  width: 38px;
  height: 20px;
  cursor: pointer;
}

.mac-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.switch-slider {
  position: absolute;
  inset: 0;
  background-color: #cbd5e1;
  transition: 0.2s;
  border-radius: 20px;
}

.switch-slider:before {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  transition: 0.2s;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.mac-switch input:checked + .switch-slider {
  background-color: #0b8f69;
}

.mac-switch input:checked + .switch-slider:before {
  transform: translateX(18px);
}

.event-card-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: opacity 0.2s;
}

.event-card-body.disabled {
  opacity: 0.45;
  pointer-events: none;
}

.input-label {
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
}

textarea {
  width: 100%;
  min-height: 52px;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  color: var(--text-main);
  font-size: 12px;
  line-height: 1.6;
  outline: none;
  resize: vertical;
  transition: all 0.15s;
}

textarea:focus {
  border-color: #0b8f69;
  background: #ffffff;
  box-shadow: 0 0 0 2px rgba(11, 143, 105, 0.15);
}

.event-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
}
.output-switches { display: flex; gap: 8px; margin-bottom: 10px; }
.output-switches label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 8px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: #fff;
  color: var(--text-muted);
  font-size: 10px;
}
.output-switches input { accent-color: #0b8f69; }

.variables-selector {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.var-title {
  font-size: 11px;
  color: #64748b;
}

.var-chip {
  padding: 3px 8px;
  border-radius: 6px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  font-size: 11px;
  font-family: ui-monospace, monospace;
  color: #0f766e;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.var-chip:hover:not(:disabled) {
  background: #ccfbf1;
  border-color: #99f6e4;
  color: #0d9488;
}

.cooldown-box {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #64748b;
}

.cooldown-box input {
  width: 65px;
  padding: 3px 6px;
  border-radius: 4px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  font-size: 11px;
  font-family: ui-monospace, monospace;
  text-align: center;
  color: var(--text-main);
  outline: none;
}
.cooldown-box input:focus {
  border-color: #0b8f69;
}
</style>
