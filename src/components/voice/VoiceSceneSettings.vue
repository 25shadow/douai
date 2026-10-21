<template>
  <section class="scene-section">
    <div class="section-top"><div><h2>直播事件播报</h2><p>选择需要播报的互动，并编辑实际朗读内容</p></div><span>{{ enabledCount }} / {{ Object.keys(sceneNames).length }}</span></div>
    <article v-for="(name, key) in sceneNames" :key="key" class="scene-row">
      <div class="scene-head">
        <div><h3>{{ name }}</h3><p>{{ descriptions[key] }}</p></div>
        <label class="switch" :aria-label="`启用${name}`"><input v-model="config.scenes[key].enabled" type="checkbox" /><span></span></label>
      </div>
      <label class="template-label" :for="`template-${key}`">播报内容</label>
      <textarea :id="`template-${key}`" v-model="config.scenes[key].template" maxlength="300" :disabled="!config.scenes[key].enabled" />
      <div class="scene-foot">
        <div class="variables"><span>变量</span><code v-for="variable in variables[key]" :key="variable">{{ variable }}</code></div>
        <label class="cooldown">间隔 <input v-model.number="config.scenes[key].cooldownMs" type="number" min="0" max="60000" step="500" /> ms</label>
      </div>
    </article>
  </section>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { sceneNames, type LiveVoiceScene, type VoiceConfig } from '../../voice/voiceConfig';
const config = defineModel<VoiceConfig>({ required: true });
const enabledCount = computed(() => Object.values(config.value.scenes).filter(value => value.enabled).length);
const descriptions: Record<LiveVoiceScene, string> = {
  gift: '礼物连击结束时播报一次', like: '观众点赞时播报', follow: '新观众关注主播时播报',
  join: '观众进入直播间时播报', share: '观众分享直播间时播报'
};
const variables: Record<LiveVoiceScene, string[]> = {
  gift: ['{昵称}', '{礼物}', '{数量}'], like: ['{昵称}', '{点赞数}'],
  follow: ['{昵称}'], join: ['{昵称}'], share: ['{昵称}']
};
</script>
<style scoped>
.scene-section{margin-top:30px}.section-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}.section-top h2{font-size:15px;margin:0}.section-top p{font-size:11px;color:var(--faint);margin:6px 0 0}.section-top>span{font:11px ui-monospace,monospace;color:var(--muted)}.scene-row{padding:15px 0;border-top:1px solid var(--line)}.scene-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.scene-head h3{font-size:12px;font-weight:500;margin:0}.scene-head p{font-size:10px;color:var(--faint);margin:5px 0 0}.switch input{position:absolute;opacity:0}.switch span{display:block;width:30px;height:17px;border-radius:9px;background:#424c46;position:relative;cursor:pointer}.switch span:after{content:'';position:absolute;left:2px;top:2px;width:13px;height:13px;border-radius:50%;background:#dce7e0;transition:transform .15s}.switch input:checked+span{background:#679f8f}.switch input:checked+span:after{transform:translateX(13px)}.template-label{display:block;color:var(--muted);font-size:10px;margin-bottom:6px}textarea{display:block;width:100%;min-height:56px;resize:vertical;background:#141b18;border:1px solid var(--line);border-radius:4px;color:var(--ink);padding:9px;font:12px/1.7 'Douyin Sans','Microsoft YaHei',sans-serif;outline:0}textarea:focus{border-color:var(--accent)}textarea:disabled{opacity:.5}.scene-foot{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:9px}.variables{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.variables>span,.cooldown{font-size:10px;color:var(--faint)}.variables code{font:10px ui-monospace,monospace;color:var(--accent);background:#1b2923;padding:3px 5px;border-radius:3px}.cooldown{display:flex;align-items:center;gap:5px;white-space:nowrap}.cooldown input{width:62px;background:#141b18;border:1px solid var(--line);border-radius:4px;color:var(--ink);padding:5px;font:10px ui-monospace,monospace}
</style>
