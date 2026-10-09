import { useSyncExternalStore } from 'react';
import { clampOffset } from '../ephemeris/planets';

/**
 * Tiny external store for the date dial. The 3D scene reads `targetOffset`
 * straight from here every frame (no React re-render in the render loop);
 * React components subscribe through `useTargetOffset`.
 */

type Listener = () => void;

let targetOffset = 0;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l());
}

export const timeStore = {
  /** Days from today the dial is pointing at (can be fractional). */
  getTarget: () => targetOffset,
  setTarget(days: number) {
    const next = clampOffset(days);
    if (next === targetOffset) return;
    targetOffset = next;
    emit();
  },
  nudge(deltaDays: number) {
    timeStore.setTarget(targetOffset + deltaDays);
  },
  reset() {
    timeStore.setTarget(0);
  },
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useTargetOffset(): number {
  return useSyncExternalStore(timeStore.subscribe, timeStore.getTarget);
}
