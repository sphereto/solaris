import { describe, expect, it } from 'vitest';
import { nearestDate } from './dates';
import { epicImageUrl, formatDistance, formatLatLon, parseEpicDates, parseEpicImages } from './epic';

describe('epic dates', () => {
  it('accepts strings or {date} objects, sorted and unique', () => {
    expect(parseEpicDates(['2020-01-02', { date: '2019-05-30' }, '2020-01-02', 'bad', null])).toEqual(['2019-05-30', '2020-01-02']);
    expect(parseEpicDates({})).toEqual([]);
  });

  it('finds the nearest date, earlier on a tie', () => {
    const d = ['2020-01-01', '2020-01-05'];
    expect(nearestDate(d, '2020-01-03')).toBe('2020-01-01');
    expect(nearestDate(d, '2020-01-04')).toBe('2020-01-05');
    expect(nearestDate([], '2020-01-04')).toBeNull();
  });
});

describe('epic images', () => {
  const sample = [
    {
      image: 'epic_1b_20190530011359',
      date: '2019-05-30 01:09:54',
      centroid_coordinates: { lat: 12.34, lon: -45.67 },
      dscovr_j2000_position: { x: -1_000_000, y: 1_000_000, z: 500_000 },
    },
    { image: 'epic_1b_20190530001359', date: '2019-05-30 00:09:54' },
    { image: 5, date: 'x' },
  ];

  it('parses, sorts by time, and drops bad rows', () => {
    const imgs = parseEpicImages(sample);
    expect(imgs.map((i) => i.time)).toEqual(['00:09', '01:09']);
    expect(imgs[1].lat).toBe(12.34);
    expect(imgs[1].distanceKm).toBeCloseTo(1_500_000, -3);
    expect(imgs[0].distanceKm).toBeNull();
  });

  it('builds archive urls from the image date', () => {
    const [first] = parseEpicImages(sample);
    expect(first.jpg).toBe('https://epic.gsfc.nasa.gov/archive/natural/2019/05/30/jpg/epic_1b_20190530001359.jpg');
    expect(first.png.endsWith('/png/epic_1b_20190530001359.png')).toBe(true);
    expect(epicImageUrl('thumbs', '2019-05-30', 'a')).toContain('/thumbs/a.jpg');
  });

  it('formats position and distance', () => {
    expect(formatLatLon(12.34, -45.67)).toBe('12.3°N, 45.7°W');
    expect(formatLatLon(-3.2, 100)).toBe('3.2°S, 100.0°E');
    expect(formatDistance(1_486_000)).toBe('1.49 million km');
  });
});
