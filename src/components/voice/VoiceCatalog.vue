<template>
  <aside class="voice-catalog-card">
    <!-- 头部与刷新 -->
    <header class="catalog-header">
      <div class="header-titles">
        <span class="catalog-eyebrow">VOICE LIBRARY</span>
        <h2>音色库 <span class="count-pill">{{ voices.length }}</span></h2>
      </div>
      <button class="tool-icon-btn" title="重新检测系统音色" aria-label="刷新音色" @click="$emit('refresh')">
        <RefreshCw :size="15" />
      </button>
    </header>

    <!-- 搜索与筛选器 -->
    <div class="catalog-filter-box">
      <div class="search-input-wrap">
        <Search :size="14" class="search-icon" />
        <input 
          :value="search" 
          aria-label="搜索音色" 
          placeholder="搜索音色名称或语言代码" 
          @input="$emit('update:search', ($event.target as HTMLInputElement).value)" 
        />
        <button 
          v-if="search" 
          class="clear-search-btn" 
          type="button" 
          title="清空搜索" 
          @click="$emit('update:search', '')"
        >
          <X :size="12" />
        </button>
      </div>

      <div class="filter-actions-row">
        <select 
          :value="language" 
          aria-label="筛选语言" 
          class="lang-select"
          @change="$emit('update:language', ($event.target as HTMLSelectElement).value)"
        >
          <option value="">全部语言 ({{ languages.length }})</option>
          <option v-for="lang in languages" :key="lang" :value="lang">{{ lang }}</option>
        </select>

        <button 
          class="fav-toggle-btn" 
          :class="{ active: favoritesOnly }" 
          title="只看已收藏音色" 
          :aria-pressed="favoritesOnly" 
          @click="$emit('update:favoritesOnly', !favoritesOnly)"
        >
          <Star :size="14" :fill="favoritesOnly ? 'currentColor' : 'none'" />
          <span>收藏</span>
        </button>
      </div>
    </div>

    <!-- 音色列表 -->
    <div class="voices-scroll-list" role="group" aria-label="可用音色">
      <!-- 自动音色 -->
      <button 
        class="voice-card-item auto-choice" 
        :class="{ chosen: !draft.voiceURI }" 
        type="button"
        @click="$emit('select')"
      >
        <div class="voice-monogram auto">
          <AudioLines :size="16" />
        </div>
        <div class="voice-meta">
          <strong>系统自动选择</strong>
          <small>{{ draft.lang || '当前默认语言环境' }}</small>
        </div>
        <Check v-if="!draft.voiceURI" :size="15" class="check-icon" />
      </button>

      <!-- 各音色条目 -->
      <div 
        v-for="voice in filteredVoices" 
        :key="voice.voiceURI" 
        class="voice-card-item" 
        :class="{ chosen: draft.voiceURI === voice.voiceURI }"
      >
        <button 
          class="voice-select-area" 
          type="button"
          :aria-pressed="draft.voiceURI === voice.voiceURI" 
          @click="$emit('select', voice)"
        >
          <span class="voice-monogram">{{ voice.lang.slice(0, 2).toUpperCase() }}</span>
          <div class="voice-meta">
            <strong>{{ voice.name }}</strong>
            <small>
              <span>{{ voice.lang }}</span>
              <span class="dot-sep">·</span>
              <span class="tag-service">{{ voice.localService ? '本地' : '在线' }}</span>
              <span v-if="voice.default" class="tag-default">系统默认</span>
            </small>
          </div>
          <Check v-if="draft.voiceURI === voice.voiceURI" :size="15" class="check-icon" />
        </button>

        <button 
          class="star-icon-btn" 
          :class="{ favorited: draft.favoriteVoiceURIs.includes(voice.voiceURI) }" 
          :title="draft.favoriteVoiceURIs.includes(voice.voiceURI) ? '取消收藏' : '收藏音色'" 
          type="button"
          @click="$emit('favorite', voice.voiceURI)"
        >
          <Star :size="14" :fill="draft.favoriteVoiceURIs.includes(voice.voiceURI) ? 'currentColor' : 'none'" />
        </button>
      </div>

      <!-- 空状态 -->
      <div v-if="!supported" class="catalog-empty-box">
        <VolumeX :size="30" class="empty-icon" />
        <strong>当前环境不支持 Web Speech 语音合成</strong>
      </div>
      <div v-else-if="!voices.length" class="catalog-empty-box">
        <AudioLines :size="30" class="empty-icon" />
        <strong>正在扫描可用音色…</strong>
        <button class="reload-btn" type="button" @click="$emit('refresh')">重新检测</button>
      </div>
      <p v-else-if="!filteredVoices.length" class="no-filter-match">
        未找到匹配的音色
      </p>
    </div>

    <!-- 底部状态 -->
    <footer class="catalog-footer">
      <span class="engine-dot" :class="{ online: supported }"></span>
      <span>原生语音引擎：{{ supported ? '正常运作' : '不可用' }}</span>
    </footer>
  </aside>
</template>

<script setup lang="ts">
import { AudioLines, Check, RefreshCw, Search, Star, VolumeX, X } from '@lucide/vue';
import type { VoiceDescriptor } from '../../voice/browserSpeech';
import type { VoiceConfig } from '../../voice/voiceConfig';

