import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, sanitizeSettings, settingsCore } from './settingsCore';
import { DIAL_MULTIPLIER, effectiveEffects, labelOpacity, pixelRatioFor, prefersReducedMotion, spinMultiplier } from './settingsMath';

describe('sanitizeSettings', () => {
  it('returns defaults for junk', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings('x')).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps valid values and drops invalid ones', () => {
    const s = sanitizeSettings({ glow: false, labels: 'always', quality: 'ultra', spinSpeed: 250, dialSpeed: 7, nasaKey: ' abc-DEF_123 ', units: 'miles' });
    expect(s.glow).toBe(false);
    expect(s.labels).toBe('always');
    expect(s.quality).toBe('auto');
    expect(s.spinSpeed).toBe(100);
    expect(s.dialSpeed).toBe('normal');
    expect(s.nasaKey).toBe('abc-DEF_123');
    expect(s.units).toBe('miles');
  });

  it('rejects keys with odd characters', () => {
    expect(sanitizeSettings({ nasaKey: 'abc def' }).nasaKey).toBe('');
    expect(sanitizeSettings({ nasaKey: '<script>' }).nasaKey).toBe('');
  });
});

describe('settings store', () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
    settingsCore.reset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('saves changes, notifies once per change and resets', () => {
    let calls = 0;
    const off = settingsCore.subscribe(() => calls++);
    settingsCore.set({ glow: false });
    settingsCore.set({ glow: false });
    expect(calls).toBe(1);
    expect(JSON.parse(store.get('solaris.settings.v1')!).glow).toBe(false);
    settingsCore.reset();
    expect(settingsCore.get().glow).toBe(true);
    off();
  });

  it('reloads from storage', () => {
    store.set('solaris.settings.v1', JSON.stringify({ clock: '12' }));
    settingsCore.reload();
    expect(settingsCore.get().clock).toBe('12');
  });
});

describe('settings math', () => {
  it('maps spin speed so 40 is the original', () => {
    expect(spinMultiplier(40)).toBe(1);
    expect(spinMultiplier(0)).toBeCloseTo(0.1, 5);
    expect(spinMultiplier(100)).toBeCloseTo(2.5, 5);
    expect(spinMultiplier(70)).toBeGreaterThan(spinMultiplier(40));
  });

  it('has dial multipliers and a motion rule', () => {
    expect(DIAL_MULTIPLIER).toEqual({ slow: 0.5, normal: 1, fast: 2 });
    expect(prefersReducedMotion('on', false)).toBe(true);
    expect(prefersReducedMotion('off', true)).toBe(false);
    expect(prefersReducedMotion('auto', true)).toBe(true);
  });

  it('switches heavy effects off in saver mode and when the app is struggling', () => {
    const base = { glow: true, ringShadows: true, skyEffects: true, quality: 'auto' as const };
    expect(effectiveEffects(base, false)).toEqual({ glow: true, ringShadows: true, sky: true });
    expect(effectiveEffects(base, true)).toEqual({ glow: true, ringShadows: false, sky: false });
    expect(effectiveEffects({ ...base, quality: 'saver' }, false)).toEqual({ glow: false, ringShadows: false, sky: false });
    expect(effectiveEffects({ ...base, glow: false }, false).glow).toBe(false);
  });

  it('picks a pixel ratio per quality', () => {
    expect(pixelRatioFor('saver', 3)).toBe(1);
    expect(pixelRatioFor('auto', 3)).toBe(2);
    expect(pixelRatioFor('high', 3)).toBe(3);
    expect(pixelRatioFor('high', 1.5)).toBe(1.5);
  });

  it('fades labels in as the camera tilts and out when zoomed in', () => {
    expect(labelOpacity('off', 22, 0)).toBe(0);
    expect(labelOpacity('always', 90, 0)).toBe(1);
    expect(labelOpacity('tilt', 90, 0)).toBe(0);
    expect(labelOpacity('tilt', 80, 0)).toBeCloseTo(0.5, 5);
    expect(labelOpacity('tilt', 52, 0)).toBe(1);
    expect(labelOpacity('always', 52, 1)).toBe(0);
  });
});
