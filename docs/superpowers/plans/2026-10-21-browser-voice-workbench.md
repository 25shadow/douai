# Browser Voice Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved browser-only voice workbench, persistent configuration, and reliable scene-aware quiz playback.

**Architecture:** A pure configuration module defines the public schema. A browser adapter supplies voices and speech primitives to a separately tested queue manager. SQLite owns saved configuration; the workbench owns a draft and only applies it after successful persistence.

**Tech Stack:** Vue 3, TypeScript, Web Speech API, Python standard library HTTP server and SQLite, Node test runner, Playwright CLI.

**Spec:** `docs/superpowers/specs/2026-10-21-browser-voice-workbench-design.md`

## Global Constraints

- Browser SpeechSynthesis only; no cloud TTS, API keys, remote synthesis, model downloads, audio cache, or OBS audio routing.
- Preserve unrelated existing workspace changes.
- Persist project configuration exclusively through the Python API and SQLite.
- Draft preview must not save settings or change the live runtime configuration.
- Save failures retain draft and previously active configuration.
- Existing quiz voice toggle and project enabled flag both control production speech.
- Use Unicode code points for text limits.
- Do not claim real speaker output from simulated or browser automation tests.

## Workspace and Baseline

- [x] Read approved spec and existing configuration/playback/game consumers.
- [x] Baseline: `npm test` passes 29 tests.
- [x] Baseline: `python -m unittest discover -s tests` passes 6 tests.
- [x] Continue in place after user requested immediate implementation. Created `codex/browser-voice-workbench` with existing changes retained; no unrelated files were stashed, discarded or committed.

## File Ownership

| File | Responsibility |
| --- | --- |
| `src/voice/voiceConfig.ts` | Schema, defaults, validation, legacy normalization, presets |
| `voice_config.py` | Backend schema/default validation, independent of HTTP and SQLite |
| `config_server.py` | Migration, atomic persistence, HTTP status and errors |
| `src/services/configApi.ts` | Normalize loaded configuration, dedicated voice PUT |
| `src/voice/browserSpeech.ts` | Browser capability, voices subscription, resolution, utterance callbacks |
| `src/voice/voiceManager.ts` | Queue policy, playback lifecycle, state subscription, preview ownership |
| `src/voice/useVoiceWorkbench.ts` | Draft, dirty state, persistence and preview lifecycle |
| `src/components/voice/VoiceCatalog.vue` | Searchable/filterable voice choices and favorites |
| `src/components/voice/VoiceSceneSettings.vue` | Scene policy editing |
| `src/views/VoiceConfigView.vue` | Responsive workbench layout and parameter/preview controls |
| `src/App.vue` | Runtime initialization, visible initialization error |
| `src/game/quiz/quizStore.ts` | Scene routing and stale quiz playback cleanup |
| `src/voice/__tests__/*.test.ts` | Configuration, queue, adapter, API and integration contracts |
| `tests/test_voice_config.py` | Legacy database and HTTP persistence contracts |
| `package.json` | Include voice tests and established icon library if needed |

## Task 1: Configuration and Persistence

**Consumes:** Existing legacy voice columns and project API.

**Produces:**

```typescript
type VoiceScene = 'quiz' | 'answer' | 'gift' | 'like' | 'system';
type VoiceQueueMode = 'queue' | 'interrupt' | 'drop';
// Exact VoiceConfig and VoiceScenePolicy fields/ranges are in the spec.
function createDefaultVoiceConfig(): VoiceConfig;
function normalizeVoiceConfig(input: unknown, legacy?: Record<string, unknown>): VoiceConfig;
function validateVoiceConfig(input: unknown): VoiceConfig;
function applyVoicePreset(config: VoiceConfig, preset: 'natural' | 'live' | 'quick'): VoiceConfig;
async function saveVoiceConfig(config: VoiceConfig, fetcher?: typeof fetch): Promise<VoiceConfig>;
```

```python
def default_voice_config(): ...
def normalize_voice_config(data): ...
def save_voice_config(data): ...  # returns persisted, validated VoiceConfig
```

