import { describe, expect, it } from 'vitest';
import { ATMOSPHERES, ringAxes } from './effects';

describe('ring axes', () => {
  it('is the world axes for an untilted planet', () => {
    const { axis, e1, e2 } = ringAxes(0);
    expect(axis).toEqual([-0, 1, 0]);
    expect(e1).toEqual([1, 0, 0]);
    expect(e2).toEqual([0, 0, 1]);
  });

  it('keeps the axes unit length and perpendicular when tilted', () => {
    const { axis, e1, e2 } = ringAxes(26.73);
    const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    expect(dot(axis, axis)).toBeCloseTo(1, 6);
    expect(dot(axis, e1)).toBeCloseTo(0, 6);
    expect(dot(axis, e2)).toBeCloseTo(0, 6);
    expect(dot(e1, e2)).toBeCloseTo(0, 6);
    // Same tilt the scene applies: rotating +Y about Z by 26.73 degrees.
    expect(axis[0]).toBeCloseTo(-Math.sin((26.73 * Math.PI) / 180), 6);
  });
});

describe('atmospheres', () => {
  it('skips Mercury and gives each other planet a halo bigger than the planet', () => {
    expect(ATMOSPHERES.mercury).toBeUndefined();
    for (const a of Object.values(ATMOSPHERES)) {
      expect(a!.scale).toBeGreaterThan(1.1);
      expect(a!.opacity).toBeGreaterThan(0);
      expect(a!.opacity).toBeLessThanOrEqual(1);
    }
  });
});

import { bodyPointShadow, ringPointShade } from './effects';

describe('ring shadow geometry', () => {
  const center: [number, number, number] = [20, 0, 0];
  const R = 2.6;

  it('puts the part of the ring directly behind the planet in shadow, and the sunlit side in light', () => {
    expect(ringPointShade([23.5, 0, 0], center, R)).toBeGreaterThan(0.9); // behind, away from the Sun
    expect(ringPointShade([16.5, 0, 0], center, R)).toBe(0); // in front, toward the Sun
    expect(ringPointShade([20, 0, 5], center, R)).toBe(0); // far to the side
  });

  it('softens at the shadow edge', () => {
    const edge = ringPointShade([23, 0, 2.95], center, R);
    expect(edge).toBeGreaterThan(0);
    expect(edge).toBeLessThan(1);
  });

  it('casts no ring shadow on the planet when the Sun sits in the ring plane', () => {
    // Untilted planet: the ecliptic plane (where the Sun is) contains the rings, so they are edge-on.
    for (let lat = -80; lat <= 80; lat += 20) {
      const a = (lat * Math.PI) / 180;
      const p: [number, number, number] = [20 - R * Math.cos(a), R * Math.sin(a), 0];
      expect(bodyPointShadow(p, center, 0, R * 1.07, R * 2.15)).toBe(0);
    }
  });

  it('casts a band of ring shadow on the sunlit side of a tilted planet', () => {
    let shaded = 0;
    for (let lat = -80; lat <= 80; lat += 5) {
      const a = (lat * Math.PI) / 180;
      const p: [number, number, number] = [20 - R * Math.cos(a), R * Math.sin(a), 0];
      if (bodyPointShadow(p, center, 26.73, R * 1.07, R * 2.15) > 0) shaded++;
    }
    expect(shaded).toBeGreaterThan(2);
    expect(shaded).toBeLessThan(30); // a band, not the whole planet
  });
});
