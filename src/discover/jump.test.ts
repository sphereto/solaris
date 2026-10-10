import { describe, expect, it } from 'vitest';
import { offsetForIsoDate } from './jump';

describe('offsetForIsoDate', () => {
  const now = new Date(2026, 9, 10, 15, 30); // 10 Oct 2026, mid-afternoon

  it('is zero for today regardless of the time of day', () => {
    expect(offsetForIsoDate('2026-10-10', now)).toBe(0);
  });

  it('counts whole days forward and back', () => {
    expect(offsetForIsoDate('2026-10-13', now)).toBe(3);
    expect(offsetForIsoDate('2026-09-30', now)).toBe(-10);
  });

  it('survives daylight saving changes and long spans', () => {
    expect(offsetForIsoDate('2012-08-06', new Date(2012, 8, 6))).toBe(-31);
    expect(offsetForIsoDate('1995-06-16', now)).toBeLessThan(-11000);
  });

  it('falls back to zero on junk', () => {
    expect(offsetForIsoDate('nope', now)).toBe(0);
  });
});
