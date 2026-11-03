import type { DateFormat } from '../state/settingsCore';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A date written out for headings: "Oct 10, 2026", "10 Oct 2026" or "2026-10-10", following the date setting. */
export function longDate(d: Date, format: DateFormat): string {
  const day = d.getDate();
  const y = d.getFullYear();
  if (format === 'iso') return `${y}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const mon = MONTHS[d.getMonth()];
  return format === 'dmy' ? `${day} ${mon} ${y}` : `${mon} ${day}, ${y}`;
}

/** The opening sentence of a longer text, shortened to fit. Used for the picture of the day. */
export function firstSentence(text: string, max = 140): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t) return '';
  const sentences = t.match(/[^.!?]+[.!?]+(?=\s|$)/g) ?? [t];
  let out = sentences[0].trim();
  if (out.length < 40 && sentences[1]) out = `${out} ${sentences[1].trim()}`; // very short openers read oddly alone
  if (out.length <= max) return out;
  const cut = out.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 40 ? cut.lastIndexOf(' ') : max).replace(/[,;:\s-]+$/, '')}…`;
}

/** "Today", "Yesterday", "3 days ago", "in 2 weeks", "about 1 year ago". */
export function relativeDays(offset: number): string {
  const n = Math.round(offset);
  if (n === 0) return 'Today';
  const past = n < 0;
  const a = Math.abs(n);
  if (a === 1) return past ? 'Yesterday' : 'Tomorrow';
  const say = (amount: string) => (past ? `${amount} ago` : `in ${amount}`);
  if (a < 14) return say(`${a} days`);
  if (a < 60) return say(`${Math.round(a / 7)} weeks`);
  if (a < 330) return say(`${Math.round(a / 30.4)} months`);
  const years = Math.round(a / 365.25);
  return past ? `about ${years} ${years === 1 ? 'year' : 'years'} ago` : `in about ${years} ${years === 1 ? 'year' : 'years'}`;
}

export function minutesOfDay(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

/** Index of the entry closest to a time of day. Ties go to the earlier one. */
export function nearestIndexByMinutes(minutes: number[], target: number): number {
  let best = 0;
  let bestDiff = Infinity;
  minutes.forEach((m, i) => {
    const d = Math.abs(m - target);
    if (d < bestDiff) {
      best = i;
      bestDiff = d;
    }
  });
  return best;
}
