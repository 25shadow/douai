# Live Simulation Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace timer-only simulation with a scripted, pausable live rehearsal workbench while preserving existing game, feed, voice, and cross-window behavior.

**Architecture:** Add a pure `SimulationRunner` with deterministic events and explicit controls, then adapt `liveStore` to use it as the single simulation source. Extend `LiveConsoleView` with mode selection, transport controls, timeline, and manual event injection. Keep `interactionRouter` and game modules unchanged.

**Tech Stack:** Vue 3, TypeScript, Vitest/Node test runner already used in repo, existing reactive stores and localStorage sync.

**Spec:** `docs/superpowers/specs/2026-10-29-live-simulation-workbench-design.md`

## Global Constraints

- Reuse existing `DyMessage`, `interactionRouter`, `createLiveFeedItems`, and game module lifecycle.
- Keep `startLiveSimulation` and `stopLiveSimulation` exports compatible.
- Main window remains the simulation execution source; game display windows consume synced state.
- No new runtime dependency.

---

### Task 1: Add deterministic simulation runner

**Files:**
- Create: `src/services/simulationRunner.ts`
- Test: `src/services/__tests__/simulationRunner.test.ts`

**Interfaces:**
- Produces `SimulationMode`, `SimulationStatus`, `SimulationEvent`, `SimulationScenario`, `SimulationRunnerSnapshot`, and `createSimulationRunner`.
- Runner methods: `start()`, `pause()`, `resume()`, `step()`, `tick(seconds?: number)`, `stop()`, `inject(event)`, `snapshot()`.

- [ ] Write tests for deterministic ordering, pause/resume, step, disabled events, and mode defaults.
- [ ] Run the focused test and verify failure.
- [ ] Implement a pure runner with an event cursor and elapsed seconds; no Vue imports and no browser timers.
- [ ] Run focused tests and verify pass.

### Task 2: Adapt live simulation store

**Files:**
- Modify: `src/services/liveSimulation.ts`
- Modify: `src/stores/liveStore.ts`
- Test: `src/game/quiz/__tests__/liveSimulation.test.ts`

**Interfaces:**
- Extend config with optional `mode`, `scenario`, and `events`.
- Export `simulationStatus`, `simulationMode`, `simulationTimeline`, `pauseLiveSimulation`, `resumeLiveSimulation`, `stepLiveSimulation`, and `injectSimulationEvent`.

- [ ] Add scenario builders for QA, rehearsal, and demo modes.
- [ ] Replace interval-generated random messages with runner callbacks while retaining compatibility fallback generation.
- [ ] Route emitted events through the existing interaction router and feed pipeline.
- [ ] Preserve snapshot/restore behavior and cross-window sync fields.
- [ ] Add tests for mode start, pause behavior, step behavior, and manual injection.
- [ ] Run simulation tests and existing live-feed tests.

### Task 3: Rework console controls

**Files:**
- Modify: `src/views/LiveConsoleView.vue`

**Interfaces:**
- Consume the new store controls and timeline state.
- Add controls: mode select, pause/resume, step, end, manual chat/like/gift injection.

- [ ] Replace the single setup-only simulation modal with a compact mode + scenario setup.
- [ ] Add a transport strip showing status, elapsed time, cursor, current event, next event.
- [ ] Add a timeline list with enabled state and executed state.
- [ ] Add manual event controls that call `injectSimulationEvent`.
- [ ] Keep existing game selection, game display window, feed filters, and live metrics.
- [ ] Verify responsive layout and disabled states in idle, running, paused, and finished states.

### Task 4: Verification and regression coverage

**Files:**
- Modify: `src/services/__tests__/simulationRunner.test.ts`
- Modify: `src/game/quiz/__tests__/liveSimulation.test.ts`
- Modify: `src/views/LiveConsoleView.vue` only if test findings require fixes

- [ ] Run `pnpm test` or the repository's configured test command.
- [ ] Run TypeScript/Vite build.
- [ ] Check that real room connection still refuses simulation while live/connecting.
- [ ] Check that ending simulation restores pre-simulation state.
- [ ] Review the diff for unrelated changes and report any residual risk.
