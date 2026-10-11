import { EMPTY_SNAPSHOT, type Planet, type Snapshot } from './exoShape';

export type { Planet, Snapshot };

export function isSnapshot(v: unknown): v is Snapshot {
  const s = v as Partial<Snapshot> | null;
  return !!s && typeof s.total === 'number' && Array.isArray(s.nearest) && Array.isArray(s.newest) && Array.isArray(s.earthSized) && !!s.byYear && typeof s.byYear === 'object' && !!s.yearCounts;
}

/** The snapshot is a separate chunk, so it only downloads when the screen opens. */
export async function loadSnapshot(): Promise<Snapshot> {
  try {
    const mod = await import('../data/exoplanets.json');
    return isSnapshot(mod.default) ? (mod.default as Snapshot) : EMPTY_SNAPSHOT;
  } catch {
    return EMPTY_SNAPSHOT;
  }
}

export function formatLightYears(ly: number): string {
  return ly < 100 ? `${ly.toFixed(1)} light-years` : `${Math.round(ly).toLocaleString('en-US')} light-years`;
}

export function formatPeriod(days: number): string {
  if (days >= 1000) return `${(days / 365.25).toFixed(1)} years`;
  return `${days < 10 ? days.toFixed(1) : Math.round(days)} days`;
}

export function formatTemp(k: number): string {
  return `${Math.round(k)} K (${Math.round(k - 273.15)} °C)`;
}

export function methodLabel(m: string): string {
  return m.toLowerCase();
}

/** Star colour from its surface temperature. */
export function starColor(teff: number | null): string {
  if (teff === null) return '#ffd27a';
  if (teff < 3500) return '#ff8a5c';
  if (teff < 5000) return '#ffb06b';
  if (teff < 6000) return '#ffe08a';
  if (teff < 7500) return '#fff4d6';
  return '#cfe3ff';
}

/** Orbit size on a log scale from 0.01 to 100 AU, in diagram pixels. */
export function orbitRadiusPx(au: number): number {
  const t = (Math.log10(Math.max(au, 0.0001)) + 2) / 4;
  return 30 + Math.min(1, Math.max(0, t)) * 82;
}

export function planetDotRadius(radiusEarth: number | null): number {
  return radiusEarth === null ? 4 : Math.min(10, Math.max(3, 2.5 + Math.sqrt(radiusEarth) * 1.8));
}

/** Width in pixels of a circle showing the planet's size (Earth is 24). */
export function sizeCirclePx(radiusEarth: number): number {
  return Math.min(88, Math.max(6, radiusEarth * 24));
}
