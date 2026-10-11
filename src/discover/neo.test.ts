import { describe, expect, it } from 'vitest';
import {
  addDays,
  buildNeoUrl,
  closestOf,
  formatKm,
  formatLunar,
  formatSize,
  ldPosition,
  neoWindow,
  parseNeoFeed,
  sizeComparison,
  sortNeo,
} from './neo';

const obj = (name: string, lunar: number, min: number, max: number, time: string, extra: object = {}) => ({
  id: name,
  name: `(${name})`,
  nasa_jpl_url: 'http://ssd.jpl.nasa.gov/x',
  is_potentially_hazardous_asteroid: false,
  estimated_diameter: { meters: { estimated_diameter_min: min, estimated_diameter_max: max } },
  close_approach_data: [
    {
      close_approach_date: '2024-01-01',
      close_approach_date_full: `2024-Jan-01 ${time}`,
      relative_velocity: { kilometers_per_second: '9.5' },
      miss_distance: { lunar: String(lunar), kilometers: String(lunar * 384400) },
    },
  ],
  ...extra,
});

const feed = {
  near_earth_objects: {
    '2024-01-01': [obj('2024 AA', 0.4, 10, 14, '12:30'), obj('2024 BB', 25, 300, 500, '03:10', { is_potentially_hazardous_asteroid: true })],
    '2024-01-02': [{ name: 'broken' }],
  },
};

describe('neo feed', () => {
  it('parses objects, cleans names, upgrades urls, skips broken rows', () => {
    const list = parseNeoFeed(feed);
    expect(list.map((o) => o.name)).toEqual(['2024 BB', '2024 AA']); // sorted by time
    expect(list[1]).toMatchObject({ date: '2024-01-01', time: '12:30', lunar: 0.4, kmPerSec: 9.5, diameterM: 12, hazardous: false });
    expect(list[0].hazardous).toBe(true);
    expect(list[0].url).toBe('https://ssd.jpl.nasa.gov/x');
    expect(parseNeoFeed(null)).toEqual([]);
  });

  it('sorts and finds the closest', () => {
    const list = parseNeoFeed(feed);
    expect(sortNeo(list, 'distance')[0].name).toBe('2024 AA');
    expect(sortNeo(list, 'size')[0].name).toBe('2024 BB');
    expect(closestOf(list)?.name).toBe('2024 AA');
    expect(closestOf([])).toBeNull();
  });
});

describe('neo helpers', () => {
  it('builds a seven day window', () => {
    expect(addDays('2024-02-27', 3)).toBe('2024-03-01'); // leap year
    expect(neoWindow('2026-10-10')).toEqual({ start: '2026-10-10', end: '2026-10-16' });
    const u = new URL(buildNeoUrl('2024-01-01', '2024-01-07', 'K'));
    expect(u.searchParams.get('end_date')).toBe('2024-01-07');
  });

  it('places distances on a log ruler', () => {
    expect(ldPosition(0.001)).toBe(0);
    expect(ldPosition(1000)).toBe(1);
    expect(ldPosition(1)).toBeGreaterThan(ldPosition(0.5));
    expect(ldPosition(1)).toBeCloseTo(0.4, 1);
  });

  it('formats distances and sizes', () => {
    expect(formatLunar(0.4)).toBe('0.40');
    expect(formatLunar(1234.5)).toBe('1,235');
    expect(formatKm(161_920.4)).toBe('161,920 km');
    expect(formatSize(12.4)).toBe('12 m');
    expect(formatSize(1500)).toBe('1.5 km');
    expect(sizeComparison(12)).toBe('a bus');
    expect(sizeComparison(5000)).toBe('a mountain');
  });
});
