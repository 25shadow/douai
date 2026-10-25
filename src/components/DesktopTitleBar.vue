<template>
  <header class="desktop-titlebar" data-tauri-drag-region>
    <!-- 左侧软件品牌信息 -->
    <div class="brand-area" data-tauri-drag-region>
      <div class="brand-icon">
        <Sparkles class="icon" :size="16" />
      </div>
      <div class="brand-text">
        <span class="app-name">AI 自动播</span>
        <span class="app-edition">Desktop</span>
      </div>
    </div>

    <!-- 中间状态指示胶囊 -->
    <div class="status-center" data-tauri-drag-region>
      <!-- 直播间状态 -->
      <div class="status-pill room-pill" :class="connectionClass">
        <span class="status-dot"></span>
        <span class="status-text">{{ connectionLabel }}</span>
      </div>
    </div>

    <!-- 右侧功能与窗口控制按钮 -->
    <div class="window-actions no-drag">
      <!-- 原生窗口控制按钮 (最小化、最大化、关闭) -->
      <div class="window-controls">
        <button class="win-btn win-min" type="button" title="最小化" @click="handleMinimize">
          <Minus :size="13" />
        </button>
        <button class="win-btn win-max" type="button" :title="isMaximized ? '还原' : '最大化'" @click="handleMaximize">
          <Square :size="11" />
        </button>
        <button class="win-btn win-close" type="button" title="关闭" @click="handleClose">
          <X :size="13" />
        </button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Sparkles, Crown, Tv, Minus, Square, X } from '@lucide/vue';
import { liveState, simulationState } from '@/stores/liveStore';

const props = defineProps<{
  obsWindowVisible: boolean;
}>();

defineEmits<{
  'open-license': [];
  'toggle-obs-window': [];
}>();

const isMaximized = ref(false);

const connectionClass = computed(() => {
  if (simulationState.active) return 'simulation';
  return liveState.connection;
});

const connectionLabel = computed(() => {
  if (simulationState.active) return '模拟直播中 (Demo)';
  if (liveState.connection === 'live') {
    return `已连接直播间 ${liveState.roomId ? `(${liveState.roomId})` : ''}`;
  }
  if (liveState.connection === 'connecting') return '正在连接直播间…';
  if (liveState.connection === 'error') return '连接异常';
  return '未连接直播间';
});

// Tauri 原生窗口控制兼容
async function getTauriWindow() {
  try {
    const tauri = (window as unknown as { __TAURI__?: { window?: { getCurrentWindow?: () => unknown } } }).__TAURI__;
    if (tauri?.window?.getCurrentWindow) {
      return tauri.window.getCurrentWindow() as {
        minimize: () => Promise<void>;
        toggleMaximize: () => Promise<void>;
        close: () => Promise<void>;
      };
    }
  } catch {
    // ignore
  }
  return null;
}

async function handleMinimize() {
  const win = await getTauriWindow();
  if (win) {
    await win.minimize();
  }
}

async function handleMaximize() {
  const win = await getTauriWindow();
  if (win) {
    await win.toggleMaximize();
    isMaximized.value = !isMaximized.value;
  } else {
    isMaximized.value = !isMaximized.value;
    if (isMaximized.value) {
      void document.documentElement.requestFullscreen?.();
    } else {
      void document.exitFullscreen?.();
    }
  }
}

async function handleClose() {
  const win = await getTauriWindow();
  if (win) {
    await win.close();
  } else {
    if (window.confirm('确定要退出 DouAi 自动播软件吗？')) {
      window.close();
    }
  }
}
</script>

<style scoped>
.desktop-titlebar {
  height: var(--titlebar-height);
  background: #ffffff;
  border-bottom: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px 0 16px;
  user-select: none;
  flex-shrink: 0;
  z-index: 100;
}

.brand-area {
  display: flex;
  align-items: center;
  gap: 8px;
}

.brand-icon {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%);
  display: grid;
  place-items: center;
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(139, 92, 246, 0.3);
}

.brand-text {
  display: flex;
  align-items: baseline;
  gap: 5px;
}

.app-name {
  font-size: 14px;
  font-weight: 700;
  color: #1e293b;
  letter-spacing: -0.02em;
}

.app-edition {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 4px;
  background: #f1f5f9;
  color: #64748b;
  font-family: ui-monospace, monospace;
}

.status-center {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.room-pill {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  color: #64748b;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #94a3b8;
}

.room-pill.live {
  background: #ecfdf5;
  border-color: #a7f3d0;
  color: #065f46;
}
.room-pill.live .status-dot {
  background: #10b981;
  box-shadow: 0 0 6px rgba(16, 185, 129, 0.6);
}

.room-pill.simulation {
  background: #f5f3ff;
  border-color: #ddd6fe;
  color: #5b21b6;
}
.room-pill.simulation .status-dot {
  background: #8b5cf6;
  box-shadow: 0 0 6px rgba(139, 92, 246, 0.6);
}

.room-pill.connecting {
  background: #fffbeb;
  border-color: #fde68a;
  color: #92400e;
}
.room-pill.connecting .status-dot {
  background: #f59e0b;
}

.vip-pill {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #15803d;
  cursor: pointer;
}
.vip-pill:hover {
  background: #dcfce7;
  border-color: #86efac;
}
.vip-icon {
  color: #16a34a;
}

.window-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.obs-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #334155;
  transition: all 0.15s ease;
}

.obs-toggle-btn:hover {
  background: #f8fafc;
  border-color: #94a3b8;
}

.obs-toggle-btn.active {
  background: #ecfdf5;
  border-color: #10b981;
  color: #065f46;
  font-weight: 600;
}

.window-controls {
  display: flex;
  align-items: center;
  gap: 2px;
}

.win-btn {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: 6px;
  color: #64748b;
  transition: all 0.15s ease;
}

.win-btn:hover {
  background: #f1f5f9;
  color: #1e293b;
}

.win-close:hover {
  background: #fee2e2;
  color: #ef4444;
}
</style>
