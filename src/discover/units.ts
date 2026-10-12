import type { Units } from '../state/settingsCore';

const MILE_PER_KM = 0.621371;
const FEET_PER_M = 3.28084;
const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

export function distanceKm(km: number, units: Units): string {
  return units === 'miles' ? `${fmt(km * MILE_PER_KM)} mi` : `${fmt(km)} km`;
}

export function millionKm(km: number, units: Units): string {
  return units === 'miles' ? `${((km * MILE_PER_KM) / 1e6).toFixed(2)} million miles` : `${(km / 1e6).toFixed(2)} million km`;
}

export function sizeMetres(m: number, units: Units): string {
  if (units === 'miles') {
    const ft = m * FEET_PER_M;
    return ft < 5280 ? `${fmt(ft)} ft` : `${(ft / 5280).toFixed(1)} mi`;
  }
  return m < 1000 ? `${fmt(m)} m` : `${(m / 1000).toFixed(1)} km`;
}
