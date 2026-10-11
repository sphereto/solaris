import { describe, expect, it } from 'vitest';
import { freshBucket, kpLabel, parseKp, parseScales, sdoUrl, utcTime } from './sun';

describe('space weather', () => {
  it('takes the newest valid Kp reading', () => {
    const raw = [
      { time_tag: '2026-10-10T15:52:00', kp_index: 4 },
      { time_tag: '2026-10-10T15:53:00', kp_index: 5 },
      { time_tag: '2026-10-10T15:54:00', kp_index: null },
    ];
    expect(parseKp(raw)).toEqual({ value: 5, time: '2026-10-10T15:53:00' });
    expect(parseKp([])).toBeNull();
    expect(parseKp({})).toBeNull();
  });

  it('labels Kp the way NOAA scales it', () => {
    expect(kpLabel(1)).toBe('quiet');
    expect(kpLabel(4)).toBe('active');
    expect(kpLabel(5)).toBe('G1 minor storm');
    expect(kpLabel(9)).toBe('G5 extreme storm');
    expect(kpLabel(12)).toBe('G5 extreme storm');
  });

  it('reads the current scales and rejects odd shapes', () => {
    const raw = { '0': { R: { Scale: '0' }, S: { Scale: '1' }, G: { Scale: '2' } }, '1': {} };
    expect(parseScales(raw)).toEqual({ r: 0, s: 1, g: 2 });
    expect(parseScales({ '0': { R: { Scale: 'x' } } })).toBeNull();
    expect(parseScales(null)).toBeNull();
  });

  it('formats times and builds picture links that refresh every 5 minutes', () => {
    expect(utcTime('2026-10-10T15:53:00')).toBe('15:53 UTC');
    expect(freshBucket(0)).toBe(freshBucket(299_999));
    expect(freshBucket(300_000)).toBe(freshBucket(0) + 1);
    expect(sdoUrl('0304', 1024, 7)).toBe('https://sdo.gsfc.nasa.gov/assets/img/latest/latest_1024_0304.jpg?t=7');
  });
});
