# Remove OBS-Specific Copy and Naming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove incorrect OBS-specific descriptions and naming while preserving the independent game window, 9:16 game canvas, in-app previews, and all current game-display behavior.

**Architecture:** Treat the independent window and 9:16 canvas as native DouAi game-display/preview features, not OBS features. Replace OBS-specific UI copy, event/service/component identifiers, route labels, and Tauri window label with generic game-display terminology. Remove only OBS setup instructions; do not remove window launching, game rendering, theme preview, or state synchronization.

**Tech Stack:** Vue 3, TypeScript, Tauri 2, Node.js test runner, Vite.

**Spec:** User-approved scope recorded in this plan's Scope and Decisions section, based on the request to remove OBS-related software features on 2026-10-29.

## Global Constraints

- Do not add OBS integration or make OBS a runtime prerequisite.
- Preserve the existing 9:16 game canvas, in-app game preview, and independent game-display window.
- Preserve game rules, Douyin connection, simulation, voice, AI, persistence, and unrelated working-tree changes.
- Keep ordinary application behavior unchanged outside OBS-specific entry points, route names, and copy.
- Historical design/plan documents remain historical records; update current user-facing documentation, not old execution notes.

## Scope and Decisions

- Remove OBS descriptions and setup instructions from current software UI and README.
- Rename internal identifiers that incorrectly classify the game window or preview as OBS-specific.
- Keep the independent game window, game canvas, game-theme preview actions, in-app monitor, and cross-window game-state synchronization behavior unchanged.
- Remove the unused OBS-branded preview component only if confirmed to have no importers; its live preview remains available in Live Console and the independent game window.
- Preserve historical docs under `docs/superpowers/specs` and `docs/superpowers/plans`.

---

### Task 1: Rename the Independent Game Window Without Changing Behavior

**Files:**
- Create: `src/services/gameDisplayWindow.ts`
- Modify: `src/App.vue`
- Modify: `src/views/LiveConsoleView.vue`
- Modify: `src-tauri/capabilities/default.json`
- Modify: `src-tauri/gen/schemas/capabilities.json`
- Test: `src/services/__tests__/gameDisplayWindow.test.ts`
- Delete: `src/services/externalObsWindow.ts`
- Delete: `src/services/__tests__/externalObsWindow.test.ts`
- Rename: `src/views/ObsLiveView.vue` to `src/views/GameDisplayView.vue`

**Interfaces:**
- `getGameDisplayWindowOptions(url: string)` returns the existing borderless portrait window options, titled `DouAi 游戏画面`, sized 460 by 820.
- `getGameDisplayUrl(origin: string, pathname: string)` returns `${origin}${pathname}?display=game`.
- `isTauriRuntime(host?)` keeps its current behavior and signature in the renamed service.
- The standalone route uses `?display=game`; it renders the same game canvas and idle state as before.
- The native Tauri window label becomes `game-display-window`.

- [ ] **Step 1: Write the renamed service test**

Create tests asserting `getGameDisplayUrl('https://douai.local', '/')` returns `https://douai.local/?display=game`, label `game-display-window`, title `DouAi 游戏画面`, window dimensions and flags, and Tauri-runtime detection.

- [ ] **Step 2: Run the test and confirm it fails before implementation**

Run: `node --disable-warning=ExperimentalWarning --experimental-strip-types --experimental-transform-types --test src/services/__tests__/gameDisplayWindow.test.ts`
Expected: FAIL because the renamed service does not yet exist.

- [ ] **Step 3: Rename the window service and its consumers**

Replace OBS-specific identifiers and strings in the service and `LiveConsoleView.vue`. Implement `getGameDisplayUrl` in the service and use it to build the popup/Tauri URL. Keep the current browser-popup fallback and Tauri window behavior.

- [ ] **Step 4: Rename the standalone view and route**

Rename `ObsLiveView.vue` to `GameDisplayView.vue`. Preserve the existing standalone 1080×1920 game canvas, responsive scaling, game-module selection, config loading, idle state, and close-window action. Replace the old `page=obs`/`output=1` route check with `display=game`; remove only OBS-specific browser-source explanation and address-copy UI. In `App.vue`, render the same display for `display=game`. Leave the in-app theme-preview overlay wiring for Task 3.

