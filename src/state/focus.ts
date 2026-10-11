import { useSyncExternalStore } from 'react';
import { PLANET_COUNT } from '../scene/layout';

/**
 * Which planet the camera is zoomed into (index into PLANETS), or null for the
 * overhead view. The 3D scene reads it every frame; React reads it through
 * `useFocusIndex`.
 */
type Listener = () => void;

let index: number | null = null;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l());
}

export const focusStore = {
  get: () => index,
  set(next: number | null) {
    if (next !== null && (!Number.isInteger(next) || next < 0 || next >= PLANET_COUNT)) return;
    if (next === index) return;
    index = next;
    emit();
  },
  /** Previous or next planet. Does nothing at either end of the system. */
  step(delta: number) {
    if (index === null) return;
    const next = index + delta;
    if (next >= 0 && next < PLANET_COUNT) focusStore.set(next);
  },
  clear() {
    focusStore.set(null);
  },
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useFocusIndex(): number | null {
  return useSyncExternalStore(focusStore.subscribe, focusStore.get);
}
