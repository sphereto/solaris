/**
 * NASA EPIC (Earth Polychromatic Imaging Camera on DSCOVR). Metadata comes
 * from the api.nasa.gov mirror (same key as the rest). Pictures load from the
 * EPIC archive, which needs no key and does not count against the rate limit.
 */
import { nearestDate } from './dates';
import { NasaError, getJson, nasaKey } from './nasa';

const API = 'https://api.nasa.gov/EPIC/api/natural';
const ARCHIVE = 'https://epic.gsfc.nasa.gov/archive/natural';

export interface EpicImage {
  name: string;
  date: string; // YYYY-MM-DD (UTC)
  time: string; // HH:MM (UTC)
  lat: number | null; // where the camera is centred
  lon: number | null;
  distanceKm: number | null; // DSCOVR to Earth
  thumb: string;
  jpg: string;
  png: string;
}

export function buildEpicDatesUrl(key: string): string {
  return `${API}/all?${new URLSearchParams({ api_key: key })}`;
}

export function buildEpicDayUrl(date: string, key: string): string {
  return `${API}/date/${date}?${new URLSearchParams({ api_key: key })}`;
}

export function epicImageUrl(kind: 'thumbs' | 'jpg' | 'png', date: string, name: string): string {
  const [y, m, d] = date.split('-');
  return `${ARCHIVE}/${y}/${m}/${d}/${kind}/${name}.${kind === 'png' ? 'png' : 'jpg'}`;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** The list endpoint has returned plain strings and {date} objects; accept both. */
export function parseEpicDates(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out = new Set<string>();
  for (const item of raw) {
    const d = typeof item === 'string' ? item : (item as { date?: unknown } | null)?.date;
    if (typeof d === 'string' && ISO.test(d)) out.add(d);
  }
  return [...out].sort();
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function parseEpicImages(raw: unknown): EpicImage[] {
  if (!Array.isArray(raw)) return [];
  const out: EpicImage[] = [];
  for (const r of raw as Record<string, unknown>[]) {
    const m = typeof r?.date === 'string' ? /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/.exec(r.date) : null;
    if (typeof r?.image !== 'string' || !m) continue;
    const c = r.centroid_coordinates as Record<string, unknown> | undefined;
    const p = r.dscovr_j2000_position as Record<string, unknown> | undefined;
    const x = num(p?.x);
    const y = num(p?.y);
    const z = num(p?.z);
    out.push({
      name: r.image,
      date: m[1],
      time: m[2],
      lat: num(c?.lat),
      lon: num(c?.lon),
      distanceKm: x !== null && y !== null && z !== null ? Math.hypot(x, y, z) : null,
      thumb: epicImageUrl('thumbs', m[1], r.image),
      jpg: epicImageUrl('jpg', m[1], r.image),
      png: epicImageUrl('png', m[1], r.image),
    });
  }
  return out.sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1));
}

export function formatLatLon(lat: number, lon: number): string {
  const f = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(1)}°${v >= 0 ? pos : neg}`;
  return `${f(lat, 'N', 'S')}, ${f(lon, 'E', 'W')}`;
}

export function formatDistance(km: number): string {
  return `${(km / 1e6).toFixed(2)} million km`;
}

export const nearestEpicDate = nearestDate;

let datesPromise: Promise<string[]> | null = null;
const dayCache = new Map<string, EpicImage[]>();

/** The list of dates is fetched once per session. */
export function loadEpicDates(): Promise<string[]> {
  if (!datesPromise) {
    const p = getJson(buildEpicDatesUrl(nasaKey()), new AbortController().signal).then((raw) => {
      const dates = parseEpicDates(raw);
      if (dates.length === 0) throw new NasaError('shape');
      return dates;
    });
    p.catch(() => {
      datesPromise = null;
    });
    datesPromise = p;
  }
  return datesPromise;
}

export async function loadEpicDay(date: string, signal: AbortSignal): Promise<EpicImage[]> {
  const hit = dayCache.get(date);
  if (hit) return hit;
  const images = parseEpicImages(await getJson(buildEpicDayUrl(date, nasaKey()), signal));
  dayCache.set(date, images);
  return images;
}
