<template>
  <div class="bgm-page">
    <section class="music-panel">
      <header class="music-header">
        <div class="music-title"><span class="title-dot"></span><h1>音乐</h1></div>
        <div class="track-count">共 {{ tracks.length }} 首</div>
      </header>

      <div class="music-toolbar">
        <button class="toolbar-btn primary" type="button" @click="togglePlaylist">
          <Pause v-if="isPlaying" :size="17" fill="currentColor" /><Play v-else :size="17" fill="currentColor" />
          {{ isPlaying ? '暂停' : '播放' }}
        </button>
        <button class="toolbar-btn" type="button" @click="stopPlayback"><Square :size="16" fill="currentColor" />停止</button>
        <button class="toolbar-btn" :class="{ selected: loopPlaylist }" type="button" @click="loopPlaylist = !loopPlaylist"><Repeat2 :size="17" />列表循环</button>
        <button class="toolbar-btn" type="button" @click="openFilePicker"><FolderOpen :size="17" />添加自己的音乐</button>
        <button class="toolbar-btn danger-action" type="button" :disabled="tracks.length === 0" @click="requestClearTracks"><Trash2 :size="16" />全部删除</button>
        <div class="toolbar-volume">
          <Volume2 :size="17" /><span>音量</span>
          <input v-model.number="masterVolume" type="range" min="0" max="1" step="0.05" @input="updateVolume" />
          <span class="volume-value">{{ Math.round(masterVolume * 100) }}%</span>
        </div>
      </div>

      <p v-if="libraryError" class="library-error" role="alert">{{ libraryError }}</p>
      <input ref="fileInput" class="file-input" type="file" accept="audio/*" multiple @change="handleFiles" />
      <div class="track-list" role="list">
        <div v-if="isLoading" class="empty-state"><Music2 :size="24" /><span>正在读取音乐列表…</span></div>
        <div v-else-if="tracks.length === 0" class="empty-state"><Music2 :size="24" /><span>还没有导入音乐，点击“添加自己的音乐”开始播放</span></div>
        <article v-for="(track, index) in tracks" :key="track.id" class="track-row" :class="{ active: currentTrackId === track.id }" role="listitem">
          <div class="track-name">
            <span class="track-index">{{ index + 1 }}.</span><Music2 :size="16" class="track-icon" /><span>{{ track.name }}</span>
            <span v-if="track.source === 'local'" class="local-tag">本地</span>
          </div>
          <div class="track-actions">
            <button class="row-btn play-btn" type="button" @click="playTrack(track.id)">
              <Pause v-if="currentTrackId === track.id && isPlaying" :size="15" fill="currentColor" /><Play v-else :size="15" fill="currentColor" />
              {{ currentTrackId === track.id && isPlaying ? '暂停' : '播放' }}
            </button>
            <button class="row-btn delete-btn" type="button" @click="requestDeleteTrack(track)"><X :size="15" />删除</button>
          </div>
        </article>
      </div>
    </section>

    <AppModal
      :open="showDeleteModal"
      :title="deleteTargetId ? '删除这首音乐？' : '清空音乐列表？'"
      :description="deleteTarget ? `将移除「${deleteTarget.name}」，这个操作无法撤销。` : `将删除当前列表中的 ${tracks.length} 首音乐，这个操作无法撤销。`"
      eyebrow="DELETE MUSIC"
      size="narrow"
      @close="closeDeleteModal"
    >
      <div class="delete-warning">
        <span class="warning-icon"><Trash2 :size="20" /></span>
        <div>
          <strong>{{ deleteTargetId ? '确认删除当前曲目' : '确认清空全部音乐' }}</strong>
          <p>{{ deleteTargetId ? '这首曲目将从音乐列表和本地存储中永久删除。' : '所有已导入曲目都将从音乐列表和本地存储中永久删除。' }}</p>
        </div>
      </div>
      <template #footer>
        <small>请确认你的操作</small>
        <div class="modal-actions">
          <button class="modal-cancel-btn" type="button" @click="closeDeleteModal">取消</button>
          <button class="modal-danger-btn" type="button" @click="confirmDeletion">确认删除</button>
        </div>
      </template>
    </AppModal>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { FolderOpen, Music2, Pause, Play, Repeat2, Square, Trash2, Volume2, X } from '@lucide/vue';
import AppModal from '@/components/AppModal.vue';
import { createPersistentMusicLibrary, removeTrack, type MusicTrack } from '@/music/musicLibrary';

