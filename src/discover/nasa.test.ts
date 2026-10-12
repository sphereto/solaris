import { describe, expect, it } from 'vitest';
import {
  APOD_FIRST_DATE,
  apodDateFor,
  buildApodUrl,
  clampApodDate,
  etToday,
  localIso,
  parseApod,
  safeUrl,
} from './nasa';

describe('apod dates', () => {
  it('uses US Eastern time for "today"', () => {
    expect(etToday(new Date('2026-10-10T20:00:00Z'))).toBe('2026-10-10');
    // 02:00 UTC is still the previous evening in New York
    expect(etToday(new Date('2026-10-10T02:00:00Z'))).toBe('2026-10-09');
  });

  it('clamps to the APOD archive range', () => {
    expect(clampApodDate('1990-01-01', '2026-10-10')).toBe(APOD_FIRST_DATE);
    expect(clampApodDate('2031-05-05', '2026-10-10')).toBe('2026-10-10');
    expect(clampApodDate('2020-02-29', '2026-10-10')).toBe('2020-02-29');
  });

  it('formats the local calendar date and clamps it', () => {
    expect(localIso(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(apodDateFor(new Date(2040, 5, 1), '2026-10-10')).toBe('2026-10-10');
  });
});

describe('apod parsing', () => {
  const base = { date: '2026-10-10', title: 'T', url: 'http://apod.nasa.gov/a.jpg', media_type: 'image' };

  it('parses an image and upgrades http to https', () => {
    const a = parseApod({ ...base, explanation: 'x', hdurl: 'https://apod.nasa.gov/h.jpg', copyright: ' A\n B ' });
    expect(a?.url).toBe('https://apod.nasa.gov/a.jpg');
    expect(a?.hdUrl).toBe('https://apod.nasa.gov/h.jpg');
    expect(a?.credit).toBe('A B');
    expect(a?.mediaType).toBe('image');
  });

  it('rejects bad shapes and non-web urls', () => {
    expect(parseApod(null)).toBeNull();
    expect(parseApod({ date: 'x', title: 'y' })).toBeNull();
    expect(parseApod({ ...base, url: 'javascript:alert(1)' })).toBeNull();
    expect(safeUrl('data:text/html,hi')).toBeUndefined();
  });

  it('builds the request url', () => {
    const u = new URL(buildApodUrl('2026-10-10', 'K'));
    expect(u.searchParams.get('date')).toBe('2026-10-10');
    expect(u.searchParams.get('api_key')).toBe('K');
    expect(u.searchParams.get('thumbs')).toBe('true');
  });
});

import { classifyKeyResponse } from './nasa';

describe('key test', () => {
  it('classifies NASA replies', () => {
    expect(classifyKeyResponse(200, '', '9987')).toEqual({ state: 'ok', message: 'Key works. 9,987 requests left this hour.' });
    expect(classifyKeyResponse(200, '', null).message).toBe('Key works.');
    expect(classifyKeyResponse(403, '{"error":{"code":"API_KEY_INVALID"}}', null).state).toBe('invalid');
    expect(classifyKeyResponse(429, '', null).state).toBe('limited');
    expect(classifyKeyResponse(500, 'oops', null)).toEqual({ state: 'error', message: 'NASA answered with an error (HTTP 500).' });
  });
});
