<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { activeGameModule, registeredGames } from '@/game/gameRegistry';
import { loadConfig } from '@/services/configApi';

const winWidth = ref(window.innerWidth);
const winHeight = ref(window.innerHeight);

const canvasStyle = computed(() => ({
  transform: `scale(${winWidth.value / 1080}, ${winHeight.value / 1920})`,
  transformOrigin: 'top left',
  width: '1080px',
  height: '1920px'
}));

function updateWindowSize() {
  winWidth.value = window.innerWidth;
  winHeight.value = window.innerHeight;
}

onMounted(async () => {
  window.addEventListener('resize', updateWindowSize);
  updateWindowSize();

  try {
    const saved = await loadConfig();
    for (const module of registeredGames) {
      module.applySavedConfig(saved);
    }
  } catch {
    // The game display can use its built-in defaults when config is unavailable.
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateWindowSize);
});

</script>

<template>
  <main class="game-display-page">
    <div class="game-display-canvas" :style="canvasStyle">
      <component :is="activeGameModule.component" v-if="activeGameModule" :output-only="true" />
      <div v-else class="game-display-idle">
        <span>LIVE · 1080 × 1920</span>
        <strong>精彩互动即将开始</strong>
        <p>点点关注不迷路 · 准备好在评论区参与互动吧</p>
      </div>
    </div>
  </main>
</template>

<style scoped>
.game-display-page {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #030712;
  margin: 0;
  padding: 0;
}

.game-display-canvas {
  width: 1080px;
  height: 1920px;
  transform-origin: top left;
  flex-shrink: 0;
}

.game-display-idle {
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 14px;
  width: 1080px;
  height: 1920px;
  color: #e8eeea;
  background: #121a18;
  font-family: 'Douyin Sans', 'Microsoft YaHei', sans-serif;
}

.game-display-idle span {
  color: #89cfbd;
  font: 20px ui-monospace, monospace;
}

.game-display-idle strong {
  font-size: 42px;
}
</style>