const musicLibrary = createPersistentMusicLibrary();
const tracks = ref<MusicTrack[]>([]);
const currentTrackId = ref<string | null>(null);
const isPlaying = ref(false);
const loopPlaylist = ref(true);
const masterVolume = ref(0.8);
const isLoading = ref(true);
const libraryError = ref('');
const fileInput = ref<HTMLInputElement>();
const showDeleteModal = ref(false);
const deleteTargetId = ref<string | null>(null);
const deleteTarget = computed(() => tracks.value.find(track => track.id === deleteTargetId.value) ?? null);
let audio: HTMLAudioElement | null = null;

function updateVolume() {
  if (audio) audio.volume = masterVolume.value;
}
function openFilePicker() { fileInput.value?.click(); }
async function loadTracks() {
  isLoading.value = true;
  try {
    tracks.value = await musicLibrary.load();
    libraryError.value = '';
  } catch (error) {
    libraryError.value = error instanceof Error ? error.message : '音乐列表读取失败';
  } finally {
    isLoading.value = false;
  }
}
async function handleFiles(event: Event) {
  const input = event.target as HTMLInputElement;
  for (const file of Array.from(input.files ?? [])) {
    try {
      tracks.value.push(await musicLibrary.add(file));
      libraryError.value = '';
    } catch (error) {
      libraryError.value = error instanceof Error ? error.message : '音乐导入失败';
      break;
    }
  }
  input.value = '';
}
function playTrack(id: string) {
  const track = tracks.value.find(item => item.id === id);
  if (!track) return;
  if (currentTrackId.value === id && isPlaying.value) { stopPlayback(); return; }
  stopPlayback();
  currentTrackId.value = id;
  if (!track.url) return;
  if (!audio) { audio = new Audio(); audio.addEventListener('ended', handleEnded); }
  audio.src = track.url; audio.volume = masterVolume.value;
  void audio.play().then(() => { isPlaying.value = true; }).catch(() => { isPlaying.value = false; });
}
function togglePlaylist() {
  if (!currentTrackId.value) {
    playTrack(tracks.value[0]?.id ?? '');
    return;
  }
  const currentTrack = tracks.value.find(track => track.id === currentTrackId.value);
  if (isPlaying.value) {
    audio?.pause();
    isPlaying.value = false;
    return;
  }
  if (currentTrack?.url && audio) {
    void audio.play().then(() => { isPlaying.value = true; }).catch(() => { isPlaying.value = false; });
  } else {
    playTrack(currentTrack?.id ?? '');
  }
}
function stopPlayback() {
  audio?.pause();
  if (audio) audio.currentTime = 0;
  currentTrackId.value = null;
  isPlaying.value = false;
}
function handleEnded() {
  const index = tracks.value.findIndex(track => track.id === currentTrackId.value);
  isPlaying.value = false;
  const next = loopPlaylist.value && tracks.value.length
    ? tracks.value[(index + 1) % tracks.value.length]
    : tracks.value[index + 1];
  if (next) playTrack(next.id); else stopPlayback();
}
function requestDeleteTrack(track: MusicTrack) { deleteTargetId.value = track.id; showDeleteModal.value = true; }
function requestClearTracks() { deleteTargetId.value = null; showDeleteModal.value = true; }
function closeDeleteModal() { showDeleteModal.value = false; deleteTargetId.value = null; }
async function confirmDeletion() {
  if (deleteTargetId.value) {
    const id = deleteTargetId.value;
    const target = tracks.value.find(track => track.id === id);
    try {
      await musicLibrary.remove(id);
      if (currentTrackId.value === id) stopPlayback();
      tracks.value = removeTrack(tracks.value, id);
      if (target?.url) URL.revokeObjectURL(target.url);
      libraryError.value = '';
    } catch (error) {
      libraryError.value = error instanceof Error ? error.message : '曲目删除失败';
      return;
    }
  } else {
    try {
      await musicLibrary.clear();
      stopPlayback();
      for (const track of tracks.value) {
        if (track.url) URL.revokeObjectURL(track.url);
      }
      tracks.value = [];
      libraryError.value = '';
    } catch (error) {
      libraryError.value = error instanceof Error ? error.message : '音乐列表清空失败';
      return;
    }
  }
  closeDeleteModal();
}
onMounted(() => { void loadTracks(); });
onBeforeUnmount(() => {
  stopPlayback();
  for (const track of tracks.value) if (track.url) URL.revokeObjectURL(track.url);
});
</script>

