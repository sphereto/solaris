/**
 * NASA Mars Rover Photos client. The manifest lists which Earth dates have
 * photos, so scrubbing the dial can land on the nearest day that does
 * (rovers do not shoot every day).
 */
import { nearestDate } from './dates';
import { NasaError, getJson, nasaKey, safeUrl } from './nasa';

export type RoverName = 'curiosity' | 'perseverance';
export const ROVERS: { id: RoverName; label: string }[] = [
  { id: 'curiosity', label: 'Curiosity' },
  { id: 'perseverance', label: 'Perseverance' },
];

const BASE = 'https://api.nasa.gov/mars-photos/api/v1';

export interface ManifestDay {
  date: string;
  sol: number;
  total: number;
}

export interface Manifest {
  name: string;
  landingDate: string;
  maxDate: string;
  status: string;
  days: ManifestDay[]; // ascending by date, only days with photos
}

export interface MarsPhoto {
  id: number;
  sol: number;
  date: string;
  camera: string; // short code, e.g. MAST
  cameraName: string; // full name
  src: string;
}

export function buildManifestUrl(rover: RoverName, key: string): string {
  return `${BASE}/manifests/${rover}?${new URLSearchParams({ api_key: key })}`;
}

export function buildPhotosUrl(rover: RoverName, date: string, key: string): string {
  return `${BASE}/rovers/${rover}/photos?${new URLSearchParams({ earth_date: date, api_key: key })}`;
}

export function parseManifest(raw: unknown): Manifest | null {
  const m = (raw as { photo_manifest?: Record<string, unknown> } | null)?.photo_manifest;
  if (!m || typeof m !== 'object') return null;
  const { name, landing_date, max_date, status, photos } = m as Record<string, unknown>;
  if (typeof name !== 'string' || typeof landing_date !== 'string' || typeof max_date !== 'string') return null;
  if (!Array.isArray(photos)) return null;
  const days: ManifestDay[] = [];
  for (const p of photos as Record<string, unknown>[]) {
    if (typeof p?.earth_date === 'string' && typeof p.sol === 'number' && typeof p.total_photos === 'number' && p.total_photos > 0) {
      days.push({ date: p.earth_date, sol: p.sol, total: p.total_photos });
    }
  }
  days.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { name, landingDate: landing_date, maxDate: max_date, status: typeof status === 'string' ? status : '', days };
}

export function parsePhotos(raw: unknown): MarsPhoto[] {
  const list = (raw as { photos?: unknown } | null)?.photos;
  if (!Array.isArray(list)) return [];
  const out: MarsPhoto[] = [];
  for (const p of list as Record<string, unknown>[]) {
    const cam = p?.camera as Record<string, unknown> | undefined;
    const src = safeUrl(p?.img_src);
    if (
      typeof p?.id === 'number' &&
      typeof p.sol === 'number' &&
      typeof p.earth_date === 'string' &&
      typeof cam?.name === 'string' &&
      src
    ) {
      out.push({
        id: p.id,
        sol: p.sol,
        date: p.earth_date,
        camera: cam.name,
        cameraName: typeof cam.full_name === 'string' ? cam.full_name : cam.name,
        src,
      });
    }
  }
  return out;
}

export { clampDate } from './dates';

/** The day with photos closest to `iso`. Ties go to the earlier day. */
export function nearestPhotoDate(days: ManifestDay[], iso: string): string | null {
  return nearestDate(
    days.map((d) => d.date),
    iso,
  );
}

const manifests = new Map<RoverName, Promise<Manifest>>();
const photoCache = new Map<string, MarsPhoto[]>();

/** One manifest per rover per session. It is large, so it is never refetched. */
export function loadManifest(rover: RoverName): Promise<Manifest> {
  let p = manifests.get(rover);
  if (!p) {
    p = getJson(buildManifestUrl(rover, nasaKey()), new AbortController().signal).then((raw) => {
      const m = parseManifest(raw);
      if (!m) throw new NasaError('shape');
      return m;
    });
    p.catch(() => manifests.delete(rover));
    manifests.set(rover, p);
  }
  return p;
}

export async function loadPhotos(rover: RoverName, date: string, signal: AbortSignal): Promise<MarsPhoto[]> {
  const key = `${rover}|${date}`;
  const hit = photoCache.get(key);
  if (hit) return hit;
  const photos = parsePhotos(await getJson(buildPhotosUrl(rover, date, nasaKey()), signal));
  photoCache.set(key, photos);
  return photos;
}
