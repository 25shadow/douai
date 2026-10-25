<script setup lang="ts">
import { reactive } from 'vue';
import {
  versusThemes,
  versusRuntimeSettings,
  updateVersusConfig,
  startVersus,
  type VersusThemeId,
  type VersusConfig
} from '@/game/versus/versusStore';
import { X, Check, Play, Palette, Swords, Sliders, Volume2, Sparkles } from '@lucide/vue';

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'start'): void;
}>();

const form = reactive<VersusConfig>({
  theme: versusRuntimeSettings.theme || 'tug',
  targetScore: versusRuntimeSettings.targetScore || 200,
  redTeamName: versusRuntimeSettings.redTeamName || '烈焰红队',
  blueTeamName: versusRuntimeSettings.blueTeamName || '极光蓝队',
  redCommand: versusRuntimeSettings.redCommand || '1',
  blueCommand: versusRuntimeSettings.blueCommand || '2',
  giftMultiplier: versusRuntimeSettings.giftMultiplier || 5,
  voice: versusRuntimeSettings.voice !== false,
  autoRematch: versusRuntimeSettings.autoRematch !== false
});

const presets = [
  { red: '烈焰红队', blue: '极光蓝队', redCmd: '1', blueCmd: '2' },
  { red: '太阳战队', blue: '月亮战队', redCmd: '1', blueCmd: '2' },
  { red: '龙腾战队', blue: '虎跃战队', redCmd: '1', blueCmd: '2' },
  { red: '甜粽党', blue: '咸粽党', redCmd: '1', blueCmd: '2' },
  { red: '猫咪派', blue: '汪星派', redCmd: '1', blueCmd: '2' }
];

function applyPreset(p: typeof presets[0]) {
  form.redTeamName = p.red;
  form.blueTeamName = p.blue;
  form.redCommand = p.redCmd;
  form.blueCommand = p.blueCmd;
}

function handleSave() {
  updateVersusConfig({ ...form });
  emit('close');
}

function handleSaveAndStart() {
  updateVersusConfig({ ...form });
  startVersus();
  emit('start');
  emit('close');
}
</script>

