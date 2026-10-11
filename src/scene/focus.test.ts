import { beforeEach, describe, expect, it } from 'vitest';
import { focusStore } from '../state/focus';
import { FOV_DEG, focusDirection, focusDistance, focusLayout, focusSpin } from './layout';
import { PLANET_FACTS, formatRotation, formatYear } from './planetFacts';
import { pickTarget } from './picking';
import { PLANETS } from '../ephemeris/planets';

describe('focus layout', () => {
  it('puts the planet on the bottom edge in portrait and the left edge in landscape', () => {
    expect(focusLayout(0.46)).toEqual({ cx: 0.5, cy: 1, portrait: true });
    expect(focusLayout(1.78)).toEqual({ cx: 0, cy: 0.5, portrait: false });
  });

  it('sizes the planet on screen', () => {
    const tanHalf = Math.tan((FOV_DEG * Math.PI) / 360);
    // Portrait: radius is 78% of the screen width. Fraction of half-height = 0.78 * 2 * aspect.
    const aspect = 390 / 844;
    const d = focusDistance(aspect, 3.1);
    expect(3.1 / (d * tanHalf)).toBeCloseTo(0.78 * 2 * aspect, 5);
    // Landscape: radius is 60% of the screen height.
    expect(1 / (focusDistance(16 / 9, 1) * tanHalf)).toBeCloseTo(1.2, 5);
  });

  it('puts the camera between sun-side and a quarter turn, with the Sun on the right of the screen', () => {
    for (const [px, pz] of [[10, 0], [-12, 5], [0, 20], [7, -30]]) {
      const [cx, cy, cz] = focusDirection(px, pz);
      expect(Math.hypot(cx, cy, cz)).toBeCloseTo(1, 5);
      expect(cy).toBeGreaterThan(0); // above the ecliptic
      const len = Math.hypot(px, pz);
      const sx = -px / len;
      const sz = -pz / len;
      expect(sx * cz - sz * cx).toBeGreaterThan(0); // Sun is to the right of the view
      const horizontal = Math.hypot(cx, cz);
      const angle = (Math.acos((cx * sx + cz * sz) / horizontal) * 180) / Math.PI;
      expect(angle).toBeCloseTo(55, 3);
    }
  });

  it('keeps the zoomed spin calm but visible', () => {
    expect(focusSpin(0.85)).toBe(0.25);
    expect(focusSpin(0.06)).toBe(0.05);
    expect(focusSpin(0.5)).toBeCloseTo(0.15, 5);
  });
});

describe('picking', () => {
  const targets = [
    { id: 0, x: 100, y: 100, r: 3 },
    { id: 1, x: 130, y: 100, r: 3 },
    { id: 2, x: 300, y: 300, r: 40 },
  ];

  it('gives tiny planets a minimum touch size', () => {
    expect(pickTarget(targets, 110, 100)).toBe(0);
    expect(pickTarget(targets, 122, 100)).toBe(1);
  });

  it('uses the on-screen size for big planets and returns null for empty space', () => {
    expect(pickTarget(targets, 330, 320)).toBe(2);
    expect(pickTarget(targets, 200, 200)).toBeNull();
    expect(pickTarget([], 1, 1)).toBeNull();
  });
});

describe('planet facts', () => {
  it('has a blurb and an orbit for every planet', () => {
    for (const p of PLANETS) {
      expect(PLANET_FACTS[p.id].blurb.length).toBeGreaterThan(10);
      expect(PLANET_FACTS[p.id].orbitDays).toBeGreaterThan(80);
    }
  });

  it('formats rotation and year lengths', () => {
    expect(formatRotation(9.93)).toBe('9 h 56 min');
    expect(formatRotation(23.93)).toBe('23 h 56 min');
    expect(formatRotation(1407.6)).toBe('58.6 days');
    expect(formatRotation(5832.5)).toBe('243 days');
    expect(formatYear(87.97)).toBe('88 days');
    expect(formatYear(4332.59)).toBe('11.9 years');
  });
});

describe('focus store', () => {
  beforeEach(() => focusStore.clear());

  it('sets, steps within the system and clears', () => {
    focusStore.set(4);
    expect(focusStore.get()).toBe(4);
    focusStore.step(1);
    expect(focusStore.get()).toBe(5);
    focusStore.set(7);
    focusStore.step(1);
    expect(focusStore.get()).toBe(7);
    focusStore.set(0);
    focusStore.step(-1);
    expect(focusStore.get()).toBe(0);
    focusStore.clear();
    expect(focusStore.get()).toBeNull();
  });

  it('ignores bad indexes and notifies listeners once per change', () => {
    let calls = 0;
    const off = focusStore.subscribe(() => calls++);
    focusStore.set(99);
    focusStore.set(-1);
    focusStore.set(2);
    focusStore.set(2);
    off();
    expect(calls).toBe(1);
    expect(focusStore.get()).toBe(2);
  });
});
