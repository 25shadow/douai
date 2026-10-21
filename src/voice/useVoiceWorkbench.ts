import { computed, onMounted, onUnmounted, ref } from 'vue';
import { loadConfig, saveVoiceConfig } from '../services/configApi.ts';
import { browserSpeech, resolveVoice, type VoiceDescriptor } from './browserSpeech.ts';
import { voiceManager } from './voiceManager.ts';
import { ensureVoiceInitialized } from './voiceInitialization.ts';
import { createDefaultVoiceConfig, normalizeVoiceConfig, validateVoiceConfig, type VoiceConfig } from './voiceConfig.ts';

interface WorkbenchDependencies {
  load(): Promise<VoiceConfig>; save(config: VoiceConfig): Promise<VoiceConfig>; apply(config: VoiceConfig): void;
}
export function createVoiceWorkbench(deps: WorkbenchDependencies) {
  const draft = ref(createDefaultVoiceConfig());
  const baseline = ref('');
  const loading = ref(true);
  const saving = ref(false);
  const error = ref('');
  const message = ref('');
  const loaded = ref(false);
  const dirty = computed(() => loaded.value && JSON.stringify(draft.value) !== baseline.value);
  async function load() {
    if (saving.value) return;
    loading.value = true; error.value = ''; message.value = '';
    try {
      const value = validateVoiceConfig(await deps.load());
      draft.value = value; baseline.value = JSON.stringify(value);
      loaded.value = true;
    } catch (e) { error.value = e instanceof Error ? e.message : '语音配置加载失败'; }
    finally { loading.value = false; }
  }
  async function save() {
    if (!loaded.value || saving.value || loading.value) return;
    saving.value = true; error.value = ''; message.value = '';
    try {
      const snapshot = validateVoiceConfig(draft.value);
      const value = validateVoiceConfig(await deps.save(snapshot));
      deps.apply(value); baseline.value = JSON.stringify(value);
      message.value = '设置已保存';
    } catch (e) { error.value = e instanceof Error ? e.message : '语音配置保存失败'; }
    finally { saving.value = false; }
  }
  return { draft, dirty, loading, saving, error, message, loaded, load, save };
}
export function useVoiceWorkbench() {
  const model = createVoiceWorkbench({
    async load() {
      await ensureVoiceInitialized();
      const c = await loadConfig();
      return normalizeVoiceConfig(c.voiceConfig, c as unknown as Record<string, unknown>);
    },
    save: saveVoiceConfig, apply: voiceManager.configure
  });
  const voices = ref<VoiceDescriptor[]>([]);
  const state = ref(voiceManager.getState());
  const search = ref('');
  const language = ref('');
  const favoritesOnly = ref(false);
  const text = ref('欢迎来到直播间，感谢大家的支持。');
  let previewToken = '';
  let disposeVoices: (() => void) | undefined;
  let disposeState: (() => void) | undefined;
  const refresh = () => { voices.value = browserSpeech.voices(); };
  const languages = computed(() => [...new Set(voices.value.map(v => v.lang))].sort());
  const filteredVoices = computed(() => voices.value.filter(v => {
    const query = search.value.toLowerCase();
    return (!language.value || v.lang === language.value)
      && (!favoritesOnly.value || model.draft.value.favoriteVoiceURIs.includes(v.voiceURI))
      && `${v.name} ${v.lang}`.toLowerCase().includes(query);
  }));
  const selection = computed(() => resolveVoice(voices.value, model.draft.value));
  const selectedName = computed(() => model.draft.value.voiceURI ? model.draft.value.voiceName : selection.value.voice?.name || '浏览器自动选择');
  function selectVoice(voice?: VoiceDescriptor) {
    model.draft.value.voiceURI = voice?.voiceURI || '';
    model.draft.value.voiceName = voice?.name || '';
    if (voice) model.draft.value.lang = voice.lang;
  }
  function favorite(uri: string) {
    const values = model.draft.value.favoriteVoiceURIs;
    const index = values.indexOf(uri);
    if (index >= 0) values.splice(index, 1);
    else if (values.length < 100) values.push(uri);
    else model.error.value = '收藏最多 100 个音色';
  }
  function preview() {
    try { previewToken = voiceManager.preview(text.value, model.draft.value); model.error.value = ''; }
    catch (e) { model.error.value = e instanceof Error ? e.message : '试听失败'; }
  }
  onMounted(() => {
    refresh();
    disposeVoices = browserSpeech.subscribeVoices(refresh);
    disposeState = voiceManager.subscribe(value => { state.value = value; });
    void model.load();
  });
  onUnmounted(() => {
    disposeVoices?.(); disposeState?.();
    if (previewToken) voiceManager.stopPreview(previewToken);
  });
  return { ...model, voices, state, search, language, favoritesOnly, text, languages, filteredVoices,
    selection, selectedName, selectVoice, favorite, refresh, preview, supported: browserSpeech.supported,
    pause: voiceManager.pause, resume: voiceManager.resume, stop: voiceManager.stop };
}
