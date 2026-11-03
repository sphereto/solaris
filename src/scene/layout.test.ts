import { describe, expect, it } from 'vitest';
import {
  FOV_DEG,
  PITCH_PRESETS,
  SCENE_RADIUS,
  cameraDistance,
  cameraPosition,
  nextPitchIndex,
  orbitPosition,
  ringRadius,
  visualSpin,
} from './layout';

describe('orbitPosition', () => {
  it('puts longitude 0 on the right and 90 at the top of the screen (-Z)', () => {
    const [x0, y0, z0] = orbitPosition(10, 0);
    expect(x0).toBeCloseTo(10);
    expect(y0).toBe(0);
    expect(z0).toBeCloseTo(0);
    const [x90, , z90] = orbitPosition(10, 90);
    expect(x90).toBeCloseTo(0);
    expect(z90).toBeCloseTo(-10);
  });

  it('keeps the planet on its ring at every angle', () => {
    for (let deg = 0; deg < 360; deg += 17) {
      const [x, , z] = orbitPosition(23, deg);
      expect(Math.hypot(x, z)).toBeCloseTo(23);
    }
  });
});

describe('rings', () => {
  it('are evenly spaced and increasing', () => {
    const gaps = Array.from({ length: 7 }, (_, i) => ringRadius(i + 1) - ringRadius(i));
    gaps.forEach((g) => expect(g).toBeCloseTo(gaps[0]));
    expect(gaps[0]).toBeGreaterThan(0);
  });
});

describe('camera', () => {
  it('sits straight above at 90 degrees', () => {
    const [x, y, z] = cameraPosition(100, 90);
    expect(x).toBe(0);
    expect(y).toBeCloseTo(100);
    expect(z).toBeCloseTo(0);
  });

  it('keeps its distance from the origin at any pitch', () => {
    for (const e of PITCH_PRESETS) {
      const [x, y, z] = cameraPosition(80, e);
      expect(Math.hypot(x, y, z)).toBeCloseTo(80);
    }
  });

  it('fits the whole system in the shorter screen side', () => {
    for (const aspect of [0.45, 0.75, 1, 1.78, 2.2]) {
      const d = cameraDistance(aspect);
      const halfHeight = d * Math.tan((FOV_DEG * Math.PI) / 360);
      const halfWidth = halfHeight * aspect;
      expect(Math.min(halfHeight, halfWidth)).toBeGreaterThanOrEqual(SCENE_RADIUS);
    }
  });

  it('cycles pitch presets and wraps', () => {
    let i = 0;
    const seen: number[] = [];
    for (let n = 0; n < PITCH_PRESETS.length + 1; n++) {
      seen.push(PITCH_PRESETS[i]);
      i = nextPitchIndex(i);
    }
    expect(seen[0]).toBe(90);
    expect(seen[PITCH_PRESETS.length]).toBe(90);
  });
});

describe('visualSpin', () => {
  it('keeps real ordering: faster real spin looks faster', () => {
    expect(visualSpin(9.9)).toBeGreaterThan(visualSpin(24));
    expect(visualSpin(24)).toBeGreaterThan(visualSpin(5832));
  });

  it('is compressed so slow spinners are still watchable', () => {
    expect(visualSpin(5832)).toBeGreaterThan(0.03);
    expect(visualSpin(9.9)).toBeLessThan(1.2);
  });
});
