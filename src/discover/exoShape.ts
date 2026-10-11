/**
 * Turns rows from the NASA Exoplanet Archive into the small snapshot the app
 * ships with. This file has no imports so Node can run it directly (the
 * snapshot script) as well as the app and its tests.
 */

export interface RawRow {
  pl_name: string;
  hostname: string;
  discoverymethod: string | null;
  disc_year: number | null;
  disc_pubdate: string | null;
  pl_orbper: number | null; // days
  pl_rade: number | null; // Earth radii
  pl_bmasse: number | null; // Earth masses
  pl_eqt: number | null; // kelvin
  pl_orbsmax: number | null; // AU
  sy_dist: number | null; // parsecs
  sy_pnum: number | null;
  st_teff: number | null; // kelvin
}

export interface Planet {
  name: string;
  host: string;
  method: string | null;
  year: number | null;
  periodDays: number | null;
  radiusEarth: number | null;
  massEarth: number | null;
  tempK: number | null;
  orbitAu: number | null;
  lightYears: number | null;
  starTempK: number | null;
  planetsInSystem: number | null;
}

export interface Snapshot {
  generatedAt: string | null; // null means the data file has not been generated yet
  total: number;
  methods: { name: string; count: number }[];
  yearCounts: Record<string, number>;
  nearest: Planet[];
  newest: Planet[];
  earthSized: Planet[];
  byYear: Record<string, Planet[]>;
}

export const EMPTY_SNAPSHOT: Snapshot = {
  generatedAt: null,
  total: 0,
  methods: [],
  yearCounts: {},
  nearest: [],
  newest: [],
  earthSized: [],
  byYear: {},
};

const PARSEC_IN_LIGHT_YEARS = 3.26156;
const LIST_SIZE = 25;
const PER_YEAR = 8;

const finite = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const round = (v: number | null, digits: number): number | null => (v === null ? null : Number(v.toFixed(digits)));

export function toPlanet(row: RawRow): Planet | null {
  if (typeof row?.pl_name !== 'string' || typeof row.hostname !== 'string') return null;
  const parsecs = finite(row.sy_dist);
  return {
    name: row.pl_name,
    host: row.hostname,
    method: typeof row.discoverymethod === 'string' ? row.discoverymethod : null,
    year: finite(row.disc_year),
    periodDays: round(finite(row.pl_orbper), 3),
    radiusEarth: round(finite(row.pl_rade), 2),
    massEarth: round(finite(row.pl_bmasse), 2),
    tempK: round(finite(row.pl_eqt), 0),
    orbitAu: round(finite(row.pl_orbsmax), 4),
    lightYears: parsecs === null ? null : round(parsecs * PARSEC_IN_LIGHT_YEARS, 1),
    starTempK: round(finite(row.st_teff), 0),
    planetsInSystem: finite(row.sy_pnum),
  };
}

/** Radius 0.5 to 1.6 Earth and equilibrium temperature 180 to 310 K. A rough filter, not a habitability claim. */
export function isEarthSizedAndMild(p: Planet): boolean {
  return p.radiusEarth !== null && p.tempK !== null && p.radiusEarth >= 0.5 && p.radiusEarth <= 1.6 && p.tempK >= 180 && p.tempK <= 310;
}

const nearestFirst = (a: Planet, b: Planet) =>
  (a.lightYears ?? Infinity) - (b.lightYears ?? Infinity) || a.name.localeCompare(b.name);

export function shapeSnapshot(rows: RawRow[], now: Date = new Date()): Snapshot {
  const planets: { p: Planet; pub: string }[] = [];
  for (const row of rows) {
    const p = toPlanet(row);
    if (p) planets.push({ p, pub: typeof row.disc_pubdate === 'string' ? row.disc_pubdate : '' });
  }

  const methodCounts = new Map<string, number>();
  const yearCounts: Record<string, number> = {};
  const yearBuckets = new Map<number, Planet[]>();
  for (const { p } of planets) {
    if (p.method) methodCounts.set(p.method, (methodCounts.get(p.method) ?? 0) + 1);
    if (p.year !== null) {
      yearCounts[p.year] = (yearCounts[p.year] ?? 0) + 1;
      yearBuckets.set(p.year, [...(yearBuckets.get(p.year) ?? []), p]);
    }
  }

  const byYear: Record<string, Planet[]> = {};
  for (const [year, list] of yearBuckets) byYear[year] = list.sort(nearestFirst).slice(0, PER_YEAR);

  const all = planets.map((x) => x.p);
  return {
    generatedAt: now.toISOString(),
    total: planets.length,
    methods: [...methodCounts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 6),
    yearCounts,
    nearest: all.filter((p) => p.lightYears !== null).sort(nearestFirst).slice(0, LIST_SIZE),
    newest: [...planets]
      .sort((a, b) => b.pub.localeCompare(a.pub) || a.p.name.localeCompare(b.p.name))
      .map((x) => x.p)
      .slice(0, LIST_SIZE),
    earthSized: all.filter(isEarthSizedAndMild).sort(nearestFirst).slice(0, LIST_SIZE),
    byYear,
  };
}
