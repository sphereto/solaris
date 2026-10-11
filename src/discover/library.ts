/**
 * NASA Image and Video Library search. No key needed. Pictures come back with
 * a small preview link; larger sizes follow NASA's "~thumb" to "~medium" naming.
 */
import { NasaError, getJson, safeUrl } from './nasa';

const ENDPOINT = 'https://images-api.nasa.gov/search';

export interface LibItem {
  id: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  credit: string;
  thumb: string;
  medium: string; // may not exist for every picture; the viewer falls back to thumb
  page: string; // NASA details page
}

export interface LibResult {
  items: LibItem[];
  total: number;
}

export function buildLibraryUrl(query: string, year: number | null, pageSize = 30): string {
  const q = new URLSearchParams({ q: query, media_type: 'image', page_size: String(pageSize) });
  if (year !== null) {
    q.set('year_start', String(year));
    q.set('year_end', String(year));
  }
  return `${ENDPOINT}?${q.toString()}`;
}

/** Descriptions arrive with HTML tags and entities; the app shows plain text. */
export function plainText(s: unknown): string {
  if (typeof s !== 'string') return '';
  return s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

export function mediumUrl(thumb: string): string {
  return thumb.includes('~thumb.') ? thumb.replace('~thumb.', '~medium.') : thumb;
}

export function parseLibrary(raw: unknown): LibResult {
  const col = (raw as { collection?: { items?: unknown; metadata?: { total_hits?: unknown } } } | null)?.collection;
  const list = Array.isArray(col?.items) ? (col.items as Record<string, any>[]) : [];
  const items: LibItem[] = [];
  for (const it of list) {
    const d = it?.data?.[0];
    if (!d || d.media_type !== 'image' || typeof d.nasa_id !== 'string' || typeof d.title !== 'string') continue;
    const preview = (Array.isArray(it.links) ? it.links : []).find((l: any) => l?.rel === 'preview');
    const thumb = safeUrl(preview?.href);
    const date = typeof d.date_created === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d.date_created) ? d.date_created.slice(0, 10) : null;
    if (!thumb || !date) continue;
    items.push({
      id: d.nasa_id,
      title: plainText(d.title),
      description: plainText(d.description),
      date,
      credit: plainText(d.photographer || d.secondary_creator || d.center) || 'NASA',
      thumb,
      medium: mediumUrl(thumb),
      page: `https://images.nasa.gov/details/${encodeURIComponent(d.nasa_id)}`,
    });
  }
  const total = typeof col?.metadata?.total_hits === 'number' ? col.metadata.total_hits : items.length;
  return { items, total };
}

const cache = new Map<string, LibResult>();

export async function loadLibrary(query: string, year: number | null, signal: AbortSignal): Promise<LibResult> {
  const key = `${year ?? ''}|${query.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const raw = await getJson(buildLibraryUrl(query, year), signal);
  if (!raw || typeof raw !== 'object' || !('collection' in raw)) throw new NasaError('shape');
  const result = parseLibrary(raw);
  cache.set(key, result);
  return result;
}
