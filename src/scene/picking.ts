export interface PickTarget {
  id: number;
  x: number; // screen position of the centre, in pixels
  y: number;
  r: number; // on-screen radius, in pixels
}

/**
 * The target a tap landed on. Small planets get a minimum touch size, and the
 * nearest centre wins when targets overlap. Returns null when nothing is close.
 */
export function pickTarget(targets: PickTarget[], px: number, py: number, minHit = 22, grow = 1.3): number | null {
  let best: number | null = null;
  let bestScore = Infinity;
  for (const t of targets) {
    const hit = Math.max(t.r * grow, minHit);
    const d = Math.hypot(px - t.x, py - t.y);
    if (d <= hit && d / hit < bestScore) {
      best = t.id;
      bestScore = d / hit;
    }
  }
  return best;
}
