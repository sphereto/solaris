import type { PlanetId } from '../ephemeris/planets';

/** Plain-language facts for the zoomed-in screen. Orbit periods are real, in Earth days. */
export const PLANET_FACTS: Record<PlanetId, { blurb: string; orbitDays: number }> = {
  mercury: { blurb: 'The smallest planet, and the closest to the Sun.', orbitDays: 87.97 },
  venus: { blurb: 'Hotter than Mercury, and it spins backwards.', orbitDays: 224.7 },
  earth: { blurb: 'Our home, and the only world known to have life.', orbitDays: 365.256 },
  mars: { blurb: 'A cold desert world with the tallest volcano we know.', orbitDays: 686.98 },
  jupiter: { blurb: 'The largest planet. A day here is under ten hours.', orbitDays: 4332.59 },
  saturn: { blurb: 'Famous for its rings, which are mostly ice.', orbitDays: 10759.22 },
  uranus: { blurb: 'An ice giant that rolls around the Sun on its side.', orbitDays: 30688.5 },
  neptune: { blurb: 'The windiest world, and the farthest from the Sun.', orbitDays: 60182 },
};

/** One spin of the planet: "9 h 56 min" for short days, "243 days" for long ones. */
export function formatRotation(hours: number): string {
  const h = Math.abs(hours);
  if (h >= 48) {
    const days = h / 24;
    return days < 100 ? `${days.toFixed(1)} days` : `${Math.round(days)} days`;
  }
  const total = Math.round(h * 60);
  return `${Math.floor(total / 60)} h ${String(total % 60).padStart(2, '0')} min`;
}

/** One trip around the Sun. */
export function formatYear(days: number): string {
  return days < 1000 ? `${Math.round(days)} days` : `${(days / 365.25).toFixed(1)} years`;
}
