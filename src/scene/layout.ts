/**
 * Pure layout math for the overhead view. No Three.js import, so it is easy to test.
 *
 * Coordinate convention: the ecliptic plane is the XZ plane, +Y is ecliptic north.
 * The camera looks down from +Y with screen-up = -Z, so a planet at heliocentric
 * longitude 0 is on the right of the Sun and longitude increases counter-clockwise
 * on screen, matching how orbits look from above the north pole.
 */

export const FOV_DEG = 40;

/** Radius of the ring each planet sits on. Rings are evenly spaced, not to scale. */
export function ringRadius(index: number): number {
  return 8 + index * 4.6;
}

export const PLANET_COUNT = 8;

/** Everything that must fit on screen at overhead: outermost ring plus a planet's width. */
export const SCENE_RADIUS = ringRadius(PLANET_COUNT - 1) + 2.2;

export function orbitPosition(radius: number, longitudeDeg: number): [number, number, number] {
  const a = (longitudeDeg * Math.PI) / 180;
  return [radius * Math.cos(a), 0, -radius * Math.sin(a)];
}

/**
 * Camera distance that fits the whole system in the shorter screen side.
 * `margin` leaves room for the date text and dial.
 */
export function cameraDistance(aspect: number, fovDeg = FOV_DEG, margin = 1.12): number {
  const halfFov = (fovDeg * Math.PI) / 360;
  return (SCENE_RADIUS * margin) / (Math.tan(halfFov) * Math.min(1, aspect));
}

/** Camera position for a given elevation above the ecliptic (90 = straight overhead). */
export function cameraPosition(distance: number, elevationDeg: number): [number, number, number] {
  const e = (elevationDeg * Math.PI) / 180;
  return [0, distance * Math.sin(e), distance * Math.cos(e)];
}

/** Tap cycles through these elevations. Double tap returns to the first. */
export const PITCH_PRESETS = [90, 52, 22] as const;

export function nextPitchIndex(index: number): number {
  return (index + 1) % PITCH_PRESETS.length;
}

/**
 * Visual spin speed in radians per second from a real rotation period in hours.
 * Real speeds span 10 hours to 243 days, which is unwatchable linearly, so the
 * range is compressed. Ordering is preserved: faster real spin looks faster.
 */
export function visualSpin(periodHours: number): number {
  return 0.6 * Math.pow(24 / Math.abs(periodHours), 0.4);
}
