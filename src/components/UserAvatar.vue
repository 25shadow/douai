<template>
  <span class="user-avatar">
    <img v-if="src && !failed" :src="src" :alt="`${name || '观众'}的头像`" referrerpolicy="no-referrer" @error="failed = true" />
    <span v-else aria-hidden="true">{{ [...(name || '观众')][0] }}</span>
  </span>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue';
const props = defineProps<{ src?: string; name?: string }>();
const failed = ref(false);
watch(() => props.src, () => { failed.value = false; });
</script>
<style scoped>
.user-avatar{display:grid;place-items:center;flex:0 0 28px;width:28px;height:28px;border-radius:5px;overflow:hidden;color:#152018;background:var(--accent);font-weight:800;font-size:11px}.user-avatar img{display:block;width:100%;height:100%;object-fit:cover}
</style>
