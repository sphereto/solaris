import { describe, expect, it } from 'vitest';
import { firstSentence, longDate, minutesOfDay, nearestIndexByMinutes, relativeDays } from './feed';

describe('longDate', () => {
  const d = new Date(2026, 9, 5);
  it('follows the date format setting', () => {
    expect(longDate(d, 'mdy')).toBe('Oct 5, 2026');
    expect(longDate(d, 'dmy')).toBe('5 Oct 2026');
    expect(longDate(d, 'iso')).toBe('2026-10-05');
  });
});

describe('firstSentence', () => {
  it('returns the first sentence', () => {
    expect(firstSentence('The Moon is bright tonight over the quiet valley. It rises late.')).toBe('The Moon is bright tonight over the quiet valley.');
  });
  it('joins two sentences when the first is tiny', () => {
    expect(firstSentence('What is that? It is a nebula glowing in the dark. More follows.')).toBe('What is that? It is a nebula glowing in the dark.');
  });
  it('shortens a long sentence at a word with an ellipsis', () => {
    const out = firstSentence('word '.repeat(60).trim() + '.', 60);
    expect(out.length).toBeLessThanOrEqual(61);
    expect(out.endsWith('…')).toBe(true);
    expect(out.includes('  ')).toBe(false);
  });
  it('handles empty text and text without punctuation', () => {
    expect(firstSentence('   ')).toBe('');
    expect(firstSentence('A short caption without a full stop')).toBe('A short caption without a full stop');
  });
});

describe('relativeDays', () => {
  it('reads naturally in both directions', () => {
    expect(relativeDays(0)).toBe('Today');
    expect(relativeDays(-1)).toBe('Yesterday');
    expect(relativeDays(1)).toBe('Tomorrow');
    expect(relativeDays(-5)).toBe('5 days ago');
    expect(relativeDays(10)).toBe('in 10 days');
    expect(relativeDays(-21)).toBe('3 weeks ago');
    expect(relativeDays(-90)).toBe('3 months ago');
    expect(relativeDays(-365)).toBe('about 1 year ago');
    expect(relativeDays(-1100)).toBe('about 3 years ago');
    expect(relativeDays(800)).toBe('in about 2 years');
  });
});

describe('timeline helpers', () => {
  it('turns HH:MM into minutes and finds the nearest frame', () => {
    expect(minutesOfDay('10:44')).toBe(644);
    expect(minutesOfDay('bad')).toBe(0);
    expect(nearestIndexByMinutes([0, 300, 600, 900], 640)).toBe(2);
    expect(nearestIndexByMinutes([0, 300], 150)).toBe(0); // tie goes earlier
    expect(nearestIndexByMinutes([], 10)).toBe(0);
  });
});
