<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { quizProgress, quizRuntimeSettings, quizState } from '@/game/quiz/quizStore';
import { getQuizRank } from '@/game/quiz/quizRules';
import { liveState, simulationState } from '@/stores/liveStore';
import { normalizeQuizTheme, readQuizTheme, subscribeQuizTheme } from '@/game/quiz/quizThemes';

const props = defineProps<{ outputOnly?: boolean }>();
const options = ['A', 'B', 'C', 'D'] as const;
const colors: Record<(typeof options)[number], string> = {
  A: 'coral', B: 'cyan', C: 'lime', D: 'gold'
};
const answerStats = computed(() => options.map(option => {
  const userIds = Object.keys(quizState.answers).filter(id => quizState.answers[id] === option);
  return {
    option,
    color: colors[option],
    text: quizState.question.options[option],
    count: userIds.length,
    names: userIds.slice(-4).reverse().map(id => quizState.players[id]?.name || '观众')
  };
}));
const leaders = computed(() => Object.entries(quizState.players)
  .sort((a, b) => b[1].score - a[1].score)
  .slice(0, 8));
const totalAnswers = computed(() => answerStats.value.reduce((sum, item) => sum + item.count, 0));
const topAnswerCount = computed(() => Math.max(1, ...answerStats.value.map(item => item.count)));
const nextLikeThreshold = computed(() => quizRuntimeSettings.likeRules
  .filter(rule => rule.effect !== 'none' && rule.threshold > 0)
  .sort((a, b) => a.threshold - b.threshold)[0]?.threshold || 0);
const likeProgress = computed(() => nextLikeThreshold.value
  ? Math.min(100, quizState.likes / nextLikeThreshold.value * 100)
  : 0);
const displayTime = computed(() => quizState.phase === 'idle' ? quizRuntimeSettings.answerTime : quizState.timeLeft);
const timeProgress = computed(() => Math.min(100, displayTime.value / Math.max(1, quizRuntimeSettings.answerTime) * 100));
const theme = computed(() => normalizeQuizTheme(quizRuntimeSettings.theme));
let unsubscribeTheme = () => {};

onMounted(() => {
  const storedTheme = readQuizTheme();
  if (storedTheme) quizRuntimeSettings.theme = storedTheme;
  unsubscribeTheme = subscribeQuizTheme(value => { quizRuntimeSettings.theme = value; });
});
onBeforeUnmount(() => unsubscribeTheme());
</script>

