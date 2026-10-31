# Music Persistence and Game Interaction Strategy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist only user-imported music and make saved game interaction strategies control routing for chat and non-chat live events.

**Architecture:** Store imported audio blobs and metadata in IndexedDB behind a small injectable library API; the music view loads that library on mount, writes on import, and deletes records on removal. Extend the interaction router to resolve the active game's complete override, including chat gates, sampled read-aloud, dual-output rules, and non-chat event policies, then let the live store use the router result to suppress or invoke global announcements.

**Tech Stack:** Vue 3, TypeScript, browser IndexedDB, Node test runner, existing reactive stores and Python SQLite config API.

**Spec:** User-approved requirements in the conversation on 2026-10-31.

## Global Constraints

- Do not add or restore built-in music tracks.
- Deleted user tracks must not reappear after restart.
- Keep game sound effects separate from the user music library.
- Relay functionality is out of scope.
- Preserve no-game global announcement behavior.
- Preserve existing user changes in the dirty worktree.

---

### Task 1: User music library persistence

**Files:**
- Modify: `src/music/musicLibrary.ts`
- Modify: `src/views/BgmMusicView.vue`
- Create: `src/music/__tests__/musicLibraryPersistence.test.ts`

**Interfaces:**
- `createPersistentMusicLibrary(storage?)` exposes `load()`, `add(file)`, `remove(id)`, and `clear()`.
- The view owns playback state but delegates durable records to the library.

- [x] Write failing tests for IndexedDB-backed load, add, remove, and clear behavior using an in-memory IndexedDB test double.
- [x] Run the focused music tests and confirm they fail because persistence APIs do not exist.
- [x] Implement the minimal persistence adapter with object store `tracks`, storing `MusicTrack` metadata plus `Blob`.
- [x] Remove built-in tracks, generated background tracks, restore controls, and localStorage deletion bookkeeping from the view.
- [x] Load persisted tracks on mount; add imported files to IndexedDB and create playback URLs from stored blobs.
- [x] Delete records and revoke object URLs on removal; clear all records on clear.
- [x] Run focused music tests and the existing music tests.

### Task 2: Complete game interaction routing

**Files:**
- Modify: `src/game/interactionTypes.ts`
- Modify: `src/game/interactionRouter.ts`
- Modify: `src/stores/liveStore.ts`
- Create: `src/game/__tests__/interactionStrategy.test.ts`

**Interfaces:**
- `GameInteractionOverride` is available to the router with chat and non-chat policies.
- `GameEventResult` may include `globalEventRouted?: boolean` and `speechIntents`.

- [x] Write failing tests covering chat ignore, AI gate, sampled read-aloud, dual-output denial, and each non-chat policy.
- [x] Run the focused strategy tests and confirm they fail against the current router.
- [x] Implement deterministic sampling using the injected `now()` and event ID hash, so tests and live behavior are stable.
- [x] Gate AI and read-aloud paths with `allowAiHost` and `allowReadAloud`; permit both only when `allowDualOutput` is true.
- [x] Resolve non-chat policies for gift, like, member, and social events and return whether global announcement is allowed.
- [x] Update `liveStore.ts` to use the router result for global announcement decisions in live and simulation flows.
- [x] Run focused strategy tests plus existing router, live-event, quiz, and voice tests.

### Task 3: Verification and cleanup

**Files:**
- Modify: `src/components/LicenseModal.vue`
- Modify: `src/views/HomeDashboardView.vue`

- [x] Replace inaccurate `119+`/`119 款` copy with neutral wording matching the two implemented games.
- [x] Run `pnpm run type-check`.
- [x] Run `pnpm run build-only`.
- [x] Run Python tests and the complete frontend test command, recording any remaining open-handle issue separately.
- [x] Review the diff to ensure relay code and unrelated user changes were not altered.