<style scoped>
.bgm-page{min-height:100%;padding:24px 28px 36px;background:#f4f8f7;color:#194555}.music-panel,.effects-panel{max-width:1220px;margin:0 auto;background:#fff;border:1px solid #d8ebe6;border-radius:20px;box-shadow:0 12px 28px rgba(37,106,91,.08)}.music-panel{overflow:hidden}.music-header{display:flex;justify-content:space-between;align-items:center;padding:20px 24px 14px}.music-title{display:flex;align-items:center;gap:10px}.title-dot{width:12px;height:12px;border-radius:50%;background:#17b89f;box-shadow:0 0 0 5px #e5f8f3}h1{margin:0;font-size:24px;letter-spacing:.02em;color:#083f50}.track-count{font-size:14px;color:#54727b}.music-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:0 24px 14px}.toolbar-btn,.row-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid #d3e9e5;border-radius:999px;background:#fff;color:#174d5a;font-weight:700;transition:.2s ease}.toolbar-btn{padding:10px 17px;font-size:14px;box-shadow:0 5px 14px rgba(54,119,106,.07)}.toolbar-btn:hover,.row-btn:hover{border-color:#19b49e;color:#0b9f8b;transform:translateY(-1px)}.toolbar-btn.primary{color:#fff;background:#16bba4;border-color:#16bba4;box-shadow:0 8px 18px rgba(22,187,164,.24)}.toolbar-btn.selected{background:#e9faf6;border-color:#9cddd1;color:#0b9f8b}.toolbar-volume{display:flex;align-items:center;gap:9px;margin-left:auto;color:#54727b;font-size:14px}.toolbar-volume input{width:132px;accent-color:#16bba4}.volume-value{min-width:38px;text-align:right;font-weight:700;color:#174d5a}.voice-priority{display:flex;align-items:center;gap:9px;margin:0 24px 10px;font-size:14px;color:#2d5f69}.checkbox-label{display:inline-flex;align-items:center;gap:8px;cursor:pointer}.checkbox-label input{position:absolute;opacity:0}.checkmark{display:grid;place-items:center;width:19px;height:19px;border-radius:3px;background:#16bba4;color:#fff}.checkbox-label input:not(:checked)+.checkmark{background:#fff;border:1px solid #bddbd5;color:transparent}.voice-icon{color:#7896a0}.priority-copy{color:#53727a}.priority-input{width:64px;padding:9px 8px;border:1px solid #d1e8e3;border-radius:12px;text-align:center;color:#174d5a;font-weight:700;background:#fbfefd}.file-input{display:none}.track-list{max-height:calc(100vh - 315px);min-height:260px;overflow:auto;padding:0 12px 16px 24px}.track-row{display:flex;align-items:center;justify-content:space-between;gap:20px;min-height:74px;margin-top:8px;padding:12px 18px;border:1px solid #daebe7;border-radius:15px;background:#f8fcfb;transition:.2s ease}.track-row:hover,.track-row.active{background:#f0fbf8;border-color:#8edaca;box-shadow:0 6px 16px rgba(44,136,116,.07)}.track-name{display:flex;align-items:center;gap:10px;min-width:0;color:#174d5a;font-size:16px}.track-name>span:nth-of-type(2){overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.track-index{color:#54727b}.track-icon{color:#18ae99;flex-shrink:0}.local-tag{padding:3px 7px;border-radius:6px;color:#0b9f8b;background:#dcf8f1;font-size:11px}.track-actions{display:flex;gap:9px;flex-shrink:0}.row-btn{padding:9px 15px;font-size:14px}.play-btn{color:#135769}.delete-btn{color:#416973}.empty-state{min-height:230px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:#7896a0}.effects-panel{margin-top:18px;padding:18px 22px 22px}.effects-heading{display:flex;align-items:end;justify-content:space-between;margin-bottom:15px}.section-kicker{color:#18ae99;font-size:10px;font-weight:800;letter-spacing:.16em}h2{margin:4px 0 0;color:#174d5a;font-size:18px}.effects-hint{color:#7896a0;font-size:12px}.effects-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}.effect-btn{display:flex;align-items:center;gap:9px;padding:11px 12px;border:1px solid #dcebe8;border-radius:11px;background:#f8fcfb;color:#2d5f69;text-align:left;font-weight:700}.effect-btn:hover{border-color:#8edaca;background:#f0fbf8}.effect-icon{display:grid;place-items:center;width:30px;height:30px;border-radius:8px;flex-shrink:0}.effect-icon.green{color:#10a889;background:#ddf8ef}.effect-icon.red{color:#e35b67;background:#fff0f1}.effect-icon.amber{color:#d9931a;background:#fff6df}.effect-icon.purple{color:#9971cf;background:#f3ebff}.effect-icon.blue{color:#4d9ad8;background:#e8f4ff}.effect-play{margin-left:auto;color:#9ab4b9}@media(max-width:900px){.toolbar-volume{width:100%;margin-left:0}.effects-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:620px){.bgm-page{padding:14px}.music-toolbar{gap:8px;padding-inline:16px}.toolbar-btn{padding:9px 12px;font-size:13px}.music-header{padding-inline:16px}.voice-priority{margin-inline:16px;flex-wrap:wrap}.track-list{padding-left:16px}.track-row{align-items:flex-start;flex-direction:column;gap:10px}.track-actions{width:100%}.row-btn{flex:1}.effects-grid{grid-template-columns:1fr}}
.danger-action{color:#b44955;border-color:#efd4d7}.danger-action:hover{color:#c33f4c;border-color:#e8aeb5;background:#fff8f8}.danger-action:disabled{opacity:.45;cursor:not-allowed;transform:none}.delete-warning{display:flex;gap:14px;align-items:flex-start;padding:14px;border:1px solid #f3d9dc;border-radius:12px;background:#fff7f7}.warning-icon{display:grid;place-items:center;width:38px;height:38px;border-radius:10px;background:#ffe5e7;color:#c74755;flex-shrink:0}.delete-warning strong{display:block;color:#7d2934}.delete-warning p{margin:5px 0 0;color:#9b626a;font-size:12px;line-height:1.55}.modal-actions{display:flex;gap:8px}.modal-cancel-btn,.modal-danger-btn{padding:8px 15px;border-radius:8px;font-weight:700;font-size:12px}.modal-cancel-btn{border:1px solid #d8e5e5;background:#fff;color:#52707a}.modal-danger-btn{border:1px solid #d45b66;background:#d94f5d;color:#fff;box-shadow:0 4px 10px rgba(217,79,93,.2)}.modal-danger-btn:hover{background:#c94250}@media(max-width:900px){.toolbar-volume{width:100%;margin-left:0}}@media(max-width:620px){.bgm-page{padding:14px}.music-toolbar{gap:8px;padding-inline:16px}.toolbar-btn{padding:9px 12px;font-size:13px}.music-header{padding-inline:16px}.voice-priority{margin-inline:16px;flex-wrap:wrap}.track-list{padding-left:16px}.track-row{align-items:flex-start;flex-direction:column;gap:10px}.track-actions{width:100%}.row-btn{flex:1}}

/* Strata page treatment */
.bgm-page { background:#f3f4f2; color:#111817; }
.bgm-page .music-panel, .bgm-page .effects-panel { border-color:#e3e5e1; border-radius:12px; box-shadow:0 1px 2px rgba(17,24,23,.04); }
.bgm-page .toolbar-btn.primary { background:#0b8f69; border-color:#0b8f69; box-shadow:none; }
.bgm-page .toolbar-btn.primary:hover { background:#087a5a; }
.bgm-page .track-list { min-height:0; }
.bgm-page .empty-state { min-height:96px; }

/* Keep the workbench surface open; only actionable rows receive a surface. */
.bgm-page .music-panel {
  background: transparent;
  border: 0;
  border-radius: 0 !important;
  box-shadow: none !important;
  overflow: visible;
}

.bgm-page .music-header {
  padding: 4px 0 12px;
}

.bgm-page .music-toolbar {
  padding: 0 0 14px;
}

.bgm-page .track-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0;
  max-height: none;
}

.bgm-page .track-row {
  margin-top: 0;
  background: #ffffff;
  border-color: #e3e5e1;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(17, 24, 23, 0.04);
}

.bgm-page .empty-state {
  background: #ffffff;
  border: 1px dashed #cbd5d1;
  border-radius: 8px;
}

.library-error {
  margin: 0 0 12px;
  padding: 10px 12px;
  border: 1px solid #efc7cc;
  border-radius: 8px;
  background: #fff7f8;
  color: #a23745;
  font-size: 13px;
}
</style>