defineProps<{ 
  voices: VoiceDescriptor[]; 
  filteredVoices: VoiceDescriptor[]; 
  languages: string[]; 
  search: string; 
  language: string; 
  favoritesOnly: boolean; 
  draft: VoiceConfig; 
  supported: boolean;
}>();

defineEmits<{
  refresh: []; 
  select: [voice?: VoiceDescriptor]; 
  favorite: [uri: string];
  'update:search': [value: string]; 
  'update:language': [value: string]; 
  'update:favoritesOnly': [value: boolean];
}>();
</script>

<style scoped>
.voice-catalog-card {
  background: #ffffff;
  border-radius: var(--radius-md);
  border: 1px solid var(--line);
  box-shadow: var(--card-shadow);
  padding: 16px;
  display: flex;
  flex-direction: column;
  height: 100%;
  box-sizing: border-box;
}

.catalog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
  border-bottom: 1px solid #f1f5f9;
}

.catalog-eyebrow {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: #0b8f69;
}

.header-titles h2 {
  margin: 2px 0 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-main);
  display: flex;
  align-items: center;
  gap: 6px;
}

.count-pill {
  font-size: 11px;
  font-family: ui-monospace, monospace;
  padding: 1px 6px;
  border-radius: 10px;
  background: #f1f5f9;
  color: #64748b;
}

.tool-icon-btn {
  width: 30px;
  height: 30px;
  border-radius: 6px;
  display: grid;
  place-items: center;
  color: #64748b;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  transition: all 0.15s;
}
.tool-icon-btn:hover {
  background: #ffffff;
  color: #0b8f69;
  border-color: #0b8f69;
}

.catalog-filter-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 12px 0;
}

.search-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 10px;
  color: #94a3b8;
  pointer-events: none;
}

.search-input-wrap input {
  width: 100%;
  padding: 8px 30px 8px 30px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  font-size: 12px;
  color: var(--text-main);
  outline: none;
  transition: all 0.15s;
}
.search-input-wrap input:focus {
  border-color: #0b8f69;
  background: #ffffff;
  box-shadow: 0 0 0 2px rgba(11, 143, 105, 0.15);
}

.clear-search-btn {
  position: absolute;
  right: 8px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: #94a3b8;
}
.clear-search-btn:hover {
  background: #e2e8f0;
  color: #475569;
}

.filter-actions-row {
  display: flex;
  gap: 8px;
}

.lang-select {
  flex: 1;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  font-size: 12px;
  color: #475569;
  outline: none;
}

.fav-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  font-size: 12px;
  color: #64748b;
  transition: all 0.15s;
}
.fav-toggle-btn.active {
  background: #fefce8;
  border-color: #fde047;
  color: #ca8a04;
  font-weight: 600;
}

.voices-scroll-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-right: 2px;
  min-height: 280px;
}

.voice-card-item {
  display: flex;
  align-items: center;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  padding: 8px;
  transition: all 0.15s;
}

.voice-card-item:hover {
  background: #ffffff;
  border-color: #cbd5e1;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
}

.voice-card-item.chosen {
  background: #e7f5ef;
  border-color: #0b8f69;
}

.voice-select-area {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  text-align: left;
  background: transparent;
  padding: 0;
  min-width: 0;
}

.voice-monogram {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: #e2e8f0;
  color: #475569;
  font-size: 10px;
  font-weight: 800;
  font-family: ui-monospace, monospace;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.voice-monogram.auto {
  background: #c8ebdc;
  color: #065f46;
}

.voice-card-item.chosen .voice-monogram {
  background: #0b8f69;
  color: #ffffff;
}

.voice-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.voice-meta strong {
  font-size: 12px;
  color: var(--text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.voice-meta small {
  font-size: 11px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 3px;
}

.dot-sep {
  color: #cbd5e1;
}

.tag-service {
  font-size: 10px;
  color: #64748b;
}

.tag-default {
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 3px;
  background: #dbeafe;
  color: #1d4ed8;
  font-weight: 600;
}

.check-icon {
  color: #0b8f69;
  flex-shrink: 0;
  margin-right: 4px;
}

.star-icon-btn {
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  border-radius: 4px;
  color: #cbd5e1;
  transition: all 0.15s;
}

.star-icon-btn:hover,
.star-icon-btn.favorited {
  color: #f59e0b;
}

.catalog-empty-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 10px;
  text-align: center;
  gap: 8px;
  color: var(--text-muted);
}

.empty-icon {
  color: #cbd5e1;
}

.catalog-empty-box strong {
  font-size: 12px;
}

.reload-btn {
  font-size: 12px;
  color: #0b8f69;
  font-weight: 600;
}

.no-filter-match {
  text-align: center;
  font-size: 12px;
  color: var(--text-muted);
  padding: 30px 0;
}

.catalog-footer {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-top: 10px;
  border-top: 1px solid #f1f5f9;
  font-size: 11px;
  color: var(--text-muted);
}

.engine-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #94a3b8;
}

.engine-dot.online {
  background: #0b8f69;
}
</style>
