/**
 * NASA NeoWs: near-Earth asteroid close approaches. The feed returns up to
 * seven days at a time, so the screen shows a seven day window that starts at
 * the date on the dial.
 */
import { NasaError, getJson, nasaKey, safeUrl } from './nasa';

const ENDPOINT = 'https://api.nasa.gov/neo/rest/v1/feed';
const DAY_MS = 86_400_000;

export interface NeoObject {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD (UTC)
  time: string | null; // HH:MM (UTC)
  lunar: number; // miss distance in Moon distances
  km: number;
  kmPerSec: number;
  diameterM: number; // average of NASA's min and max estimate
  hazardous: boolean;
  url?: string;
}

export type SortKey = 'date' | 'distance' | 'size';

export function addDays(iso: string, n: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

export function neoWindow(start: string): { start: string; end: string } {
  return { start, end: addDays(start, 6) };
}

export function buildNeoUrl(start: string, end: string, key: string): string {
  return `${ENDPOINT}?${new URLSearchParams({ start_date: start, end_date: end, api_key: key })}`;
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

export function parseNeoFeed(raw: unknown): NeoObject[] {
  const days = (raw as { near_earth_objects?: unknown } | null)?.near_earth_objects;
  if (!days || typeof days !== 'object') return [];
  const out: NeoObject[] = [];
  for (const [date, list] of Object.entries(days as Record<string, unknown>)) {
    if (!Array.isArray(list)) continue;
    for (const o of list as Record<string, any>[]) {
      const approaches: Record<string, any>[] = Array.isArray(o?.close_approach_data) ? o.close_approach_data : [];
      const a = approaches.find((x) => x?.close_approach_date === date) ?? approaches[0];
      const lunar = num(a?.miss_distance?.lunar);
      const km = num(a?.miss_distance?.kilometers);
      const kmPerSec = num(a?.relative_velocity?.kilometers_per_second);
      const dMin = num(o?.estimated_diameter?.meters?.estimated_diameter_min);
      const dMax = num(o?.estimated_diameter?.meters?.estimated_diameter_max);
      if (typeof o?.name !== 'string' || lunar === null || km === null || kmPerSec === null || dMin === null || dMax === null) continue;
      const time = typeof a?.close_approach_date_full === 'string' ? (/(\d{2}:\d{2})$/.exec(a.close_approach_date_full)?.[1] ?? null) : null;
      out.push({
        id: String(o.id ?? o.name),
        name: o.name.replace(/^\(|\)$/g, '').trim(),
        date,
        time,
        lunar,
        km,
        kmPerSec,
        diameterM: (dMin + dMax) / 2,
        hazardous: o.is_potentially_hazardous_asteroid === true,
        url: safeUrl(o.nasa_jpl_url),
      });
    }
  }
  return sortNeo(out, 'date');
}

export function sortNeo(list: NeoObject[], key: SortKey): NeoObject[] {
  const byDate = (a: NeoObject, b: NeoObject) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? ''));
  const copy = [...list];
  if (key === 'distance') return copy.sort((a, b) => a.lunar - b.lunar || byDate(a, b));
  if (key === 'size') return copy.sort((a, b) => b.diameterM - a.diameterM || byDate(a, b));
  return copy.sort(byDate);
}

export function closestOf(list: NeoObject[]): NeoObject | null {
  return list.length ? sortNeo(list, 'distance')[0] : null;
}

/** Position on the distance ruler, 0 to 1, on a log scale from 0.05 to 100 Moon distances. */
export function ldPosition(lunar: number): number {
  const lo = Math.log10(0.05);
  const hi = Math.log10(100);
  const p = (Math.log10(Math.max(lunar, 0.0001)) - lo) / (hi - lo);
  return Math.min(1, Math.max(0, p));
}

export function formatLunar(lunar: number): string {
  return lunar < 10 ? lunar.toFixed(2) : Math.round(lunar).toLocaleString('en-US');
}

export function formatKm(km: number): string {
  return `${Math.round(km).toLocaleString('en-US')} km`;
}

export function formatSize(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

/** A rough everyday comparison for the width of an object. */
export function sizeComparison(m: number): string {
  if (m < 3) return 'a car';
  if (m < 15) return 'a bus';
  if (m < 40) return 'a tennis court';
  if (m < 120) return 'a football pitch';
  if (m < 400) return 'the Eiffel Tower';
  if (m < 1000) return 'a skyscraper';
  return 'a mountain';
}

const cache = new Map<string, NeoObject[]>();

export async function loadNeo(start: string, signal: AbortSignal): Promise<NeoObject[]> {
  const hit = cache.get(start);
  if (hit) return hit;
  const { end } = neoWindow(start);
  const raw = await getJson(buildNeoUrl(start, end, nasaKey()), signal);
  if (!raw || typeof raw !== 'object' || !('near_earth_objects' in raw)) throw new NasaError('shape');
  const list = parseNeoFeed(raw);
  cache.set(start, list);
  return list;
}