- [ ] **Step 5: Update the Tauri capability window label**

Change the allowed secondary window from `obs-live-window` to `game-display-window` in source and generated capability JSON. Keep `core:webview:allow-create-webview-window`; the independent display still needs it.

- [ ] **Step 6: Run the service test and type check**

Run: `node --disable-warning=ExperimentalWarning --experimental-strip-types --experimental-transform-types --test src/services/__tests__/gameDisplayWindow.test.ts`
Expected: PASS.

Run: `pnpm type-check`
Expected: PASS with no stale imports or route typing errors.

### Task 2: Remove OBS Setup Copy, Preserve Game Preview Surfaces

**Files:**
- Modify: `src/views/LiveConsoleView.vue`
- Modify: `src/views/SystemSettingsView.vue`
- Delete: `src/views/ObsPreviewPanel.vue`

**Interfaces:**
- Live Console keeps its existing in-app rendered game monitor and an action to open the game-display window.
- System Settings continues to load/save AI configuration and retains all non-OBS settings.
- The in-app game monitor and independent game window remain usable.

- [ ] **Step 1: Verify the old preview panel has no importers**

Run: `rg -n "ObsPreviewPanel" src`
Expected: only the component's own definition is reported; if another importer exists, remove that usage without deleting the game canvas it renders.

- [ ] **Step 2: Remove browser-source-only controls from Live Console**

Delete browser-source URL/address-copy controls and OBS-specific error copy. Keep the current independent display button, renamed “游戏画面窗口”, and preserve the ResizeObserver and rendered canvas used by the in-app 9:16 monitor.

- [ ] **Step 3: Remove the OBS browser-source panel from System Settings**

Remove the OBS setup-instructions section, URL-copy state/function, OBS-only imports, and related styles. Preserve AI configuration loading/saving, software information, and game display/preview surfaces.

- [ ] **Step 4: Delete the unreferenced OBS-only preview component**

Delete `ObsPreviewPanel.vue` after confirming it has no importers. Do not delete `QuizBroadcastCanvas`, the in-app monitor in Live Console, the game-display window, or any game-theme preview controls.

- [ ] **Step 5: Type-check the affected surfaces**

Run: `pnpm type-check`
Expected: PASS, with System Settings AI save behavior and Live Console rendering still type-safe.

### Task 3: Remove OBS Entry Points and Rename Game Preview Actions

**Files:**
- Modify: `src/App.vue`
- Modify: `src/components/DesktopTitleBar.vue`
- Rename: `src/components/FloatingObsWindow.vue` to `src/components/FloatingGameDisplayWindow.vue`
- Modify: `src/views/HomeDashboardView.vue`
- Modify: `src/views/GameListView.vue`
- Modify: `src/views/QuizConfigView.vue`
- Modify: `src/views/VersusConfigView.vue`
- Modify: `src/game/quiz/quizStore.ts`
- Modify: `src/game/versus/versusStore.ts`
- Modify: `src/game/quiz/quizThemes.ts`
- Modify: `src/game/quiz/__tests__/quizThemes.test.ts`

**Interfaces:**
- App-level events use `open-game-display` and accept an optional `'quiz' | 'versus'` game ID where needed.
- The game display continues to receive game ID selection and renders the selected module's existing canvas.
- Quiz/versus theme preview controls remain available without mentioning OBS.
- Cross-window state sync identifies the secondary window using `display=game`, not `page=obs`.

- [ ] **Step 1: Rename game-window component and App state**

Rename `FloatingObsWindow.vue` to `FloatingGameDisplayWindow.vue`; rename App refs/functions/props from OBS-window names to game-display names. Keep the theme-preview overlay lifecycle and canvas scaling behavior intact.

- [ ] **Step 2: Replace event names across Home and game pages**

Replace `toggle-obs-window` / `launch-obs` with `open-game-display` in App, Home Dashboard, Game List, Quiz Config, and Versus Config. Retain the existing theme-preview actions and game selection.

