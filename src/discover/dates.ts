const dayMs = 86_400_000;
const t = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

export function clampDate(iso: string, min: string, max: string): string {
  return iso < min ? min : iso > max ? max : iso;
}

/** The date in `dates` closest to `iso`. Ties go to the earlier date. */
export function nearestDate(dates: string[], iso: string): string | null {
  let best: string | null = null;
  let bestDiff = Infinity;
  for (const d of dates) {
    const diff = Math.abs(t(d) - t(iso)) / dayMs;
    if (diff < bestDiff || (diff === bestDiff && best !== null && d < best)) {
      best = d;
      bestDiff = diff;
    }
  }
  return best;
}
