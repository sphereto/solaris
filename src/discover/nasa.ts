import { settingsCore } from '../state/settingsCore';

/**
 * NASA APOD (Astronomy Picture of the Day) client. Pure helpers plus a small
 * fetch/cache layer. No React here so the date and parsing rules are unit
 * tested on their own.
 */

export const APOD_FIRST_DATE = '1995-06-16';
const ENDPOINT = 'https://api.nasa.gov/planetary/apod';
const TIMEOUT_MS = 10_000;
const CACHE_PREFIX = 'solaris.apod.v1.';

export interface Apod {
  date: string; // YYYY-MM-DD
  title: string;
  explanation: string;
  mediaType: 'image' | 'video' | 'other';
  url: string;
  hdUrl?: string;
  thumbUrl?: string;
  credit?: string;
}

export type NasaErrorKind = 'rate' | 'server' | 'request' | 'shape' | 'network';

export class NasaError extends Error {
  constructor(public kind: NasaErrorKind) {
    super(kind);
  }
}

export function messageFor(kind: NasaErrorKind): string {
  switch (kind) {
    case 'rate':
      return 'NASA is rate limiting requests right now. Try again in a minute.';
    case 'server':
      return 'NASA is not responding right now. Try again later.';
    case 'network':
      return 'Could not reach NASA. Check your connection.';
    default:
      return 'Could not load this from NASA.';
  }
}

/** Today's date in US Eastern time, which is when APOD publishes. */
export function etToday(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** The viewer's local calendar date as YYYY-MM-DD. */
export function localIso(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** ISO strings sort the same as dates, so plain comparison is enough. */
export function clampApodDate(iso: string, today: string): string {
  if (iso < APOD_FIRST_DATE) return APOD_FIRST_DATE;
  if (iso > today) return today;
  return iso;
}

/** Which APOD date to show for the date the dial is pointing at. */
export function apodDateFor(shown: Date, today: string = etToday()): string {
  return clampApodDate(localIso(shown), today);
}

export function buildApodUrl(date: string, key: string): string {
  const q = new URLSearchParams({ api_key: key, date, thumbs: 'true' });
  return `${ENDPOINT}?${q.toString()}`;
}

/** Only https image/links reach the DOM; old APOD links are plain http. */
export function safeUrl(u: unknown): string | undefined {
  if (typeof u !== 'string') return undefined;
  if (u.startsWith('https://')) return u;
  if (u.startsWith('http://')) return `https://${u.slice('http://'.length)}`;
  return undefined;
}

export function parseApod(raw: unknown): Apod | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const str = (k: string) => (typeof r[k] === 'string' ? (r[k] as string) : undefined);
  const date = str('date');
  const title = str('title');
  const url = safeUrl(r.url);
  if (!date || !title || !url) return null;
  const mt = str('media_type');
  return {
    date,
    title,
    explanation: str('explanation') ?? '',
    mediaType: mt === 'image' || mt === 'video' ? mt : 'other',
    url,
    hdUrl: safeUrl(r.hdurl),
    thumbUrl: safeUrl(r.thumbnail_url),
    credit: str('copyright')?.replace(/\s+/g, ' ').trim() || undefined,
  };
}

export function nasaKey(): string {
  return settingsCore.get().nasaKey || import.meta.env.VITE_NASA_API_KEY || 'DEMO_KEY';
}

export async function getJson(url: string, signal: AbortSignal): Promise<unknown> {
  const ctl = new AbortController();
  const onAbort = () => ctl.abort();
  signal.addEventListener('abort', onAbort);
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    let res: Response;
    try {
      res = await fetch(url, { signal: ctl.signal });
    } catch {
      throw new NasaError('network');
    }
    if (!res.ok) {
      throw new NasaError(res.status === 429 ? 'rate' : res.status >= 500 ? 'server' : 'request');
    }
    return await res.json().catch(() => {
      throw new NasaError('shape');
    });
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
  }
}

export async function fetchApod(date: string, signal: AbortSignal): Promise<Apod> {
  const apod = parseApod(await getJson(buildApodUrl(date, nasaKey()), signal));
  if (!apod) throw new NasaError('shape');
  return apod;
}

/** A past picture never changes, so it is cached for good. Storage can fail; that is fine. */
export function readCachedApod(date: string): Apod | null {
  try {
    const s = localStorage.getItem(CACHE_PREFIX + date);
    return s ? parseApod(JSON.parse(s)) : null;
  } catch {
    return null;
  }
}

export function writeCachedApod(apod: Apod): void {
  try {
    localStorage.setItem(
      CACHE_PREFIX + apod.date,
      JSON.stringify({ ...apod, hdurl: apod.hdUrl, thumbnail_url: apod.thumbUrl, media_type: apod.mediaType, copyright: apod.credit }),
    );
  } catch {
    /* storage full or blocked */
  }
}

export interface KeyTest {
  state: 'ok' | 'invalid' | 'limited' | 'error';
  message: string;
}

/** Turns NASA's reply to a test request into a plain message. */
export function classifyKeyResponse(status: number, body: string, remaining: string | null): KeyTest {
  if (status >= 200 && status < 300) {
    const n = remaining !== null && remaining !== '' ? Number(remaining) : NaN;
    return { state: 'ok', message: Number.isFinite(n) ? `Key works. ${n.toLocaleString('en-US')} requests left this hour.` : 'Key works.' };
  }
  if (/API_KEY_(INVALID|MISSING)/.test(body)) return { state: 'invalid', message: 'NASA says this key is not valid. Check for a missing or extra character.' };
  if (status === 429 || /OVER_RATE_LIMIT/.test(body)) return { state: 'limited', message: 'This key has hit its hourly limit. It is valid; try again later.' };
  return { state: 'error', message: `NASA answered with an error (HTTP ${status}).` };
}

/** Asks NASA for one old Picture of the Day with the given key and reports what happened. */
export async function testNasaKey(key: string): Promise<KeyTest> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(buildApodUrl('2024-01-01', key), { signal: ctl.signal });
    const body = res.ok ? '' : await res.text().catch(() => '');
    return classifyKeyResponse(res.status, body, res.headers.get('x-ratelimit-remaining'));
  } catch {
    return { state: 'error', message: 'Could not reach NASA. Check your connection.' };
  } finally {
    clearTimeout(timer);
  }
}
