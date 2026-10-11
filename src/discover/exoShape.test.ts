import { describe, expect, it } from 'vitest';
import { type RawRow, isEarthSizedAndMild, shapeSnapshot, toPlanet } from './exoShape';

const row = (over: Partial<RawRow>): RawRow => ({
  pl_name: 'X b',
  hostname: 'X',
  discoverymethod: 'Transit',
  disc_year: 2020,
  disc_pubdate: '2020-05',
  pl_orbper: 10,
  pl_rade: 1,
  pl_bmasse: null,
  pl_eqt: 250,
  pl_orbsmax: 0.1,
  sy_dist: 10,
  sy_pnum: 1,
  st_teff: 5000,
  ...over,
});

describe('exoplanet snapshot', () => {
  it('converts units and tolerates missing values', () => {
    const p = toPlanet(row({ sy_dist: 1.3012, pl_bmasse: null, pl_rade: 1.0449 }))!;
    expect(p.lightYears).toBe(4.2);
    expect(p.radiusEarth).toBe(1.04);
    expect(p.massEarth).toBeNull();
    expect(toPlanet({ pl_name: 5 } as unknown as RawRow)).toBeNull();
  });

  it('filters Earth-sized, mild planets', () => {
    expect(isEarthSizedAndMild(toPlanet(row({ pl_rade: 1.1, pl_eqt: 260 }))!)).toBe(true);
    expect(isEarthSizedAndMild(toPlanet(row({ pl_rade: 11, pl_eqt: 260 }))!)).toBe(false);
    expect(isEarthSizedAndMild(toPlanet(row({ pl_rade: 1, pl_eqt: null }))!)).toBe(false);
  });

  it('builds the lists', () => {
    const rows = [
      row({ pl_name: 'A b', sy_dist: 50, disc_year: 2010, disc_pubdate: '2010-01' }),
      row({ pl_name: 'B b', sy_dist: 2, disc_year: 2024, disc_pubdate: '2024-03', pl_rade: 1.2 }),
      row({ pl_name: 'C b', sy_dist: null, disc_year: 2024, disc_pubdate: '2025-07', discoverymethod: 'Imaging', pl_rade: 11 }),
    ];
    const s = shapeSnapshot(rows, new Date('2026-10-10T00:00:00Z'));
    expect(s.generatedAt).toBe('2026-10-10T00:00:00.000Z');
    expect(s.total).toBe(3);
    expect(s.nearest.map((p) => p.name)).toEqual(['B b', 'A b']); // no distance, not listed
    expect(s.newest.map((p) => p.name)).toEqual(['C b', 'B b', 'A b']);
    expect(s.earthSized.map((p) => p.name)).toEqual(['B b', 'A b']);
    expect(s.yearCounts).toEqual({ 2010: 1, 2024: 2 });
    expect(s.byYear[2024].map((p) => p.name)).toEqual(['B b', 'C b']);
    expect(s.methods[0]).toEqual({ name: 'Transit', count: 2 });
  });

  it('caps the per-year list at 8', () => {
    const rows = Array.from({ length: 20 }, (_, i) => row({ pl_name: `P${i}`, sy_dist: i + 1, disc_year: 2016 }));
    expect(shapeSnapshot(rows).byYear[2016]).toHaveLength(8);
  });
});
