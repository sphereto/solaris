import { describe, expect, it } from 'vitest';
import {
  MAX_OFFSET_DAYS,
  clampOffset,
  dateForOffset,
  formatClock,
  formatDate,
  formatDayOffset,
  planetStates,
} from './planets';

const J2000 = new Date('2000-01-01T12:00:00Z');

function angleDiff(a: number, b: number): number {
  return ((a - b + 540) % 360) - 180;
}

describe('planetStates', () => {
  it('returns the eight planets in order', () => {
    const ids = planetStates(J2000).map((p) => p.id);
    expect(ids).toEqual(['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']);
  });

  it("puts Earth near 100.4 degrees at J2000 (Sun's geocentric longitude is about 280.4)", () => {
    const earth = planetStates(J2000).find((p) => p.id === 'earth')!;
    expect(Math.abs(angleDiff(earth.longitudeDeg, 100.4))).toBeLessThan(0.5);
    expect(earth.distanceAu).toBeGreaterThan(0.983);
    expect(earth.distanceAu).toBeLessThan(0.985);
  });

  it('keeps every planet inside its known distance range over 60 years', () => {
    const limits: Record<string, [number, number]> = {
      mercury: [0.3, 0.47],
      venus: [0.718, 0.729],
      earth: [0.983, 1.017],
      mars: [1.38, 1.67],
      jupiter: [4.95, 5.46],
      saturn: [9.0, 10.1],
      uranus: [18.25, 20.1],
      neptune: [29.7, 30.4],
    };
    for (let years = 0; years <= 60; years += 3) {
      const date = new Date(J2000.getTime() + years * 365.25 * 86_400_000);
      for (const p of planetStates(date)) {
        const [lo, hi] = limits[p.id];
        expect(p.distanceAu, `${p.id} at +${years}y`).toBeGreaterThanOrEqual(lo);
        expect(p.distanceAu, `${p.id} at +${years}y`).toBeLessThanOrEqual(hi);
      }
    }
  });

  it('moves every planet counter-clockwise (longitude increases) day to day', () => {
    const next = new Date(J2000.getTime() + 86_400_000);
    const a = planetStates(J2000);
    const b = planetStates(next);
    a.forEach((p, i) => {
      const delta = (b[i].longitudeDeg - p.longitudeDeg + 360) % 360;
      expect(delta, p.id).toBeGreaterThan(0);
      expect(delta, p.id).toBeLessThan(7);
    });
  });

  it('brings Earth back near the same longitude after one sidereal year', () => {
    const later = new Date(J2000.getTime() + 365.256363 * 86_400_000);
    const a = planetStates(J2000).find((p) => p.id === 'earth')!;
    const b = planetStates(later).find((p) => p.id === 'earth')!;
    expect(Math.abs(angleDiff(b.longitudeDeg, a.longitudeDeg))).toBeLessThan(0.3);
  });
});

describe('date helpers', () => {
  it('adds day offsets exactly', () => {
    const base = new Date('2026-10-08T04:30:00Z');
    expect(dateForOffset(base, 1).toISOString()).toBe('2026-10-09T04:30:00.000Z');
    expect(dateForOffset(base, -8).toISOString()).toBe('2026-09-30T04:30:00.000Z');
  });

  it('clamps the offset', () => {
    expect(clampOffset(1e9)).toBe(MAX_OFFSET_DAYS);
    expect(clampOffset(-1e9)).toBe(-MAX_OFFSET_DAYS);
    expect(clampOffset(12)).toBe(12);
  });

  it('formats dates as MM/DD/YY', () => {
    expect(formatDate(new Date(2026, 9, 8))).toBe('10/08/26');
    expect(formatDate(new Date(2005, 0, 3))).toBe('01/03/05');
  });

  it('formats the clock as HH:MM', () => {
    expect(formatClock(new Date(2026, 9, 8, 7, 5))).toBe('07:05');
    expect(formatClock(new Date(2026, 9, 8, 18, 39))).toBe('18:39');
    expect(formatClock(new Date(2026, 9, 8, 18, 39), '12')).toBe('6:39 PM');
    expect(formatClock(new Date(2026, 9, 8, 0, 5), '12')).toBe('12:05 AM');
    expect(formatDate(new Date(2026, 9, 8), 'dmy')).toBe('08/10/26');
    expect(formatDate(new Date(2026, 9, 8), 'iso')).toBe('2026-10-08');
  });

  it('formats the day offset', () => {
    expect(formatDayOffset(0)).toBe('today');
    expect(formatDayOffset(0.4)).toBe('today');
    expect(formatDayOffset(120)).toBe('+120 days');
    expect(formatDayOffset(-1)).toBe('-1 day');
    expect(formatDayOffset(-365.4)).toBe('-365 days');
  });
});
