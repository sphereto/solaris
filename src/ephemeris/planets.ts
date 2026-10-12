import { Body, EclipticLongitude, HelioDistance } from 'astronomy-engine';
import { type ClockFormat, type DateFormat, settingsCore } from '../state/settingsCore';

/**
 * Pure date -> planet position layer. No React, no Three.js, so it can be
 * unit tested on its own and reused by the Android build.
 *
 * Positions come from astronomy-engine, which is accurate to roughly one
 * arcminute. Angles are heliocentric ecliptic longitude measured
 * counter-clockwise as seen from the ecliptic north pole (equinox of date).
 */

export const PLANETS = [
  { id: 'mercury', name: 'Mercury', body: Body.Mercury },
  { id: 'venus', name: 'Venus', body: Body.Venus },
  { id: 'earth', name: 'Earth', body: Body.Earth },
  { id: 'mars', name: 'Mars', body: Body.Mars },
  { id: 'jupiter', name: 'Jupiter', body: Body.Jupiter },
  { id: 'saturn', name: 'Saturn', body: Body.Saturn },
  { id: 'uranus', name: 'Uranus', body: Body.Uranus },
  { id: 'neptune', name: 'Neptune', body: Body.Neptune },
] as const;

export type PlanetId = (typeof PLANETS)[number]['id'];

export interface PlanetState {
  id: PlanetId;
  name: string;
  /** Heliocentric ecliptic longitude in degrees, 0..360, counter-clockwise from above. */
  longitudeDeg: number;
  /** Distance from the Sun in astronomical units. */
  distanceAu: number;
}

export const MS_PER_DAY = 86_400_000;

/**
 * How far the date dial may travel from today, in days (about 100 years each way).
 * Deliberately conservative: astronomy-engine is designed for a much wider span,
 * but the exact validated range should be confirmed in its docs before widening.
 */
export const MAX_OFFSET_DAYS = 36_500;

export function clampOffset(days: number): number {
  return Math.max(-MAX_OFFSET_DAYS, Math.min(MAX_OFFSET_DAYS, days));
}

export function dateForOffset(base: Date | number, offsetDays: number): Date {
  const t = typeof base === 'number' ? base : base.getTime();
  return new Date(t + offsetDays * MS_PER_DAY);
}

export function planetStates(date: Date): PlanetState[] {
  return PLANETS.map(({ id, name, body }) => ({
    id,
    name,
    longitudeDeg: EclipticLongitude(body, date),
    distanceAu: HelioDistance(body, date),
  }));
}

/** The viewer's local date, as MM/DD/YY by default (the date format setting can change it). */
export function formatDate(date: Date, format: DateFormat = settingsCore.get().dateFormat): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yy = String(date.getFullYear() % 100).padStart(2, '0');
  if (format === 'iso') return `${date.getFullYear()}-${mm}-${dd}`;
  return format === 'dmy' ? `${dd}/${mm}/${yy}` : `${mm}/${dd}/${yy}`;
}

/** HH:MM in the local time zone, 24 hour by default (the clock setting can switch to 12 hour). */
export function formatClock(date: Date, clock: ClockFormat = settingsCore.get().clock): string {
  const mi = String(date.getMinutes()).padStart(2, '0');
  if (clock === '12') {
    const h = date.getHours() % 12 || 12;
    return `${h}:${mi} ${date.getHours() < 12 ? 'AM' : 'PM'}`;
  }
  return `${String(date.getHours()).padStart(2, '0')}:${mi}`;
}

/** "+120 days", "-1 day", or "today". */
export function formatDayOffset(days: number): string {
  const n = Math.round(days);
  if (n === 0) return 'today';
  const abs = Math.abs(n);
  return `${n > 0 ? '+' : '-'}${abs} ${abs === 1 ? 'day' : 'days'}`;
}
