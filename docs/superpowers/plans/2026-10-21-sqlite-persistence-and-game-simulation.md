# SQLite Persistence and Game Simulation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make SQLite the only persistent store for app configuration, safely migrate legacy browser settings, and require explicit game selection before local simulation starts.

**Architecture:** Keep Python's existing config API as the SQLite boundary and extend its project configuration record with simulation settings and a one-time legacy migration endpoint. Keep browser cookies and live runtime state in their current mechanisms. Update the console and OBS idle view so game simulation is explicitly selected and no game appears active by default.

**Tech Stack:** Python 3 `sqlite3` and `unittest`, Vue 3, TypeScript, Node built-in test runner, Vite.

**Spec:** `docs/superpowers/specs/2026-10-21-sqlite-persistence-and-game-simulation-design.md`

## Global Constraints

- Do not alter DyCast connection, cookie, parsing, or WebSocket relay behavior.
- `sessionid` remains in browser cookies; simulation sync remains ephemeral.
- Do not silently persist configuration to `localStorage` when SQLite API calls fail.
- Do not overwrite non-default SQLite values during legacy migration.
- Preserve separate game configuration, save, start, and stop behavior.
- Synthetic simulation events must never be sent to DyCast or the configured relay.

---

### Task 1: SQLite Legacy Migration and Simulation Settings

**Files:**
- Modify: `config_server.py`
- Create: `tests/test_config_server.py`

**Interfaces:**
- `read_config()` returns existing keys plus `simulationConfig` with `durationMinutes`, `audience`, and `eventIntervalSeconds`.
- `migrate_legacy_config(data)` atomically imports eligible `roomId`, `relayUrl`, and `simulationConfig` fields and returns the resulting config and migration result.
- `POST /api/config/migrate-legacy` accepts the legacy browser values and returns `{config, migrated}`.

- [ ] **Step 1: Write failing SQLite behavior tests**

Test these behaviors using `unittest`, a `TemporaryDirectory`, and a temporary `DB_PATH`: fresh DB returns simulation defaults `{durationMinutes: 5, audience: 120, eventIntervalSeconds: 3}`; legacy values populate empty/default columns; a second migration does not replace explicitly saved values; malformed migration values leave the database unchanged.

- [ ] **Step 2: Run the Python tests and verify expected failures**

Run: `python -m unittest tests.test_config_server -v`
Expected: failures because `simulationConfig` and `migrate_legacy_config` are not implemented.

- [ ] **Step 3: Add simulation columns with backward-compatible schema migration**

Add `simulation_duration_minutes INTEGER NOT NULL DEFAULT 5`, `simulation_audience INTEGER NOT NULL DEFAULT 120`, and `simulation_event_interval_seconds INTEGER NOT NULL DEFAULT 3` in `init_db()`. Detect existing columns with `PRAGMA table_info` before adding them.

- [ ] **Step 4: Implement transactional migration**

Validate numeric ranges (duration 1-180, audience 1-99999, interval 1-60). In one SQLite transaction, only replace empty room/relay values or default simulation columns with supplied legacy values. Return the resulting configuration. Keep user-saved non-default database values unchanged.

- [ ] **Step 5: Add endpoint and preserve existing config fields**

Add `POST /api/config/migrate-legacy`, parse JSON safely, invoke migration and return `{config, migrated}`. Extend `read_config()` and `PUT /api/config` to read/write `simulationConfig` without changing current config API fields or behavior.

- [ ] **Step 6: Run Python tests**

Run: `python -m unittest tests.test_config_server -v`
Expected: all migration and compatibility tests pass.

### Task 2: Make SQLite the Frontend Persistence Authority

**Files:**
- Modify: `src/services/configApi.ts`
- Modify: `src/views/RunConfigView.vue`
- Modify: `src/views/VoiceConfigView.vue`
- Modify: `src/views/QuizConfigView.vue`
- Modify: `src/views/LiveConsoleView.vue`
- Modify: `src/stores/liveStore.ts`
- Test: `src/game/quiz/__tests__/configApi.test.ts`

**Interfaces:**
- `ProjectConfig` includes `simulationConfig`.
- `loadConfig(): Promise<ProjectConfig>` rejects with a readable error when SQLite API is unreachable or invalid.
- `saveConfig(config): Promise<ProjectConfig>` rejects on failed persistence and does not write durable values into browser storage.
- `migrateLegacyBrowserConfig(): Promise<ProjectConfig>` posts known old keys, then removes only the keys acknowledged by a successful response.

- [ ] **Step 1: Write failing configuration API tests**

