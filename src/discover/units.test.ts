import { describe, expect, it } from 'vitest';
import { distanceKm, millionKm, sizeMetres } from './units';

describe('units', () => {
  it('formats distances', () => {
    expect(distanceKm(161_920.4, 'metric')).toBe('161,920 km');
    expect(distanceKm(161_920.4, 'miles')).toBe('100,613 mi');
    expect(millionKm(1_486_000, 'metric')).toBe('1.49 million km');
    expect(millionKm(1_486_000, 'miles')).toBe('0.92 million miles');
  });

  it('formats sizes', () => {
    expect(sizeMetres(12.4, 'metric')).toBe('12 m');
    expect(sizeMetres(1500, 'metric')).toBe('1.5 km');
    expect(sizeMetres(12.4, 'miles')).toBe('41 ft');
    expect(sizeMetres(3000, 'miles')).toBe('1.9 mi');
  });
});
