import type { DialSpeed, Quality, ReduceMotion, Settings, StartView } from './settingsCore';

/** Planet spin speed: 0 is nearly still, 40 is the original speed, 100 is 2.5 times faster. */
export function spinMultiplier(spinSpeed: number): number {
  const s = Math.min(100, Math.max(0, spinSpeed));
  return s <= 40 ? 0.1 + 0.9 * (s / 40) : 1 + ((s - 40) / 60) * 1.5;
}

export const DIAL_MULTIPLIER: Record<DialSpeed, number> = { slow: 0.5, normal: 1, fast: 2 };

export const START_VIEW_INDEX: Record<StartView, number> = { overhead: 0, angled: 1, low: 2 };

export function prefersReducedMotion(setting: ReduceMotion, osPrefers: boolean): boolean {
  return setting === 'on' ? true : setting === 'off' ? false : osPrefers;
}

export interface Effects {
  glow: boolean;
  ringShadows: boolean;
  sky: boolean;
}

/**
 * Which visual effects are actually drawn. Battery saver turns the heavy ones off,
 * and so does Auto once it has had to slow the app down (`lowPower`).
 */
export function effectiveEffects(s: Pick<Settings, 'glow' | 'ringShadows' | 'skyEffects' | 'quality'>, lowPower: boolean): Effects {
  const heavyOk = s.quality !== 'saver' && !lowPower;
  return {
    glow: s.glow && s.quality !== 'saver',
    ringShadows: s.ringShadows && heavyOk,
    sky: s.skyEffects && heavyOk,
  };
}

export function pixelRatioFor(quality: Quality, deviceRatio: number): number {
  if (quality === 'saver') return 1;
  return Math.min(deviceRatio, quality === 'high' ? 3 : 2);
}

/** Planet labels: fully visible when tilted, fading in as the camera leaves the overhead view. */
export function labelOpacity(mode: Settings['labels'], pitchDeg: number, focusS: number): number {
  const base = mode === 'off' ? 0 : mode === 'always' ? 1 : Math.min(1, Math.max(0, (90 - pitchDeg) / 20));
  return base * (1 - focusS);
}
