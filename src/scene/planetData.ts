import type { PlanetId } from '../ephemeris/planets';

/**
 * Look-and-feel data for each body. Sizes are NOT to scale (real ones would make
 * Mercury invisible); relative order is kept. Axial tilt and rotation period are real.
 *
 * Venus (177.4 deg) and Uranus (97.8 deg) have obliquities past 90 degrees, which is
 * what makes them spin "backwards" or on their side, so every body spins the same way
 * in its own tilted frame.
 *
 * Texture file names live in public/textures. If a file is missing, the body falls
 * back to its flat `color`, so the app still works before textures are added.
 */

export interface BodyVisual {
  radius: number;
  tiltDeg: number;
  /** Real sidereal rotation period in hours (sign ignored, see note above). */
  spinHours: number;
  color: number;
  texture: string;
}

export interface PlanetVisual extends BodyVisual {
  clouds?: { texture: string; radiusScale: number; driftRadPerSec: number };
  ring?: { innerScale: number; outerScale: number; texture: string };
}

export const SUN_VISUAL: BodyVisual = {
  radius: 4.2,
  tiltDeg: 7.25,
  spinHours: 609.1,
  color: 0xffb347,
  texture: 'sun.jpg',
};

export const PLANET_VISUALS: Record<PlanetId, PlanetVisual> = {
  mercury: { radius: 0.7, tiltDeg: 0.03, spinHours: 1407.6, color: 0x9a9a9a, texture: 'mercury.jpg' },
  venus: { radius: 1.3, tiltDeg: 177.4, spinHours: 5832.5, color: 0xe3c27a, texture: 'venus.jpg' },
  earth: {
    radius: 1.35,
    tiltDeg: 23.44,
    spinHours: 23.93,
    color: 0x3b6fd6,
    texture: 'earth.jpg',
    clouds: { texture: 'earth-clouds.jpg', radiusScale: 1.012, driftRadPerSec: 0.015 },
  },
  mars: { radius: 1.0, tiltDeg: 25.19, spinHours: 24.62, color: 0xc1593a, texture: 'mars.jpg' },
  jupiter: { radius: 3.1, tiltDeg: 3.13, spinHours: 9.93, color: 0xd9b38c, texture: 'jupiter.jpg' },
  saturn: {
    radius: 2.6,
    tiltDeg: 26.73,
    spinHours: 10.66,
    color: 0xe6d3a1,
    texture: 'saturn.jpg',
    // Inner edge is half the outer edge, matching the hole in saturn-ring.png.
    ring: { innerScale: 1.07, outerScale: 2.15, texture: 'saturn-ring.png' },
  },
  uranus: { radius: 1.9, tiltDeg: 97.77, spinHours: 17.24, color: 0x9fe0e6, texture: 'uranus.jpg' },
  neptune: { radius: 1.85, tiltDeg: 28.32, spinHours: 16.11, color: 0x4a6cf0, texture: 'neptune.jpg' },
};
