export type SimulationMode = 'qa' | 'rehearsal' | 'demo';
export type SimulationStatus = 'idle' | 'ready' | 'running' | 'paused' | 'finished' | 'error';

export type SimulationEventType = 'chat' | 'like' | 'gift' | 'join' | 'follow' | 'system';
export type SimulationEventSource = 'script' | 'manual' | 'replay';
export type SimulationEventStatus = 'draft' | 'queued' | 'dispatched' | 'claimed' | 'ignored' | 'failed';

export interface SimulationEvent {
  id: string;
  atSeconds?: number;
  type: SimulationEventType;
  payload: Record<string, unknown>;
  enabled: boolean;
  label?: string;
  executed?: boolean;
  source?: SimulationEventSource;
  status?: SimulationEventStatus;
  result?: {
    claimed?: boolean;
    game?: string;
    speechTriggered?: boolean;
    effects?: string[];
    error?: string;
  };
}

export interface SimulationScenario {
  id: string;
  name: string;
  gameId: string;
  mode: SimulationMode;
  durationSeconds: number;
  events: SimulationEvent[];
}

export interface SimulationRunnerSnapshot {
  status: SimulationStatus;
  mode: SimulationMode;
  elapsedSeconds: number;
  cursor: number;
  scenario: SimulationScenario;
}

export interface SimulationRunner {
  start(): SimulationRunnerSnapshot;
  pause(): SimulationRunnerSnapshot;
  resume(): SimulationRunnerSnapshot;
  step(): SimulationEvent | undefined;
  tick(seconds?: number): SimulationEvent[];
  stop(): SimulationRunnerSnapshot;
  inject(event: Omit<SimulationEvent, 'id' | 'executed'> & { id?: string }): SimulationEvent;
  snapshot(): SimulationRunnerSnapshot;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createSimulationRunner(
  scenario: SimulationScenario,
  onEmit?: (event: SimulationEvent) => void
): SimulationRunner {
  const state: SimulationRunnerSnapshot = {
    status: 'ready',
    mode: scenario.mode,
    elapsedSeconds: 0,
    cursor: 0,
    scenario: clone({
      ...scenario,
      events: [...scenario.events]
        .map(event => ({
          ...event,
          atSeconds: Math.max(0, Math.floor(event.atSeconds || 0)),
          enabled: event.enabled !== false,
          executed: false,
          source: event.source || 'script',
          status: event.status || 'queued'
        }))
        .sort((a, b) => a.atSeconds - b.atSeconds)
    })
  };

  const nextPending = () => state.scenario.events.findIndex((event, index) => index >= state.cursor && !event.executed && event.enabled);

  const emit = (event: SimulationEvent) => {
    event.executed = true;
    onEmit?.(clone(event));
  };

  const processDue = () => {
    const emitted: SimulationEvent[] = [];
    while (true) {
      const index = nextPending();
      if (index < 0) break;
      const event = state.scenario.events[index];
      if ((event.atSeconds || 0) > state.elapsedSeconds) break;
      state.cursor = index + 1;
      emit(event);
      emitted.push(clone(event));
    }
    if (state.cursor >= state.scenario.events.length && state.elapsedSeconds >= state.scenario.durationSeconds) {
      state.status = 'finished';
    }
    return emitted;
  };

  return {
    start() {
      if (state.status === 'finished') {
        state.elapsedSeconds = 0;
        state.cursor = 0;
        state.scenario.events.forEach(event => { event.executed = false; });
      }
      state.status = 'running';
      processDue();
      return clone(state);
    },
    pause() {
      if (state.status === 'running') state.status = 'paused';
      return clone(state);
    },
    resume() {
      if (state.status === 'paused' || state.status === 'ready') state.status = 'running';
      return clone(state);
    },
    step() {
      if (state.status === 'finished') return undefined;
      const index = nextPending();
      if (index < 0) {
        state.status = 'finished';
        return undefined;
      }
      const event = state.scenario.events[index];
      state.cursor = index + 1;
      state.elapsedSeconds = Math.max(state.elapsedSeconds, event.atSeconds || 0);
      emit(event);
      if (state.cursor >= state.scenario.events.length) state.status = 'finished';
      return clone(event);
    },
    tick(seconds = 1) {
      if (state.status !== 'running') return [];
      state.elapsedSeconds = Math.min(state.scenario.durationSeconds, state.elapsedSeconds + Math.max(0, seconds));
      return processDue();
    },
    stop() {
      state.status = 'finished';
      return clone(state);
    },
    inject(input) {
      const event: SimulationEvent = {
        ...input,
        id: input.id || `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        atSeconds: state.elapsedSeconds,
        enabled: input.enabled !== false,
        executed: false
      };
      state.scenario.events.splice(state.cursor, 0, event);
      if (state.status === 'running' || state.status === 'paused') {
        state.cursor += 1;
        emit(event);
      }
      return clone(event);
    },
    snapshot() {
      return clone(state);
    }
  };
}