<template>
  <div class="versus-modal-backdrop" @click.self="emit('close')">
    <div class="versus-modal-window">
      <!-- 弹窗顶栏 -->
      <header class="modal-header">
        <div class="header-title">
          <div class="icon-chip">
            <Swords :size="20" />
          </div>
          <div>
            <h3>阵营对抗 - 游戏配置</h3>
            <small>配置对抗画面主题、阵营名称、弹幕指令与暴击数值</small>
          </div>
        </div>
        <button class="close-btn" type="button" @click="emit('close')">
          <X :size="18" />
        </button>
      </header>

      <!-- 弹窗主体内容 -->
      <div class="modal-body">
        <!-- 1. 主题选择方案 -->
        <section class="config-block">
          <div class="block-title">
            <Palette :size="16" />
            <span>1. 画面主题方案 (4 大独立视觉)</span>
          </div>
          <div class="themes-grid">
            <div
              v-for="t in versusThemes"
              :key="t.id"
              class="theme-card"
              :class="{ selected: form.theme === t.id }"
              @click="form.theme = t.id"
            >
              <div class="theme-card-top">
                <span class="theme-badge">{{ t.badge }}</span>
                <span v-if="form.theme === t.id" class="check-mark"><Check :size="14" /></span>
              </div>
              <strong class="theme-name">{{ t.name }}</strong>
              <p class="theme-desc">{{ t.desc }}</p>
            </div>
          </div>
        </section>

        <!-- 2. 阵营名称与指令设置 -->
        <section class="config-block">
          <div class="block-title">
            <Swords :size="16" />
            <span>2. 阵营名称与弹幕指令</span>
          </div>

          <!-- 快捷预设按钮组 -->
          <div class="presets-row">
            <span class="preset-label">快捷预设：</span>
            <button
              v-for="(p, idx) in presets"
              :key="idx"
              type="button"
              class="preset-btn"
              :class="{ active: form.redTeamName === p.red && form.blueTeamName === p.blue }"
              @click="applyPreset(p)"
            >
              {{ p.red }} VS {{ p.blue }}
            </button>
          </div>

          <div class="teams-input-grid">
            <!-- 红方设置 -->
            <div class="team-panel red-panel">
              <div class="panel-tag">🔴 红方阵营</div>
              <div class="form-item">
                <label>阵营名称</label>
                <input v-model="form.redTeamName" type="text" placeholder="例如：烈焰红队" />
              </div>
              <div class="form-item">
                <label>助攻弹幕指令</label>
                <input v-model="form.redCommand" type="text" placeholder="输入 1 助攻" />
              </div>
            </div>

            <!-- 蓝方设置 -->
            <div class="team-panel blue-panel">
              <div class="panel-tag">🔵 蓝方阵营</div>
              <div class="form-item">
                <label>阵营名称</label>
                <input v-model="form.blueTeamName" type="text" placeholder="例如：极光蓝队" />
              </div>
              <div class="form-item">
                <label>助攻弹幕指令</label>
                <input v-model="form.blueCommand" type="text" placeholder="输入 2 助攻" />
              </div>
            </div>
          </div>
        </section>

        <!-- 3. 对决目标与数值规则 -->
        <section class="config-block">
          <div class="block-title">
            <Sliders :size="16" />
            <span>3. 胜负规则与暴击加成</span>
          </div>

          <div class="rules-grid">
            <div class="rule-field">
              <label>胜利目标积分</label>
              <div class="options-pills">
                <button
                  v-for="score in [100, 200, 500, 1000]"
                  :key="score"
                  type="button"
                  class="pill-btn"
                  :class="{ active: form.targetScore === score }"
                  @click="form.targetScore = score"
                >
                  {{ score }}分{{ score === 200 ? ' (推荐)' : '' }}
                </button>
              </div>
            </div>

            <div class="rule-field">
              <label>礼物暴击倍数</label>
              <div class="options-pills">
                <button
                  v-for="mult in [5, 10, 20]"
                  :key="mult"
                  type="button"
                  class="pill-btn"
                  :class="{ active: form.giftMultiplier === mult }"
                  @click="form.giftMultiplier = mult"
                >
                  {{ mult }}倍暴击
                </button>
              </div>
            </div>

            <div class="rule-field">
              <label>全自动语音实时解说</label>
              <div class="switch-row">
                <button
                  type="button"
                  class="toggle-btn"
                  :class="{ on: form.voice }"
                  @click="form.voice = !form.voice"
                >
                  <Volume2 :size="16" />
                  <span>{{ form.voice ? '语音解说开启' : '静音运行' }}</span>
                </button>
              </div>
            </div>

            <div class="rule-field">
              <label>获胜后自动开启下轮</label>
              <div class="switch-row">
                <button
                  type="button"
                  class="toggle-btn"
                  :class="{ on: form.autoRematch }"
                  @click="form.autoRematch = !form.autoRematch"
                >
                  <Sparkles :size="16" />
                  <span>{{ form.autoRematch ? '对决结束自动重置' : '手动结算' }}</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- 弹窗底栏操作 -->
      <footer class="modal-footer">
        <button class="btn-cancel" type="button" @click="emit('close')">取消</button>
        <button class="btn-save" type="button" @click="handleSave">
          <Check :size="16" />
          <span>保存配置</span>
        </button>
        <button class="btn-start" type="button" @click="handleSaveAndStart">
          <Play :size="16" fill="currentColor" />
          <span>保存并立即开战</span>
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.versus-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 999;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.versus-modal-window {
  width: 820px;
  max-width: 95vw;
  max-height: 90vh;
  background: #18181b;
  border: 1px solid #27272a;
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.8);
  color: #f4f4f5;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #27272a;
  background: #1f1f23;
}
.header-title {
  display: flex;
  align-items: center;
  gap: 14px;
}
.icon-chip {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: linear-gradient(135deg, #e11d48, #0284c7);
  display: grid;
  place-items: center;
  color: #fff;
}
.header-title h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 800;
  color: #ffffff;
}
.header-title small {
  font-size: 13px;
  color: #a1a1aa;
}
.close-btn {
  background: transparent;
  border: none;
  color: #71717a;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  display: grid;
  place-items: center;
}
.close-btn:hover { background: #27272a; color: #fff; }

.modal-body {
  padding: 20px 24px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 22px;
}
.config-block {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.block-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 800;
  color: #fbbf24;
}

/* 主题选择网格 */
.themes-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.theme-card {
  background: #27272a;
  border: 2px solid #3f3f46;
  border-radius: 14px;
  padding: 12px 14px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: all 0.2s;
}
.theme-card:hover { border-color: #71717a; }
.theme-card.selected {
  border-color: #f43f5e;
  background: rgba(244, 63, 94, 0.1);
  box-shadow: 0 0 16px rgba(244, 63, 94, 0.2);
}
.theme-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.theme-badge {
  font-size: 12px;
  font-weight: 800;
  color: #a1a1aa;
  background: #18181b;
  padding: 2px 8px;
  border-radius: 6px;
}
.theme-card.selected .theme-badge {
  color: #f43f5e;
}
.check-mark {
  color: #f43f5e;
}
.theme-name {
  font-size: 14px;
  font-weight: 800;
  color: #ffffff;
}
.theme-desc {
  font-size: 12px;
  color: #a1a1aa;
  margin: 0;
  line-height: 1.4;
}

/* 预设行 */
.presets-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.preset-label {
  font-size: 13px;
  color: #a1a1aa;
}
.preset-btn {
  background: #27272a;
  border: 1px solid #3f3f46;
  color: #d4d4d8;
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 8px;
  cursor: pointer;
}
.preset-btn:hover { background: #3f3f46; }
.preset-btn.active {
  background: #0284c7;
  border-color: #0284c7;
  color: #ffffff;
}

/* 阵营输入面板 */
.teams-input-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.team-panel {
  border-radius: 14px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.red-panel {
  background: rgba(244, 63, 94, 0.08);
  border: 1px solid rgba(244, 63, 94, 0.3);
}
.blue-panel {
  background: rgba(56, 189, 248, 0.08);
  border: 1px solid rgba(56, 189, 248, 0.3);
}
.panel-tag {
  font-size: 14px;
  font-weight: 800;
}
.red-panel .panel-tag { color: #f43f5e; }
.blue-panel .panel-tag { color: #38bdf8; }
.form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.form-item label {
  font-size: 12px;
  color: #a1a1aa;
}
.form-item input {
  background: #18181b;
  border: 1px solid #3f3f46;
  border-radius: 8px;
  padding: 8px 12px;
  color: #ffffff;
  font-size: 14px;
  outline: none;
}
.form-item input:focus { border-color: #0284c7; }

/* 规则网格 */
.rules-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.rule-field {
  background: #27272a;
  border: 1px solid #3f3f46;
  border-radius: 12px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.rule-field label {
  font-size: 13px;
  font-weight: 700;
  color: #d4d4d8;
}
.options-pills {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.pill-btn {
  background: #18181b;
  border: 1px solid #3f3f46;
  color: #a1a1aa;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}
.pill-btn:hover { background: #3f3f46; color: #fff; }
.pill-btn.active {
  background: #f43f5e;
  border-color: #f43f5e;
  color: #ffffff;
}
.toggle-btn {
  background: #18181b;
  border: 1px solid #3f3f46;
  color: #71717a;
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
}
.toggle-btn.on {
  border-color: #22c55e;
  color: #22c55e;
  background: rgba(34, 197, 94, 0.1);
}

.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid #27272a;
  background: #1f1f23;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
.btn-cancel {
  background: transparent;
  border: 1px solid #3f3f46;
  color: #a1a1aa;
  padding: 8px 18px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
}
.btn-save {
  background: #27272a;
  border: 1px solid #52525b;
  color: #ffffff;
  padding: 8px 18px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 6px;
}
.btn-start {
  background: linear-gradient(135deg, #e11d48, #be123c);
  border: none;
  color: #ffffff;
  padding: 8px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 6px;
  box-shadow: 0 4px 14px rgba(225, 29, 72, 0.4);
}
</style>