- [ ] Add Node test script coverage for both existing tests and `src/voice/__tests__/*.test.ts`.
- [ ] Write configuration tests first. A legacy input `{voiceEnabled: false, voiceVolume: 0.4, voiceRate: 1.2, voicePrefix: '提示'}` must normalize with those values plus pitch 1 and queue mode queue. Mutating one default scene must not mutate another fresh default. Reject NaN, infinite values, wrong types, invalid modes and out-of-range scene values.
- [ ] Run `node --experimental-strip-types --test src/voice/__tests__/voiceConfig.test.ts`; confirm missing implementation causes failure.
- [ ] Implement defaults and validation matching all spec ranges. Presets replace volume/rate/pitch only.
- [ ] Write Python tests first against a temporary database: reconstruct old voice columns, initialize twice, verify legacy values survive; save new settings, reload exact values; reject invalid settings without modifying DB.
- [ ] Add live HTTP tests using ephemeral server ports: `PUT /api/config/voice` leaves room/quiz/AI data unchanged, returns 400 for malformed JSON or schema, and old full-config payload cannot overwrite newer voice settings.
- [ ] Run `python -m unittest discover -s tests` and observe the intended failures.
- [ ] Add nullable JSON column with idempotent migration; normalize old rows; use dedicated atomic voice update and compatibility mirrors.
- [ ] Add dedicated voice API client. In a fetch-boundary test assert request path `/api/config/voice`, method PUT, and payload; failure surfaces server error and does not report success.
- [ ] Normalize loaded project configuration, retaining compatibility for legacy callers and avoiding changes to unrelated defaults.
- [ ] Run Node/Python tests and type-check; inspect diff for accidental changes.

## Task 2: Browser Adapter and Playback Manager

**Consumes:** `VoiceConfig`, `VoiceScene`, validation from Task 1.

**Produces:**

```typescript
interface VoiceDescriptor {
  voiceURI: string; name: string; lang: string; localService: boolean; default: boolean;
}
// Adapter owns raw speechSynthesis and voice event listeners.
// Manager receives adapter plus injectable clock/timers for deterministic tests.
function speak(text: string, options?: { scene?: VoiceScene; owner?: string }): boolean;
function setVoiceConfig(config: VoiceConfig): void;
function stopVoice(owner?: string): void;
function pauseVoice(): void;
function resumeVoice(): void;
function previewVoice(text: string, config: VoiceConfig): string; // ownership token
function stopPreview(token: string): void;
```

- [ ] Write adapter tests with a controllable SpeechSynthesis boundary: empty initial voices followed by voiceschanged, exact URI selection, name/language fallback, language fallback and browser default; listener disposal removes only owned listeners.
- [ ] Run tests to confirm absent adapter fails, then implement adapter with visible fallback/error information.
- [ ] Write queue tests using a fake adapter that exposes utterance callbacks. Observe actual order of texts passed to the adapter, not mock existence.
- [ ] Cover queue mode preserving current speech; priority ordering and FIFO ties; interrupt only at equal/higher priority; drop when busy; full queue replacing only lower-priority pending entries.
- [ ] Cover global/scene disable, prefix composition, Unicode length limits, cooldown/dedupe only on accepted requests and no speech before successful initialization.
- [ ] Run tests before implementing queue branches.
- [ ] Implement lifecycle with generation IDs so cancelled old callbacks cannot finish new speech.
- [ ] Add red tests for paused/resumed timeout, timeout/error progression, stop clearing queue, disable cancelling current speech, and production state subscription.
- [ ] Implement finite timeout (30..300 seconds), suspended while paused. Preserve last error while allowing next queued item.
- [ ] Add red tests proving preview uses draft without changing active config, stops current speech, ignores production requests until preview ends, and stale preview cleanup cannot stop later production speech.
- [ ] Implement preview ownership and per-owner/per-scene cleanup for game integration.
- [ ] Run all tests and type-check.

## Task 3: Startup and Quiz Integration

**Consumes:** Saved config API and manager public functions.

**Produces:** Startup readiness contract and scene-aware quiz announcements.

- [ ] Write startup initialization tests: before load production speak returns false; successful saved enabled=false never speaks; failed load leaves runtime blocked; retry successfully enables configured playback.
- [ ] Implement an initialization function with injectable loader and call it once from the normal application entry, not OBS output. Show initialization failure and allow retry.
- [ ] Add quiz integration tests through a dependency boundary around speech (not source-text assertions). Begin a question and assert quiz scene/owner; submit correct answer and assert answer; gift-assisted answer must use gift, not ordinary answer.
- [ ] Cover like/system scene routing and existing quiz voice=false preventing all game announcements.
- [ ] Add stale playback tests for manual next question, reveal, game restart and game stop. Clear only quiz-owned playback; reveal clears pending answer/gift/like feedback.
- [ ] Implement narrow changes to quiz announcements and cleanup. Do not change scoring, timing or event interpretation.
- [ ] Run existing quiz tests plus new integration tests and type-check.