Test successful default merge, failed GET rejection, failed PUT rejection without storage writes, successful legacy-key migration cleanup, and failed migration retaining all old keys. Inject `fetch` and storage dependencies using small pure helpers or an injectable API factory rather than mocking implementation internals.

- [ ] **Step 2: Run the focused test and verify expected failures**

Run: `pnpm exec node --disable-warning=ExperimentalWarning --experimental-strip-types --test src/game/quiz/__tests__/configApi.test.ts`
Expected: failures because the API still uses browser storage and silently falls back.

- [ ] **Step 3: Remove localStorage fallback from durable config**

Use static defaults in `configApi.ts`; make `loadConfig` and `saveConfig` fail visibly when HTTP operations fail. Keep request serialization and current backend route for existing settings.

- [ ] **Step 4: Implement one-time legacy migration**

Read only `douai-room-id`, `douai-relay-url`, and `douai-live-simulation-config`. Post values through the migration endpoint; remove only those legacy keys after a successful HTTP response. Do not alter Cookie storage or the ephemeral `douai-live-simulation-state` simulation sync key.

- [ ] **Step 5: Add simulation settings to config consumers**

Load and persist `simulationConfig` through SQLite in the console. Initialize `liveState.roomId` and `liveState.relayUrl` from loaded SQLite configuration in the relevant view flows instead of reading browser storage at module initialization. Show a user-visible error when reads or saves fail; keep connect/relay buttons and order unchanged.

- [ ] **Step 6: Run frontend tests and type-check**

Run: `pnpm test` and `pnpm type-check`
Expected: all unit tests pass and Vue TypeScript build succeeds.

### Task 3: Require Explicit Game Selection for Simulation

**Files:**
- Modify: `src/services/liveSimulation.ts`
- Modify: `src/stores/liveStore.ts`
- Modify: `src/views/LiveConsoleView.vue`
- Modify: `src/views/QuizBroadcastCanvas.vue`
- Modify: `src/views/ObsLiveView.vue`
- Test: `src/game/quiz/__tests__/liveSimulation.test.ts`

**Interfaces:**
- Define `SimulationGameId = 'quiz'` for the sole implemented game.
- `startLiveSimulation(gameId, config)` rejects missing or unsupported game IDs before changing runtime state.
- The console opens the simulation setup/selection panel from the “模拟直播” action; selecting 知识问答 is explicit before “开始模拟”.

- [ ] **Step 1: Write failing simulation selection tests**

Test that no selection cannot start, `quiz` maps to the knowledge quiz module, and default/offline state remains inactive. Preserve the current guard that simulation cannot start while a real room is connected or connecting.

- [ ] **Step 2: Run the focused simulation tests and verify expected failures**

Run: `pnpm exec node --disable-warning=ExperimentalWarning --experimental-strip-types --test src/game/quiz/__tests__/liveSimulation.test.ts`
Expected: failures because the start API does not require a game ID.

- [ ] **Step 3: Require a supported game before changing live state**

Add the game ID input and validate it before snapshots, timers, quiz activation, or mock room state mutation. Keep current quiz simulation message generation local and avoid adding relay sends.

- [ ] **Step 4: Separate opening setup from starting simulation**

Change the console’s primary simulation action to open selection/configuration, add an accessible single-option game selector for the implemented knowledge quiz, and keep a separate explicit start button. Persist numeric simulation options through `simulationConfig` in SQLite.

- [ ] **Step 5: Render an idle OBS state before live/simulation**

Show the broadcast canvas only when the real room is live or simulation is active; otherwise render a neutral “等待开播” slate that contains no default question or running-game status. Preserve real and simulation canvas output.

- [ ] **Step 6: Run tests and type-check**

Run: `pnpm test` and `pnpm type-check`
Expected: all tests pass and Vue components type-check.

### Task 4: End-to-End Verification

**Files:**
- No source changes unless a verification defect is found.

- [ ] **Step 1: Run the complete test suite**

Run: `pnpm test` and `python -m unittest tests.test_config_server -v`
Expected: all frontend and backend tests pass.

- [ ] **Step 2: Run production build**

Run: `pnpm build`
Expected: type-check and Vite production build pass. Record any pre-existing SDK bundling warning without changing it.

- [ ] **Step 3: Verify migration and simulation in two browser tabs**

With the dev API and Vite running, seed legacy keys in a disposable test browser profile, reload, confirm migrated values survive a reload and old keys clear only after success; open the console, verify idle preview, open simulation setup, select knowledge quiz, start, confirm OBS output receives changing state, stop, and confirm idle output.

- [ ] **Step 4: Review boundaries**

Confirm `sessionid` still uses existing Cookie utilities, room connection and relay code are unchanged, no simulation event is sent through `relay.send`, and no durable setting is written to `localStorage`.
