import type { SimulationEvent } from './simulationRunner';

export interface ManualInteractionQueue {
  enqueue(event: SimulationEvent): SimulationEvent;
  dequeue(): SimulationEvent | undefined;
  clear(): void;
  snapshot(): SimulationEvent[];
}

export function createManualInteractionQueue(): ManualInteractionQueue {
  const items: SimulationEvent[] = [];
  return {
    enqueue(event) {
      const queued = { ...event, source: 'manual' as const, status: 'queued' as const };
      items.push(queued);
      return { ...queued };
    },
    dequeue() {
      const item = items.shift();
      return item ? { ...item } : undefined;
    },
    clear() {
      items.splice(0);
    },
    snapshot() {
      return items.map(item => ({ ...item }));
    }
  };
}