<template>
  <main class="broadcast" :class="[theme, { 'output-only': props.outputOnly }]">
    <template v-if="theme === 'arena'">
      <header class="arena-header">
        <div class="brand"><strong>答题竞赛</strong><small>DOUAI · LIVE QUIZ</small></div>
        <div class="header-stats"><span>{{ liveState.audience || 0 }} 位观众</span><span>{{ simulationState.active ? '模拟直播' : liveState.connection === 'live' ? '直播中' : '待开播' }}</span></div>
      </header>
      <div class="arena-grid">
        <section class="arena-main">
          <section class="arena-question">
            <div class="arena-meta"><span>第 {{ quizProgress }} 题</span><span>{{ quizRuntimeSettings.bank }}</span><b>{{ quizState.running ? '进行中' : '即将开始' }}</b></div>
            <h1>{{ quizState.question.title }}</h1>
            <div class="arena-choices">
              <article v-for="item in answerStats" :key="item.option" class="arena-choice" :class="item.color">
                <b>{{ item.option }}</b><span>{{ item.text }}</span>
              </article>
            </div>
          </section>
          <section class="arena-timer">
            <div><span>答题倒计时</span><strong>{{ displayTime }}<small>秒</small></strong></div>
            <i><b :style="{ width: `${timeProgress}%` }"></b></i>
          </section>
          <section class="arena-results">
            <article v-for="item in answerStats" :key="item.option" :class="item.color">
              <header><span>{{ item.option }}</span><strong>{{ item.count }}<small>人</small></strong></header>
              <p>{{ item.names.join('、') || '等待弹幕回答' }}</p>
            </article>
          </section>
          <section class="arena-likes">
            <div><span>点赞助力</span><strong>{{ new Intl.NumberFormat('zh-CN').format(quizState.likes) }}<small v-if="nextLikeThreshold"> / {{ nextLikeThreshold }}</small></strong></div>
            <i><b :style="{ width: `${likeProgress}%` }"></b></i>
            <p>{{ quizState.assistMessage || (nextLikeThreshold ? `达到 ${nextLikeThreshold} 赞触发助力` : '互动进行中') }}</p>
          </section>
        </section>
        <aside class="arena-board">
          <header><strong>领先榜</strong><small>答对积分</small></header>
          <div v-if="leaders.length" class="arena-rank-list">
            <div v-for="([id, player], index) in leaders" :key="id">
              <span :class="{ top: index < 3 }">{{ String(index + 1).padStart(2, '0') }}</span>
              <strong>{{ player.name }}</strong><small>{{ getQuizRank(player.score) }}</small><b>{{ player.score }}</b>
            </div>
          </div>
          <p v-else class="board-empty">答题后登上榜单</p>
          <footer>本题 {{ totalAnswers }} 人参与</footer>
        </aside>
      </div>
      <footer class="arena-footer"><strong>发送 A / B / C / D 参与答题</strong><span>{{ quizState.status }}</span></footer>
    </template>

    <template v-else-if="theme === 'neon'">
      <header class="neon-header">
        <span class="neon-mark">LIVE / 03</span>
        <div><strong>知识闪电战</strong><small>QUICKFIRE QUIZ</small></div>
        <span class="neon-audience"><i></i>{{ liveState.audience || 0 }}</span>
      </header>
      <section class="neon-question">
        <div class="neon-kicker"><span>QUESTION {{ String(quizState.questionIndex + 1).padStart(2, '0') }}</span><b>{{ quizState.running ? 'LIVE ROUND' : 'GET READY' }}</b></div>
        <h1>{{ quizState.question.title }}</h1>
        <div class="neon-meter"><i :style="{ width: `${timeProgress}%` }"></i></div>
        <div class="neon-clock"><strong>{{ String(Math.floor(displayTime / 60)).padStart(2, '0') }}:{{ String(displayTime % 60).padStart(2, '0') }}</strong><span>剩余作答时间</span></div>
      </section>
      <section class="neon-answers">
        <article v-for="item in answerStats" :key="item.option" :class="item.color">
          <div class="neon-answer-copy"><b>{{ item.option }}</b><strong>{{ item.text }}</strong><span>{{ item.count }} 人选择</span></div>
          <i><em :style="{ width: `${item.count / topAnswerCount * 100}%` }"></em></i>
        </article>
      </section>
      <section class="neon-community">
        <div class="neon-likes"><span>LIKE POWER</span><strong>{{ new Intl.NumberFormat('zh-CN').format(quizState.likes) }}</strong><i><b :style="{ width: `${likeProgress}%` }"></b></i><small>{{ quizState.assistMessage || (nextLikeThreshold ? `距离助力还差 ${Math.max(0, nextLikeThreshold - quizState.likes)} 赞` : '感谢每一份互动') }}</small></div>
        <div class="neon-leaders"><header><span>TOP PLAYERS</span><small>{{ quizProgress }}</small></header>
          <div v-if="leaders.length">
            <p v-for="([id, player], index) in leaders.slice(0, 5)" :key="id"><b>{{ String(index + 1).padStart(2, '0') }}</b><strong>{{ player.name }}</strong><span>{{ player.score }} PTS</span></p>
          </div><p v-else class="neon-empty">首位答对者即将登榜</p>
        </div>
      </section>
      <footer class="neon-footer"><strong>发弹幕选择答案</strong><span>A　B　C　D</span></footer>
    </template>

    <template v-else>
      <header class="classroom-header">
        <div><span>知识现场　/　{{ quizRuntimeSettings.bank }}</span><strong>一起想一想</strong></div>
        <div class="classroom-live"><i></i>{{ liveState.audience || 0 }} 人在线</div>
      </header>
      <section class="classroom-question">
        <div class="classroom-count"><span>问题 {{ String(quizState.questionIndex + 1).padStart(2, '0') }}</span><span>{{ quizProgress }}</span></div>
        <h1>{{ quizState.question.title }}</h1>
        <div class="classroom-timer"><span>作答时间</span><strong>{{ displayTime }}<small>秒</small></strong><i><b :style="{ width: `${timeProgress}%` }"></b></i></div>
      </section>
      <div class="classroom-content">
        <section class="classroom-answers">
          <header><strong>大家的选择</strong><span>{{ totalAnswers }} 份回答</span></header>
          <article v-for="item in answerStats" :key="item.option" :class="item.color">
            <span class="classroom-letter">{{ item.option }}</span>
            <div><strong>{{ item.text }}</strong><small>{{ item.names.join('、') || '等待你的答案' }}</small></div>
            <b>{{ item.count }}</b>
          </article>
        </section>
        <aside class="classroom-board">
          <header><span>本场积分</span><strong>答题榜</strong></header>
          <div v-if="leaders.length">
            <article v-for="([id, player], index) in leaders.slice(0, 8)" :key="id"><span>{{ String(index + 1).padStart(2, '0') }}</span><strong>{{ player.name }}</strong><b>{{ player.score }}</b></article>
          </div><p v-else>答对题目后，名字会出现在这里。</p>
          <footer>累计答对 {{ quizState.correctCount }} 题</footer>
        </aside>
      </div>
      <section class="classroom-like">
        <div><strong>一起点亮助力</strong><span>{{ quizState.assistMessage || (nextLikeThreshold ? `下一档 ${nextLikeThreshold} 赞` : '感谢大家参与') }}</span></div>
        <strong>{{ new Intl.NumberFormat('zh-CN').format(quizState.likes) }}<small> 赞</small></strong>
        <i><b :style="{ width: `${likeProgress}%` }"></b></i>
      </section>
      <footer class="classroom-footer"><strong>{{ quizState.status }}</strong><span>发送 A / B / C / D 参与答题</span></footer>
    </template>
  </main>
