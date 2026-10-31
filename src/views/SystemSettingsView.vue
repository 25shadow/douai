<template>
  <div class="settings-page">
    <header class="page-top-header">
      <div class="header-titles">
        <span class="sub-category">SYSTEM CONFIGURATION</span>
        <h1>系统设置</h1>
        <p>配置 AI 大模型与本地软件运行环境偏好。</p>
      </div>
      <button class="save-settings-btn" :disabled="saving" @click="saveAll">
        <Save :size="15" />
        <span>{{ saving ? '正在保存…' : '保存系统设置' }}</span>
      </button>
    </header>

    <p v-if="statusMessage" class="status-banner" :class="{ error: isError }">
      {{ statusMessage }}
    </p>

    <!-- AI 大模型设置 -->
    <section class="settings-card">
      <div class="card-title-row">
        <div class="title-wrap">
          <Sparkles :size="18" class="icon-brand" />
          <h2>AI 智能大模型配置</h2>
        </div>
        <span class="sub-badge">用于自动化智能生成问答题库</span>
      </div>

      <div class="settings-fields-grid">
        <div class="field-item">
          <label for="ai-base-url">API 接口地址</label>
          <input 
            id="ai-base-url"
            v-model.trim="aiConfig.baseUrl" 
            type="text" 
            placeholder="https://api.openai.com/v1 或兼容地址" 
          />
          <small>支持 OpenAI / DeepSeek / 智谱 / Ollama 本地模型等 OpenAI 兼容接口</small>
        </div>

        <div class="field-item">
          <label for="ai-model">模型名称</label>
          <input 
            id="ai-model"
            v-model.trim="aiConfig.model" 
            type="text" 
            placeholder="gpt-4o-mini / deepseek-chat" 
          />
          <small>指定调用的模型标识名</small>
        </div>

        <div class="field-item full-width">
          <label for="ai-key">API 密钥 (API Key)</label>
          <input 
            id="ai-key"
            v-model.trim="aiConfig.apiKey" 
            type="password" 
            autocomplete="off"
            placeholder="sk-..." 
          />
          <small>密钥安全保存在本地 SQLite 数据库中，不上传任何第三方服务器</small>
        </div>
      </div>
    </section>

    <!-- 软件客户端关于信息 (Tauri Ready) -->
    <section class="settings-card">
      <div class="card-title-row">
        <div class="title-wrap">
          <Info :size="18" class="icon-brand" />
          <h2>关于 DouAi 智能直播软件</h2>
        </div>
        <span class="sub-badge">Tauri 轻量化桌面版本</span>
      </div>

      <div class="about-grid">
        <div class="about-item">
          <span>软件架构</span>
          <strong>Tauri 2.0 + Vue 3 + Vite + TypeScript</strong>
        </div>
        <div class="about-item">
          <span>当前版本</span>
          <strong>v1.2.0 Desktop (64-bit)</strong>
        </div>
        <div class="about-item">
          <span>配置存储</span>
          <strong>Local SQLite (config.db)</strong>
        </div>
        <div class="about-item">
          <span>音频管线</span>
          <strong>Web Audio API + Browser Native Speech</strong>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Sparkles, Info, Save } from '@lucide/vue';
import { loadConfig, saveConfig } from '@/services/configApi';

const saving = ref(false);
const statusMessage = ref('');
const isError = ref(false);
const aiConfig = ref({
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini'
});

onMounted(async () => {
  try {
    const config = await loadConfig();
    if (config.aiConfig) {
      aiConfig.value = { ...config.aiConfig };
    }
  } catch (err) {
    statusMessage.value = '未能加载本地配置，采用默认设置';
  }
});

async function saveAll() {
  saving.value = true;
  statusMessage.value = '';
  isError.value = false;
  try {
    const prev = await loadConfig();
    await saveConfig({
      ...prev,
      aiConfig: { ...aiConfig.value }
    });
    statusMessage.value = '系统配置已成功保存到本地 SQLite！';
  } catch (err) {
    isError.value = true;
    statusMessage.value = err instanceof Error ? err.message : '保存失败';
  } finally {
    saving.value = false;
  }
}

</script>

<style scoped>
.settings-page {
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
  color: #0b8f69;
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

.save-settings-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border-radius: 8px;
  background: #0b8f69;
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(11, 143, 105, 0.3);
  transition: all 0.15s;
}
.save-settings-btn:hover:not(:disabled) {
  background: #087a5a;
}
.save-settings-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.status-banner {
  padding: 10px 14px;
  border-radius: 8px;
  background: #e7f5ef;
  border: 1px solid #b8e3d0;
  color: #065f46;
  font-size: 13px;
  margin: 0;
}
.status-banner.error {
  background: #fef2f2;
  border-color: #fca5a5;
  color: #991b1b;
}

.settings-card {
  background: #ffffff;
  border-radius: var(--radius-md);
  border: 1px solid var(--line);
  padding: 20px;
  box-shadow: var(--card-shadow);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-brand {
  color: #0b8f69;
}

.title-wrap h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-main);
}

.sub-badge {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 4px;
  background: #f1f5f9;
  color: #64748b;
}

.settings-fields-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.field-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-item.full-width {
  grid-column: 1 / -1;
}

.field-item label {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
}

.field-item input {
  padding: 9px 12px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  font-size: 13px;
  outline: none;
  color: var(--text-main);
}

.field-item input:focus {
  border-color: #0b8f69;
  background: #ffffff;
  box-shadow: 0 0 0 2px rgba(11, 143, 105, 0.15);
}

.field-item small {
  font-size: 11px;
  color: var(--text-muted);
}

.about-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.about-item {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.about-item span {
  font-size: 11px;
  color: var(--text-muted);
}

.about-item strong {
  font-size: 13px;
  color: var(--text-main);
}

/* Strata page treatment */
.settings-page { background:#f3f4f2; }
.settings-page .settings-section, .settings-page .settings-card, .settings-page .about-card { border-color:#e3e5e1; border-radius:12px; box-shadow:0 1px 2px rgba(17,24,23,.04); }
.settings-page .primary-btn, .settings-page .save-btn { background:#0b8f69; border-color:#0b8f69; box-shadow:none; }
.settings-page .primary-btn:hover, .settings-page .save-btn:hover { background:#087a5a; }
</style>