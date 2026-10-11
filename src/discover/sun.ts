/**
 * "The Sun now": live pictures from NASA's Solar Dynamics Observatory and
 * current space weather numbers from NOAA. This is live data only, so it does
 * not follow the date dial.
 */
import { getJson } from './nasa';

export type SdoChannel = '0304' | '0193' | 'HMIIC';

export const SDO_CHANNELS: { id: SdoChannel; label: string; note: string }[] = [
  { id: '0304', label: 'Chromosphere', note: "Ultraviolet light from the Sun's lower atmosphere, where flares and prominences show up." },
  { id: '0193', label: 'Corona', note: "The Sun's hot outer atmosphere. Dark patches are coronal holes, where solar wind streams out." },
  { id: 'HMIIC', label: 'Sunspots', note: 'The Sun as the eye would see it, with its sunspots.' },
];

/** The "latest" picture changes every few minutes, so the link changes with it. */
export const freshBucket = (now: number = Date.now()) => Math.floor(now / 300_000);

export function sdoUrl(channel: SdoChannel, size: 512 | 1024 | 4096, bucket: number): string {
  return `https://sdo.gsfc.nasa.gov/assets/img/latest/latest_${size}_${channel}.jpg?t=${bucket}`;
}

const KP_URL = 'https://services.swpc.noaa.gov/json/planetary_k_index_1m.json';
const SCALES_URL = 'https://services.swpc.noaa.gov/products/noaa-scales.json';

export interface Kp {
  value: number;
  time: string; // UTC, as sent by NOAA
}

export interface Scales {
  r: number; // radio blackouts
  s: number; // solar radiation storms
  g: number; // geomagnetic storms
}

export interface SunData {
  kp: Kp | null;
  scales: Scales | null;
}

export function parseKp(raw: unknown): Kp | null {
  if (!Array.isArray(raw)) return null;
  for (let i = raw.length - 1; i >= 0; i--) {
    const r = raw[i] as Record<string, unknown> | null;
    const v = typeof r?.kp_index === 'string' ? Number(r.kp_index) : r?.kp_index;
    if (typeof v === 'number' && Number.isFinite(v) && typeof r?.time_tag === 'string') {
      return { value: v, time: r.time_tag };
    }
  }
  return null;
}

export function kpLabel(kp: number): string {
  const k = Math.round(kp);
  if (k <= 2) return 'quiet';
  if (k === 3) return 'unsettled';
  if (k === 4) return 'active';
  return ['G1 minor storm', 'G2 moderate storm', 'G3 strong storm', 'G4 severe storm', 'G5 extreme storm'][Math.min(k, 9) - 5];
}

export function utcTime(time: string): string {
  return `${time.slice(11, 16)} UTC`;
}

/** NOAA lists the current scales under key "0"; anything else is treated as unavailable. */
export function parseScales(raw: unknown): Scales | null {
  const cur = (raw as Record<string, Record<string, { Scale?: unknown } | undefined> | undefined> | null)?.['0'];
  if (!cur) return null;
  const n = (k: 'R' | 'S' | 'G') => {
    const v = Number(cur[k]?.Scale);
    return Number.isFinite(v) ? v : null;
  };
  const r = n('R');
  const s = n('S');
  const g = n('G');
  return r !== null && s !== null && g !== null ? { r, s, g } : null;
}

export async function loadSun(signal: AbortSignal): Promise<SunData> {
  const [k, s] = await Promise.allSettled([getJson(KP_URL, signal), getJson(SCALES_URL, signal)]);
  return {
    kp: k.status === 'fulfilled' ? parseKp(k.value) : null,
    scales: s.status === 'fulfilled' ? parseScales(s.value) : null,
  };
}