- [ ] **Step 3: Remove unused title-bar OBS props/events**

Remove `obsWindowVisible` and `toggle-obs-window` from `DesktopTitleBar.vue` and its App binding if they have no rendered control or other consumers.

- [ ] **Step 4: Rename game synchronization route checks**

Replace `isObsMirrorWindow` and `page=obs` checks in quiz and versus stores with game-display terminology and `display=game`. Preserve channel/message synchronization behavior.

- [ ] **Step 5: Update quiz theme tests**

Change OBS-specific test descriptions to assert that theme selection synchronizes to the independent game-display window. Preserve all existing theme normalization and BroadcastChannel assertions.

- [ ] **Step 6: Run relevant game tests**

Run: `node --disable-warning=ExperimentalWarning --experimental-strip-types --experimental-transform-types --test src/game/quiz/__tests__/*.test.ts`
Expected: PASS, including theme synchronization and quiz behavior.

### Task 4: Clean User-Facing Copy and Verify the Feature Boundary

**Files:**
- Modify: `README.md`
- Modify: `src/views/HomeDashboardView.vue`
- Modify: `src/views/GameListView.vue`
- Modify: `src/views/QuizConfigView.vue`
- Modify: `src/views/VersusConfigView.vue`
- Modify: `src/views/SystemSettingsView.vue`
- Modify: `src/views/GameDisplayView.vue`
- Modify: `src/components/LicenseModal.vue`
- Modify: `src/views/VersusBroadcastCanvas.vue`
- Modify: `src/game/quiz/quizThemes.ts`

**Interfaces:**
- User-facing copy describes the DouAi game-display window and game preview as DouAi features; it contains no OBS setup instructions.
- README feature list describes in-app game preview/display rather than OBS output.
- Generic `ResizeObserver` APIs and unrelated dependency names are not OBS features and must remain unchanged.

- [ ] **Step 1: Replace remaining OBS-specific product copy**

Update Home Dashboard setup guidance, Game List and game-config badges/buttons, license copy, theme comments, and versus canvas comments. Keep neutral 9:16 rendering and preview descriptions.

- [ ] **Step 2: Update current README copy**

Replace “OBS 主题画面”, “OBS 输出”, and OBS feature bullets with “独立游戏画面窗口/游戏画面预览”. Do not rewrite historical design or plan documents.

- [ ] **Step 3: Search application-owned sources for leftovers**

Run: `rg -n -i "\\bobs\\b|obs-live-window|page=obs|launch-obs|toggle-obs-window|ObsLiveView|ObsPreviewPanel|FloatingObsWindow|externalObsWindow" src README.md src-tauri/capabilities src-tauri/gen/schemas/capabilities.json`
Expected: no OBS-specific product strings or identifiers. Ignore unrelated embedded URL signatures only if `rg` finds a substring that is not an OBS identifier or feature.

- [ ] **Step 4: Run complete verification**

Run: `pnpm test`
Expected: PASS.

Run: `pnpm type-check`
Expected: PASS.

Run: `pnpm build-only`
Expected: Vite production build succeeds.

- [ ] **Step 5: Inspect the final diff for unrelated changes**

Run: `git diff --check` and inspect `git diff -- src/App.vue src/views src/components src/game src/services src-tauri/capabilities README.md`.
Expected: only OBS-removal and generic game-display renaming changes are included; preserve pre-existing user edits in overlapping files.

## Acceptance Criteria

- No current user-facing page describes the game window, game canvas, or game preview as an OBS feature or instructs users to configure OBS.
- No `page=obs`, `output=1`, OBS window label, OBS event name, or OBS-specific runtime branch remains in application code.
- The in-app 9:16 game monitor, quiz/versus canvas, theme preview actions, and game state synchronization work as before.
- The independent game-display window opens in browser and Tauri modes and renders either quiz or versus without changing its workflow.
- AI configuration, live connection, simulation, game rules, and voice behavior are unchanged.
- Tests, type check, production build, and `git diff --check` pass.
