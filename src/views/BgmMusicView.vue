<template>
  <div class="bgm-page">
    <header class="page-top-header">
      <div class="header-titles">
        <span class="sub-category">AUDIO & SOUNDBOARD</span>
        <h1>背景音乐与直播音效</h1>
        <p>提供实时氛围音效、答题音效与背景音乐控制，声音可同步流入虚拟声卡。</p>
      </div>
      <div class="volume-master">
        <Volume2 :size="16" class="vol-icon" />
        <span>主音量</span>
        <input 
          v-model.number="masterVolume" 
          type="range" 
          min="0" 
          max="1" 
          step="0.05"
          @input="updateVolume"
        />
        <span class="vol-num">{{ Math.round(masterVolume * 100) }}%</span>
      </div>
    </header>

    <!-- 氛围音效操作区 (Soundboard) -->
    <section class="soundboard-section">
      <div class="section-title">
        <div class="title-left">
          <Sparkles :size="16" class="icon-sparkle" />
          <h2>直播互动音效板 (即点即播)</h2>
        </div>
        <span class="tip-badge">基于 Web Audio 高保真算法实时合成</span>
      </div>

      <div class="sound-grid">
        <button class="sound-card" @click="soundEffects.playCorrect()">
          <div class="sound-icon-box green">
            <Check :size="24" />
          </div>
          <div class="sound-meta">
            <strong>答对恭喜</strong>
            <small>清脆双音和弦 · 激发答题热情</small>
          </div>
          <Play :size="16" class="play-indicator" />
        </button>

        <button class="sound-card" @click="soundEffects.playWrong()">
          <div class="sound-icon-box red">
            <X :size="24" />
          </div>
          <div class="sound-meta">
            <strong>答错遗憾</strong>
            <small>重低音下潜提示 · 节奏鲜明</small>
          </div>
          <Play :size="16" class="play-indicator" />
        </button>

        <button class="sound-card" @click="soundEffects.playGift()">
          <div class="sound-icon-box amber">
            <Gift :size="24" />
          </div>
          <div class="sound-meta">
            <strong>礼物答谢</strong>
            <small>金币清脆三连音 · 感谢榜一大哥</small>
          </div>
          <Play :size="16" class="play-indicator" />
        </button>

        <button class="sound-card" @click="soundEffects.playApplause()">
          <div class="sound-icon-box purple">
            <Flame :size="24" />
          </div>
          <div class="sound-meta">
            <strong>鼓掌欢呼</strong>
            <small>全场喝彩氛围 · 点燃直播间</small>
          </div>
          <Play :size="16" class="play-indicator" />
        </button>

        <button class="sound-card" @click="soundEffects.playCountdown()">
          <div class="sound-icon-box blue">
            <Clock :size="24" />
          </div>
          <div class="sound-meta">
            <strong>倒计时嘀嗒</strong>
            <small>抢答倒计时警报 · 紧迫刺激</small>
          </div>
          <Play :size="16" class="play-indicator" />
        </button>
      </div>
    </section>

    <!-- 虚拟声卡配置说明 -->
    <section class="cable-guide-card">
      <div class="cable-icon">
        <Radio :size="28" />
      </div>
      <div class="cable-text">
        <h3>如何将音乐和音效输出到抖音直播伴侣？</h3>
        <p>安装免费虚拟声卡 <strong>VB-CABLE</strong> (Windows) 或 <strong>BlackHole</strong> (macOS)，将本软件音频输出设备指定为虚拟声卡，然后在直播伴侣中添加「音频输入采集」即可实现无人值守纯净音质直播！</p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Volume2, Sparkles, Check, X, Gift, Flame, Clock, Radio, Play } from '@lucide/vue';
import { soundEffects } from '@/utils/soundEffects';

const masterVolume = ref(soundEffects.getVolume());

function updateVolume() {
  soundEffects.setVolume(masterVolume.value);
}
</script>

<style scoped>
.bgm-page {
  padding: 20px 24px 36px;
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-top-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--line);
}

.sub-category {
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
}

.header-titles p {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
}

.volume-master {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #ffffff;
  padding: 8px 16px;
  border-radius: 10px;
  border: 1px solid var(--line);
  box-shadow: var(--card-shadow);
}

.vol-icon {
  color: #10b981;
}

.volume-master span {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 600;
}

.vol-num {
  font-family: ui-monospace, monospace;
  min-width: 36px;
  color: var(--text-main) !important;
}

.volume-master input[type="range"] {
  accent-color: #10b981;
  width: 100px;
  cursor: pointer;
}

.soundboard-section {
  background: #ffffff;
  border-radius: var(--radius-md);
  border: 1px solid var(--line);
  padding: 20px;
  box-shadow: var(--card-shadow);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.title-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-sparkle {
  color: #10b981;
}

.title-left h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-main);
}

.tip-badge {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 4px;
  background: #f1f5f9;
  color: #64748b;
}

.sound-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}

.sound-card {
  display: flex;
  align-items: center;
  gap: 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 14px;
  text-align: left;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
  cursor: pointer;
}

.sound-card:hover {
  background: #ffffff;
  border-color: #10b981;
  box-shadow: 0 6px 18px rgba(16, 185, 129, 0.12);
  transform: translateY(-2px);
}

.sound-icon-box {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.sound-icon-box.green {
  background: #ecfdf5;
  color: #10b981;
}
.sound-icon-box.red {
  background: #fef2f2;
  color: #ef4444;
}
.sound-icon-box.amber {
  background: #fffbeb;
  color: #f59e0b;
}
.sound-icon-box.purple {
  background: #f5f3ff;
  color: #8b5cf6;
}
.sound-icon-box.blue {
  background: #eff6ff;
  color: #3b82f6;
}

.sound-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.sound-meta strong {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-main);
}

.sound-meta small {
  font-size: 11px;
  color: var(--text-muted);
}

.play-indicator {
  color: #cbd5e1;
  transition: color 0.15s;
}

.sound-card:hover .play-indicator {
  color: #10b981;
}

.cable-guide-card {
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
  border: 1px solid #bbf7d0;
  border-radius: var(--radius-md);
  padding: 18px 22px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.cable-icon {
  color: #16a34a;
  flex-shrink: 0;
}

.cable-text h3 {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 700;
  color: #166534;
}

.cable-text p {
  margin: 0;
  font-size: 12px;
  color: #15803d;
  line-height: 1.6;
}
</style>
