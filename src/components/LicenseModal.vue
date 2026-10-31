<template>
  <div v-if="props.open" class="license-modal-backdrop" @click.self="$emit('close')">
    <div class="license-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <!-- 头部 -->
      <header class="dialog-header">
        <div class="header-left">
          <div class="diamond-icon">
            <Crown :size="20" />
          </div>
          <div>
            <h2 id="modal-title">卡密激活与授权管理</h2>
            <p>管理您的软件授权、尊享专业版专属直播特权</p>
          </div>
        </div>
        <button class="close-btn" type="button" title="关闭" @click="$emit('close')">
          <X :size="18" />
        </button>
      </header>

      <!-- 核心信息卡片 -->
      <div class="status-card">
        <div class="card-left">
          <div class="vip-badge">
            <Sparkles :size="14" />
            <span>尊享终身版</span>
          </div>
          <div class="expire-time">
            <strong>会员状态：有效</strong>
            <span>有效期至：2027-10-22 21:23:07</span>
          </div>
        </div>
        <span class="active-tag">已授权</span>
      </div>

      <!-- 机器码信息 -->
      <div class="info-section">
        <label>本机机器识别码 (HWID)</label>
        <div class="copy-box">
          <code>{{ hwid }}</code>
          <button type="button" @click="copyHwid">
            <Check v-if="copied" :size="14" />
            <Copy v-else :size="14" />
            <span>{{ copied ? '已复制' : '复制' }}</span>
          </button>
        </div>
      </div>

      <!-- 卡密激活输入 -->
      <div class="info-section">
        <label for="cdkey-input">充值 / 激活新卡密</label>
        <div class="input-row">
          <input
            id="cdkey-input"
            v-model.trim="cdkey"
            type="text"
            placeholder="请输入购买的卡密序列号 (如 DOUAI-XXXX-XXXX)"
            maxlength="64"
          />
          <button class="activate-btn" :disabled="!cdkey || activating" @click="activateKey">
            {{ activating ? '验证中…' : '立即激活' }}
          </button>
        </div>
        <p v-if="message" class="feedback-msg" :class="{ error: isError }">{{ message }}</p>
      </div>

      <!-- 特权列表 -->
      <div class="benefits-section">
        <span class="benefits-title">已解锁的专业特权：</span>
        <div class="benefits-grid">
          <div class="benefit-item">
            <CheckCircle :size="14" class="benefit-icon" />
            <span>多种互动玩法</span>
          </div>
          <div class="benefit-item">
            <CheckCircle :size="14" class="benefit-icon" />
            <span>抖音直播真实弹幕极速接入</span>
          </div>
          <div class="benefit-item">
            <CheckCircle :size="14" class="benefit-icon" />
            <span>智能自然语音 (TTS) 场景播报</span>
          </div>
          <div class="benefit-item">
            <CheckCircle :size="14" class="benefit-icon" />
            <span>9:16 独立游戏画面窗口</span>
          </div>
          <div class="benefit-item">
            <CheckCircle :size="14" class="benefit-icon" />
            <span>整点报时与定时氛围提示</span>
          </div>
          <div class="benefit-item">
            <CheckCircle :size="14" class="benefit-icon" />
            <span>专属技术支持与软件免费更新</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Crown, Sparkles, X, Copy, Check, CheckCircle } from '@lucide/vue';

const props = defineProps<{
  open: boolean;
}>();

defineEmits<{
  close: [];
}>();

const hwid = ref('DA-MAC-20261022-8F9E-7C1B');
const cdkey = ref('');
const copied = ref(false);
const activating = ref(false);
const message = ref('');
const isError = ref(false);

async function copyHwid() {
  await navigator.clipboard.writeText(hwid.value);
  copied.value = true;
  setTimeout(() => {
    copied.value = false;
  }, 1800);
}

async function activateKey() {
  if (!cdkey.value) return;
  activating.value = true;
  message.value = '';
  isError.value = false;

  setTimeout(() => {
    activating.value = false;
    message.value = '恭喜！卡密激活成功，授权有效期已自动延长！';
    cdkey.value = '';
  }, 800);
}
</script>

<style scoped>
.license-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(17, 24, 23, 0.28);
  backdrop-filter: blur(6px);
  display: grid;
  place-items: center;
  padding: 20px;
}

.license-modal-dialog {
  width: 100%;
  max-width: 540px;
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e3e5e1;
  box-shadow: 0 18px 48px rgba(17, 24, 23, 0.14), 0 1px 2px rgba(17, 24, 23, 0.06);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  animation: modalEnter 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes modalEnter {
  from {
    opacity: 0;
    transform: scale(0.96) translateY(6px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.diamond-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: #0b8f69;
  display: grid;
  place-items: center;
  color: #ffffff;
  box-shadow: none;
}

.header-left h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #1e293b;
}

.header-left p {
  margin: 3px 0 0;
  font-size: 12px;
  color: #64748b;
}

.close-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  color: #94a3b8;
  transition: all 0.15s;
}
.close-btn:hover {
  background: #f1f5f9;
  color: #1e293b;
}

.status-card {
  padding: 16px 18px;
  border-radius: 12px;
  background: #e7f5ef;
  border: 1px solid #b8e3d0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.vip-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  border-radius: 6px;
  background: #15803d;
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
  margin-bottom: 6px;
}

.expire-time {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.expire-time strong {
  font-size: 14px;
  color: #166534;
}

.expire-time span {
  font-size: 12px;
  color: #15803d;
}

.active-tag {
  font-size: 12px;
  font-weight: 600;
  color: #16a34a;
  background: #ffffff;
  padding: 4px 10px;
  border-radius: 20px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
}

.info-section {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.info-section label {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
}

.copy-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.copy-box code {
  font-family: ui-monospace, monospace;
  font-size: 13px;
  color: #334155;
  font-weight: 600;
}

.copy-box button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #0b8f69;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 4px;
  background: #e7f5ef;
}
.copy-box button:hover {
  background: #c8ebdc;
}

.input-row {
  display: flex;
  gap: 8px;
}

.input-row input {
  flex: 1;
  padding: 9px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 13px;
  background: #ffffff;
  color: #1e293b;
  outline: none;
}
.input-row input:focus {
  border-color: #0b8f69;
  box-shadow: 0 0 0 2px rgba(11, 143, 105, 0.2);
}

.activate-btn {
  padding: 0 18px;
  background: #0b8f69;
  color: #ffffff;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  transition: all 0.15s;
}
.activate-btn:hover:not(:disabled) {
  background: #087a5a;
}
.activate-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.feedback-msg {
  margin: 4px 0 0;
  font-size: 12px;
  color: #16a34a;
}
.feedback-msg.error {
  color: #ef4444;
}

.benefits-section {
  padding-top: 10px;
  border-top: 1px solid #f1f5f9;
}

.benefits-title {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  margin-bottom: 8px;
}

.benefits-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.benefit-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #475569;
}

.benefit-icon {
  color: #0b8f69;
  flex-shrink: 0;
}
</style>
