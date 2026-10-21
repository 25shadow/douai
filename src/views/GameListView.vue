<template>
  <section class="page">
    <div class="page-heading">
      <div><span class="eyebrow">GAME LIST</span><h1>选择游戏</h1><p>每个游戏拥有独立的配置和运行模块。</p></div>
      <span class="count">01 / 01</span>
    </div>
    <button class="game-card" @click="$emit('open-quiz')">
      <div class="game-art"><span>Q</span><i></i><i></i><i></i></div>
      <div class="game-copy"><span class="status">AVAILABLE</span><h2>知识问答</h2><p>观众通过直播间弹幕发送 A、B、C、D 参与答题，实时累计积分并生成排行榜。</p><div class="tags"><span>弹幕驱动</span><span>自动运行</span><span>语音可用</span></div></div>
      <span class="arrow">进入配置 →</span>
    </button>
  </section>
</template>
<script setup lang="ts">
defineEmits<{ 'open-quiz': [] }>();
</script>
<style scoped>
.page { min-height: 100%; padding: 56px clamp(24px, 6vw, 92px); max-width: 1220px; margin: 0 auto; }
.page-heading { display:flex; align-items:flex-end; justify-content:space-between; margin-bottom:42px; }
.eyebrow { color:var(--accent-2); font-size:11px; letter-spacing:.16em; font-weight:700; }
h1 { margin:12px 0 8px; font-size:clamp(32px,4vw,54px); letter-spacing:-.04em; } p { margin:0; color:var(--muted); }
.count { color:var(--muted); font: 12px ui-monospace, monospace; }
.game-card { position:relative; display:grid; grid-template-columns:220px 1fr auto; gap:28px; width:100%; text-align:left; border:1px solid var(--line); border-radius:14px; padding:18px; color:var(--ink); background:var(--panel); transition:.25s ease; }
.game-card:hover { border-color:rgba(184,239,117,.45); transform:translateY(-3px); box-shadow:0 18px 50px rgba(0,0,0,.22); }
.game-art { min-height:190px; position:relative; overflow:hidden; display:grid; place-items:center; border-radius:9px; background:linear-gradient(135deg,#24352c,#101917); }
.game-art span { z-index:1; font-size:94px; color:var(--accent); font-weight:900; letter-spacing:-.1em; }
.game-art i { position:absolute; width:130px; height:1px; background:rgba(184,239,117,.4); transform:rotate(-45deg); } .game-art i:nth-child(2){top:35px;left:-20px}.game-art i:nth-child(3){bottom:45px;right:-10px}.game-art i:nth-child(4){top:78px;right:-35px}
.game-copy { padding:12px 0; } .status { color:var(--accent-2); font-size:10px; letter-spacing:.15em; font-weight:700; } h2 { margin:13px 0 9px; font-size:28px; } .game-copy p { max-width:520px; line-height:1.7; font-size:14px; }
.tags { display:flex; gap:7px; margin-top:22px; flex-wrap:wrap; } .tags span { padding:6px 9px; border:1px solid var(--line); border-radius:5px; color:var(--muted); font-size:11px; }
.arrow { align-self:center; color:var(--accent); font-size:13px; white-space:nowrap; }
@media (max-width:760px){.game-card{grid-template-columns:1fr}.game-art{min-height:130px}.arrow{align-self:start}}
</style>
<style scoped>
.page h1{margin:8px 0 5px;font-size:27px;letter-spacing:0}
.game-card{grid-template-columns:130px 1fr auto;border-radius:8px;padding:12px;gap:20px}
.game-art{min-height:116px;border-radius:5px}
.game-art span{font-size:58px}
.game-copy h2{font-size:19px}
.game-copy p{font-size:12px}
.tags{margin-top:14px}
@media(max-width:760px){.game-card{grid-template-columns:1fr}.game-art{min-height:90px}}
</style>