## Task 4: Workbench UI

**Consumes:** Configuration, catalog and playback state from Tasks 1–3.

**Produces:** Functional responsive voice configuration screen.

- [ ] Add workbench controller tests: draft mutation marks dirty, successful save updates active config and baseline, failed save preserves both previous runtime and edited draft, preview receives draft, unmount cancels only owned preview.
- [ ] Run failing tests, then implement composable with injectable persistence/runtime dependencies.
- [ ] Add `lucide-vue-next` for accessible conventional control icons if no existing icon package is present; update package and lock consistently.
- [ ] Build voice catalog with name search, language dropdown, favorites-only filter, refresh, automatic choice and empty/loading/unsupported states.
- [ ] Build scene settings using validated ranges and fixed layout tracks; labels remain readable at narrow widths.
- [x] Replace old form with restrained two-column workbench: page save state; catalog; enable/parameter/preset area; preview text and transport; scene policies; advanced queue controls and restore defaults.
- [ ] Use draft-only numeric edits, visible validation errors, accessible names/tooltips, save loading guard and disabled controls before load. Use live regions for errors/save/playback status.
- [ ] Test leaving and returning to the page, save/reload persistence, missing selected voice and API error recovery through browser workflow.
- [ ] Keep existing app theme and typography; no generic hero, explanatory marketing copy, decorative asset or nested cards.

## Task 5: Verification and Delivery

- [ ] Run `npm test`, `python -m unittest discover -s tests`, `npm run type-check`, `npm run build`.
- [ ] Start API and Vite without colliding with existing ports. Leave required dev service available to the user and provide its URL.
- [ ] Use Playwright CLI snapshots before locator refs; exercise save, reload, draft-only preview, scene editing, catalog filtering and failure feedback.
- [x] Capture desktop screenshots under `output/playwright/`, inspect screenshots and document width/overflow. User clarified this is desktop software; removed dedicated mobile layout and stopped mobile acceptance work.
- [ ] Verify real-browser API capability and console errors. Inject deterministic browser voices only for automation cases requiring a stable catalog; explicitly distinguish them from real OS voices.
- [ ] Review manager cancellation races, persistence compatibility and game cleanup contracts against the approved spec; add regression tests for discovered issues.
- [ ] Review diff and status without reverting unrelated changes. Do not commit unrelated pre-existing code.
- [ ] Report implemented behavior, test results, preview URL and real-audio verification limitations.

## Plan Self-Review

All spec sections map to Tasks 1–5: model/migration/API (1), catalog/queue/preview/errors/timeouts (2), startup/game lifecycle (3), interaction/responsiveness/save states (4), automated and visual acceptance (5). No remote provider implementation is included. Field names and scene keys follow the approved spec. Implementation must preserve existing uncommitted application code, which is why workspace preference is an execution prerequisite.

## Execution Record

- [x] Configuration/schema, SQLite migration, dedicated voice API and stale full-project save protection implemented.
- [x] Browser catalog, delayed voice loading, fallback, priority queue, drop/interrupt policies, timeout, dedupe and cooldown implemented.
- [x] Preview draft isolation, token-owned cleanup, pause latch and device resume races covered by regression tests.
- [x] Startup configuration and error retry integrated; quiz scene routing, stale feedback cleanup and start/first-question sequence integrated.
- [x] Desktop two-column workbench implemented with Lucide icons via maintained `@lucide/vue` package. No remote provider framework added.
- [x] Node: 52 tests pass. Python: 10 tests pass. Vue type-check and production build pass.
- [x] Playwright: real OS catalog exposed 3 Chinese voices; search, selection/favorite, save/reload, transport controls and failed-save draft retention exercised. Test configuration restored afterward.
- [x] Desktop screenshots inspected at 1440 and 1280 pixels; no horizontal overflow. Final screenshot: `output/playwright/voice-desktop-final.png`.
- [x] Read-only reviewer findings on pause leakage and game-start scene routing reproduced and fixed; additional tests cover late completion during pause.
- [x] Local API and Vite left available at `http://127.0.0.1:5173/?page=voice`.
- [x] Real speaker sound quality cannot be established by automated checks. Existing production warning about unbundled `mssdk.js` remains unrelated and unchanged.

Implementation note: full-project saves intentionally never consume voice settings, including a voiceConfig snapshot, because existing callers always spread previously loaded project data. Only the dedicated voice endpoint updates voice settings. Start and first question are accepted as one ordered sequence so drop/interrupt policies cannot discard the first question because of its own start announcement.
