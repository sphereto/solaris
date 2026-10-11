import { describe, expect, it } from 'vitest';
import { EMPTY_SNAPSHOT } from './exoShape';
import { formatLightYears, formatPeriod, formatTemp, isSnapshot, orbitRadiusPx, planetDotRadius, sizeCirclePx, starColor } from './exoplanets';

describe('exoplanet helpers', () => {
  it('validates a snapshot', () => {
    expect(isSnapshot(EMPTY_SNAPSHOT)).toBe(true);
    expect(isSnapshot({})).toBe(false);
    expect(isSnapshot(null)).toBe(false);
  });

  it('formats distances, periods and temperatures', () => {
    expect(formatLightYears(4.24)).toBe('4.2 light-years');
    expect(formatLightYears(2840.4)).toBe('2,840 light-years');
    expect(formatPeriod(11.19)).toBe('11 days');
    expect(formatPeriod(3.4)).toBe('3.4 days');
    expect(formatPeriod(4332.6)).toBe('11.9 years');
    expect(formatTemp(288)).toBe('288 K (15 °C)');
  });

  it('draws within the diagram', () => {
    expect(orbitRadiusPx(0.0001)).toBe(30);
    expect(orbitRadiusPx(10_000)).toBe(112);
    expect(orbitRadiusPx(1)).toBeCloseTo(71, 0);
    expect(planetDotRadius(null)).toBe(4);
    expect(planetDotRadius(1000)).toBe(10);
    expect(sizeCirclePx(1)).toBe(24);
    expect(sizeCirclePx(0.1)).toBe(6);
    expect(sizeCirclePx(30)).toBe(88);
    expect(starColor(null)).toBe('#ffd27a');
    expect(starColor(3000)).toBe('#ff8a5c');
    expect(starColor(9000)).toBe('#cfe3ff');
  });
});
