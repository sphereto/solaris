/**
 * User settings, saved on this device. No React in here so plain modules (the 3D
 * scene, date formatting, the NASA client) can read them too.
 */

export type Labels = 'off' | 'tilt' | 'always';
export type Quality = 'auto' | 'high' | 'saver';
export type DialSpeed = 'slow' | 'normal' | 'fast';
export type StartView = 'overhead' | 'angled' | 'low';
export type ReduceMotion = 'auto' | 'on' | 'off';
export type DateFormat = 'mdy' | 'dmy' | 'iso';
export type ClockFormat = '24' | '12';
export type Units = 'metric' | 'miles';

export interface Settings {
  glow: boolean;
  ringShadows: boolean;
  skyEffects: boolean;
  labels: Labels;
  quality: Quality;
  spinSpeed: number; // 0..100, 40 is the original speed
  dialSpeed: DialSpeed;
  startView: StartView;
  tapToTilt: boolean;
  reduceMotion: ReduceMotion;
  dateFormat: DateFormat;
  clock: ClockFormat;
  nasaKey: string;
  units: Units;
  saveData: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  glow: true,
  ringShadows: true,
  skyEffects: true,
  labels: 'tilt',
  quality: 'auto',
  spinSpeed: 40,
  dialSpeed: 'normal',
  startView: 'overhead',
  tapToTilt: true,
  reduceMotion: 'auto',
  dateFormat: 'mdy',
  clock: '24',
  nasaKey: '',
  units: 'metric',
  saveData: false,
};

const CHOICES: { [K in keyof Settings]?: readonly string[] } = {
  labels: ['off', 'tilt', 'always'],
  quality: ['auto', 'high', 'saver'],
  dialSpeed: ['slow', 'normal', 'fast'],
  startView: ['overhead', 'angled', 'low'],
  reduceMotion: ['auto', 'on', 'off'],
  dateFormat: ['mdy', 'dmy', 'iso'],
  clock: ['24', '12'],
  units: ['metric', 'miles'],
};

/** Keeps only valid values from whatever was stored; everything else falls back to the default. */
export function sanitizeSettings(raw: unknown): Settings {
  const out: Settings = { ...DEFAULT_SETTINGS };
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Record<string, unknown>;
  const target = out as unknown as Record<string, unknown>;
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    const v = r[key];
    const def = DEFAULT_SETTINGS[key];
    if (typeof def === 'boolean') {
      if (typeof v === 'boolean') target[key] = v;
    } else if (key === 'spinSpeed') {
      if (typeof v === 'number' && Number.isFinite(v)) target[key] = Math.min(100, Math.max(0, Math.round(v)));
    } else if (key === 'nasaKey') {
      if (typeof v === 'string') {
        const k = v.trim();
        if (/^[A-Za-z0-9_-]{0,80}$/.test(k)) target[key] = k;
      }
    } else if (typeof v === 'string' && CHOICES[key]?.includes(v)) {
      target[key] = v;
    }
  }
  return out;
}

const STORAGE_KEY = 'solaris.settings.v1';

function load(): Settings {
  try {
    const s = typeof localStorage === 'undefined' ? null : localStorage.getItem(STORAGE_KEY);
    return sanitizeSettings(s ? JSON.parse(s) : null);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

type Listener = () => void;
let current: Settings = load();
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l());
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* storage blocked or full: settings still work for this session */
  }
}

export const settingsCore = {
  get: (): Settings => current,
  set(patch: Partial<Settings>) {
    const next = sanitizeSettings({ ...current, ...patch });
    if (JSON.stringify(next) === JSON.stringify(current)) return;
    current = next;
    save();
    emit();
  },
  reset() {
    current = { ...DEFAULT_SETTINGS };
    save();
    emit();
  },
  /** Re-read storage, for example after another tab changed it. */
  reload() {
    const next = load();
    if (JSON.stringify(next) === JSON.stringify(current)) return;
    current = next;
    emit();
  },
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) settingsCore.reload();
  });
}
