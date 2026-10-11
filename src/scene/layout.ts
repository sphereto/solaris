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

/* ------------------------------------------------------------------ focus view */

/**
 * Where the zoomed-in planet sits on screen. Portrait screens put its centre on
 * the bottom edge (half the disc shows, text above); landscape screens put it on
 * the left edge (text to the right). `cx` and `cy` are fractions of the screen.
 */
export function focusLayout(aspect: number): { cx: number; cy: number; portrait: boolean } {
  return aspect < 1 ? { cx: 0.5, cy: 1, portrait: true } : { cx: 0, cy: 0.5, portrait: false };
}

/** Planet radius on screen: 78% of the width in portrait, 60% of the height in landscape. */
function focusScreenRadiusOfHalfHeight(aspect: number): number {
  return aspect < 1 ? 0.78 * 2 * aspect : 1.2;
}

/** Camera distance that gives the zoomed-in planet its on-screen size. */
export function focusDistance(aspect: number, radius: number, fovDeg = FOV_DEG): number {
  const tanHalf = Math.tan((fovDeg * Math.PI) / 360);
  return radius / (focusScreenRadiusOfHalfHeight(aspect) * tanHalf);
}

/**
 * Unit vector from the planet to the camera. The camera sits `azimuthDeg` away from
 * the Sun's direction (so the planet shows a lit gibbous face with a terminator) and
 * slightly above the ecliptic. The side is chosen so the Sun appears on the right of
 * the screen, which is the side the text is not on in landscape.
 */
export function focusDirection(px: number, pz: number, elevationDeg = 12, azimuthDeg = 55): [number, number, number] {
  const len = Math.hypot(px, pz) || 1;
  const sx = -px / len;
  const sz = -pz / len;
  const e = (elevationDeg * Math.PI) / 180;
  for (const sign of [1, -1]) {
    const a = (sign * azimuthDeg * Math.PI) / 180;
    const cx = sx * Math.cos(a) + sz * Math.sin(a);
    const cz = -sx * Math.sin(a) + sz * Math.cos(a);
    // Camera right vector is (cz, 0, -cx) for a camera looking at the planet with +Y up.
    if (sx * cz - sz * cx > 0) return [cx * Math.cos(e), Math.sin(e), cz * Math.cos(e)];
  }
  return [0, Math.sin(e), Math.cos(e)];
}

/** Calm spin for the zoomed-in planet: slow enough to read the text, fast enough to see it turn. */
export function focusSpin(overviewSpin: number): number {
  return Math.min(0.25, Math.max(0.05, overviewSpin * 0.3));
}

/** Rings stick out past the disc, so ring planets are framed a little smaller. */
export const RING_FRAME_FACTOR = 1.3;
