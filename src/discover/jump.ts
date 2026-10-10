import { MS_PER_DAY } from '../ephemeris/planets';

/** Whole days from today (local calendar) to the given YYYY-MM-DD date. */
export function offsetForIsoDate(iso: string, now: Date = new Date()): number {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((target.getTime() - today.getTime()) / MS_PER_DAY);
  return Number.isFinite(days) ? days : 0;
}