</template>

<style scoped>
.broadcast{position:relative;isolation:isolate;display:flex;flex-direction:column;gap:25px;width:1080px;height:1920px;overflow:hidden;padding:54px 60px 48px;font-family:'Douyin Sans','Microsoft YaHei',sans-serif}
.broadcast:before{position:absolute;inset:0;z-index:-1;content:''}
.arena{color:#f2f1ec;background:#050606}.arena:before{background:radial-gradient(ellipse at 30% 0,rgba(101,90,8,.12),transparent 34%),#050606}
.arena-header{display:flex;justify-content:space-between;align-items:center;min-height:76px;padding:0 6px}.brand strong{display:block;color:#ffd500;font-size:44px;font-weight:900;text-shadow:0 0 18px rgba(255,213,0,.3)}.brand small{display:block;margin-top:3px;color:#777;font:12px ui-monospace,monospace}.header-stats{display:flex;gap:17px;color:#aaa;font-size:15px}
.arena-grid{display:grid;grid-template-columns:minmax(0,1.8fr) minmax(270px,.9fr);gap:14px;flex:1;min-height:0}.arena-main{display:flex;flex-direction:column;gap:12px;min-width:0;min-height:0}.arena-question,.arena-timer,.arena-results article,.arena-likes,.arena-board{border:1px solid #343434;border-radius:10px;background:#111}.arena-question{padding:19px 20px}.arena-meta{display:flex;align-items:center;gap:9px;margin-bottom:12px}.arena-meta span,.arena-meta b{padding:6px 9px;border-radius:4px;color:#ffe000;background:#282510;font-size:12px}.arena-meta span:nth-child(2){color:#d6d6d6;background:#242424}.arena-meta b{margin-left:auto;color:#62e6a4;background:#123426}.arena-question h1{min-height:86px;margin:0 0 16px;text-align:center;font-size:28px;line-height:1.5;overflow-wrap:anywhere}.arena-choices,.arena-results{display:grid;grid-template-columns:1fr 1fr;gap:8px}.arena-choice{display:flex;align-items:center;gap:10px;min-height:72px;padding:10px 12px;border:1px solid #343434;border-radius:7px;background:#191919}.arena-choice>b{display:grid;place-items:center;flex:0 0 38px;width:38px;aspect-ratio:1;border-radius:50%;color:#101010;font-size:19px}.arena-choice>span{font-size:16px;line-height:1.5;overflow-wrap:anywhere}.coral.arena-choice>b,.coral .classroom-letter{background:#ff695f}.cyan.arena-choice>b{background:#47d8d4}.lime.arena-choice>b{background:#b8e75a}.gold.arena-choice>b{background:#efc544}
.arena-timer{padding:12px 16px}.arena-timer>div{display:flex;justify-content:space-between;align-items:center;color:#b9b9b9;font-size:13px}.arena-timer>div strong{color:#fff;font-size:21px}.arena-timer small{margin-left:4px;color:#999;font-size:11px}.arena-timer>i,.arena-likes>i{display:block;height:10px;margin-top:9px;overflow:hidden;border-radius:12px;background:#2d2d2d}.arena-timer>i>b,.arena-likes>i>b,.classroom-timer i>b,.classroom-like i>b,.neon-meter i,.neon-likes i>b{display:block;height:100%;border-radius:inherit;background:#b8e75a;transition:width .3s}
.arena-results{grid-template-rows:1fr 1fr;flex:1;min-height:0}.arena-results article{min-height:0;padding:12px;border-left:3px solid #555}.arena-results article.coral{border-left-color:#ff695f}.arena-results article.cyan{border-left-color:#47d8d4}.arena-results article.lime{border-left-color:#b8e75a}.arena-results article.gold{border-left-color:#efc544}.arena-results header{display:flex;justify-content:space-between;align-items:center}.arena-results header>span{font-size:15px}.arena-results header>strong{font-size:21px}.arena-results header small{margin-left:3px;color:#999;font-size:10px}.arena-results p{margin:9px 0 0;color:#999;font-size:11px;line-height:1.5;overflow-wrap:anywhere}
.arena-likes{padding:12px 15px}.arena-likes>div{display:flex;justify-content:space-between;color:#bbb;font-size:13px}.arena-likes>div strong{color:#fff}.arena-likes small{color:#999;font-size:11px}.arena-likes>i{height:8px}.arena-likes>p{margin:7px 0 0;color:#888;font-size:10px}
.arena-board{display:flex;flex-direction:column;min-height:0;padding:15px 13px}.arena-board>header{display:flex;justify-content:space-between;align-items:center;padding-bottom:12px;border-bottom:1px solid #292929}.arena-board>header strong{font-size:17px}.arena-board>header small{color:#929292;font-size:10px}.arena-rank-list{display:grid;align-content:start;overflow:hidden}.arena-rank-list>div{display:grid;grid-template-columns:26px minmax(0,1fr) auto 24px;align-items:center;gap:7px;min-height:51px;border-bottom:1px solid #242424}.arena-rank-list span{color:#858585;font:12px ui-monospace,monospace}.arena-rank-list span.top{color:#ffd500}.arena-rank-list strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}.arena-rank-list small{color:#888;font-size:9px}.arena-rank-list b{color:#ffe000;text-align:right;font-size:13px}.board-empty{display:grid;place-items:center;flex:1;color:#777;font-size:12px}.arena-board>footer{margin-top:auto;padding-top:12px;border-top:1px solid #292929;color:#888;font-size:10px}.arena-footer{display:flex;justify-content:space-between;align-items:center;padding:12px 7px 0;border-top:1px solid #262626;color:#888;font-size:11px}.arena-footer strong{color:#e5d78b;font-size:13px}

.neon{gap:30px;color:#f5f8f5;background:#071518}.neon:before{background:radial-gradient(ellipse at 50% 26%,rgba(24,139,137,.22),transparent 48%),linear-gradient(160deg,#071518,#101923 58%,#181123)}.neon-header{display:flex;align-items:center;justify-content:space-between;min-height:90px;padding:0 4px;border-bottom:1px solid rgba(86,237,219,.26)}.neon-header>div{text-align:center}.neon-header>div strong,.neon-header>div small{display:block}.neon-header>div strong{font-size:29px;letter-spacing:0}.neon-header>div small,.neon-mark{color:#57f2df;font:11px ui-monospace,monospace}.neon-mark{padding:9px 11px;border:1px solid #287e7b;border-radius:3px}.neon-audience{display:flex;align-items:center;gap:8px;color:#c3d0ce;font:14px ui-monospace,monospace}.neon-audience i,.classroom-live i{width:8px;height:8px;border-radius:50%;background:#57f2df;box-shadow:0 0 10px #57f2df}.neon-question{position:relative;display:grid;align-content:center;justify-items:center;min-height:400px;padding:48px 40px;border:1px solid rgba(87,242,223,.35);border-radius:16px;background:linear-gradient(130deg,rgba(87,242,223,.06),rgba(217,80,208,.08))}.neon-kicker{display:flex;gap:14px;align-items:center;color:#57f2df;font:12px ui-monospace,monospace}.neon-kicker b{padding:6px 9px;border:1px solid rgba(217,80,208,.6);border-radius:3px;color:#ee83e6;font-size:10px}.neon-question h1{max-width:850px;min-height:135px;margin:26px 0;text-align:center;font-size:45px;line-height:1.45;overflow-wrap:anywhere}.neon-meter{width:84%;height:8px;overflow:hidden;border-radius:9px;background:#243234}.neon-meter i{background:linear-gradient(90deg,#57f2df,#d950d0)}.neon-clock{display:flex;align-items:baseline;gap:10px;margin-top:14px}.neon-clock strong{color:#fff;font:34px ui-monospace,monospace}.neon-clock span{color:#94abaa;font-size:12px}.neon-answers{display:grid;grid-template-columns:1fr 1fr;gap:14px}.neon-answers article{display:flex;justify-content:space-between;align-items:center;min-height:178px;padding:24px;border:1px solid rgba(186,213,209,.2);border-radius:10px;background:rgba(10,22,25,.72)}.neon-answers article.coral{border-color:rgba(255,105,95,.65)}.neon-answers article.cyan{border-color:rgba(71,216,212,.65)}.neon-answers article.lime{border-color:rgba(184,231,90,.65)}.neon-answers article.gold{border-color:rgba(239,197,68,.65)}.neon-answer-copy{display:grid;gap:10px;min-width:0}.neon-answer-copy>b{color:#57f2df;font:12px ui-monospace,monospace}.neon-answer-copy>strong{font-size:19px;overflow-wrap:anywhere}.neon-answer-copy>span{color:#94abaa;font-size:11px}.neon-answers article>i{flex:0 0 42px;width:42px;height:42px;display:grid;place-items:center;border:1px solid #d950d0;border-radius:50%;font-style:normal}.neon-answers article>i:after{content:'+';color:#ee83e6;font-size:19px}.neon-community{display:grid;grid-template-columns:.85fr 1.15fr;gap:16px;flex:1;min-height:0}.neon-likes,.neon-leaders{padding:20px;border:1px solid rgba(186,213,209,.19);border-radius:10px;background:rgba(7,20,23,.75)}.neon-likes{display:flex;flex-direction:column;justify-content:center}.neon-likes>span,.neon-leaders>header>span{color:#57f2df;font:11px ui-monospace,monospace}.neon-likes>strong{margin:12px 0;color:#fff;font:42px ui-monospace,monospace}.neon-likes>i{height:8px;overflow:hidden;border-radius:8px;background:#243234}.neon-likes>small{margin-top:11px;color:#9fb0ae;font-size:11px;line-height:1.6}.neon-likes i>b{background:#d950d0}.neon-leaders>header{display:flex;justify-content:space-between;padding-bottom:11px;border-bottom:1px solid rgba(186,213,209,.19)}.neon-leaders>header small{color:#9fb0ae;font-size:10px}.neon-leaders>div p{display:grid;grid-template-columns:28px 1fr auto;gap:8px;align-items:center;min-height:44px;margin:0;border-bottom:1px solid rgba(186,213,209,.1)}.neon-leaders>div p b{color:#ee83e6;font:11px ui-monospace,monospace}.neon-leaders>div p strong{font-size:12px}.neon-leaders>div p span{color:#57f2df;font:10px ui-monospace,monospace}.neon-empty{color:#829391;font-size:11px}.neon-footer{display:flex;justify-content:space-between;padding:14px 5px 0;border-top:1px solid rgba(86,237,219,.26);color:#91a7a4;font-size:12px}.neon-footer strong{color:#57f2df}

.classroom{gap:24px;color:#183a34;background:#edf4f0}.classroom:before{background:radial-gradient(circle at 95% 8%,rgba(31,126,103,.09),transparent 24%),#edf4f0}.classroom-header{display:flex;justify-content:space-between;align-items:center;min-height:104px;padding:0 10px;border-bottom:1px solid #bdcec6}.classroom-header>div:first-child{display:grid;gap:7px}.classroom-header>div:first-child span{color:#6e8980;font-size:12px}.classroom-header>div:first-child strong{font:700 28px/1.2 Georgia,'Songti SC',serif}.classroom-live{display:flex;align-items:center;gap:9px;padding:9px 12px;border:1px solid #c8d8d0;border-radius:3px;color:#45655b;font-size:12px}.classroom-live i{background:#1c9a75;box-shadow:none}.classroom-question{position:relative;padding:28px 35px 34px;border:1px solid #c8d8d0;background:#f8fbf9}.classroom-count{display:flex;justify-content:space-between;color:#21836a;font:12px ui-monospace,monospace}.classroom-question h1{min-height:190px;margin:26px 0;text-align:left;font:700 40px/1.5 Georgia,'Songti SC',serif;overflow-wrap:anywhere}.classroom-timer{display:grid;grid-template-columns:1fr auto;align-items:center;gap:8px;color:#55756b;font-size:12px}.classroom-timer strong{color:#183a34;font:30px ui-monospace,monospace}.classroom-timer small{margin-left:4px;font-size:11px}.classroom-timer i{grid-column:1/-1;height:7px;overflow:hidden;border-radius:1px;background:#dbe7e1}.classroom-timer i>b{background:#e26d54}.classroom-content{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(260px,.7fr);gap:22px;flex:1;min-height:0}.classroom-answers{display:flex;flex-direction:column;gap:9px;min-height:0}.classroom-answers>header{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}.classroom-answers>header strong{font:700 19px Georgia,'Songti SC',serif}.classroom-answers>header span{color:#6e8980;font-size:11px}.classroom-answers>article{display:flex;align-items:center;gap:13px;min-height:124px;padding:13px 16px;border-bottom:1px solid #c8d8d0;background:rgba(248,251,249,.72)}.classroom-letter{display:grid;place-items:center;flex:0 0 42px;width:42px;aspect-ratio:1;border-radius:50%;color:#fff;font-size:16px}.classroom-answers article.cyan .classroom-letter{background:#238e95}.classroom-answers article.lime .classroom-letter{background:#638e32}.classroom-answers article.gold .classroom-letter{background:#b77c1d}.classroom-answers article>div{display:grid;gap:7px;min-width:0;flex:1}.classroom-answers article>div strong{font-size:15px;overflow-wrap:anywhere}.classroom-answers article>div small{color:#738980;font-size:10px;overflow-wrap:anywhere}.classroom-answers article>b{color:#21836a;font:17px ui-monospace,monospace}.classroom-board{display:flex;flex-direction:column;min-height:0;padding:17px 18px;border-top:3px solid #21836a;background:#f8fbf9}.classroom-board>header{display:grid;gap:7px;padding-bottom:13px;border-bottom:1px solid #d3dfd9}.classroom-board>header span{color:#748c82;font-size:10px}.classroom-board>header strong{font:700 20px Georgia,'Songti SC',serif}.classroom-board>div{display:grid;align-content:start}.classroom-board>div article{display:grid;grid-template-columns:26px minmax(0,1fr) 28px;align-items:center;gap:7px;min-height:47px;border-bottom:1px solid #e1e9e5}.classroom-board>div article span{color:#879a92;font:11px ui-monospace,monospace}.classroom-board>div article strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}.classroom-board>div article b{color:#21836a;text-align:right}.classroom-board>p{margin:auto 0;color:#81938c;font-size:11px;line-height:1.7}.classroom-board>footer{margin-top:auto;padding-top:12px;border-top:1px solid #d3dfd9;color:#71867e;font-size:10px}.classroom-like{display:grid;grid-template-columns:1fr auto;gap:5px 18px;align-items:center;padding:15px 19px;border:1px solid #c8d8d0;background:#f8fbf9}.classroom-like>div{display:grid;gap:5px}.classroom-like>div strong{font:700 16px Georgia,'Songti SC',serif}.classroom-like>div span{color:#71867e;font-size:10px}.classroom-like>strong{color:#21836a;font:20px ui-monospace,monospace}.classroom-like>strong small{font-size:10px}.classroom-like>i{grid-column:1/-1;height:7px;overflow:hidden;background:#dbe7e1}.classroom-like i>b{background:#21836a}.classroom-footer{display:flex;justify-content:space-between;padding:12px 8px 0;border-top:1px solid #bdcec6;color:#71867e;font-size:11px}.classroom-footer strong{color:#45655b}
.output-only.broadcast{gap:25px}
</style>
