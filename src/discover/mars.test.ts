import { describe, expect, it } from 'vitest';
import { buildPhotosUrl, clampDate, nearestPhotoDate, parseManifest, parsePhotos } from './mars';

const manifest = {
  photo_manifest: {
    name: 'Curiosity',
    landing_date: '2012-08-06',
    max_date: '2024-02-19',
    status: 'active',
    photos: [
      { sol: 10, earth_date: '2012-08-16', total_photos: 5 },
      { sol: 0, earth_date: '2012-08-06', total_photos: 3 },
      { sol: 11, earth_date: '2012-08-17', total_photos: 0 },
      { sol: 20, earth_date: '2012-08-26', total_photos: 9 },
    ],
  },
};

describe('mars manifest', () => {
  it('keeps only days with photos, sorted by date', () => {
    const m = parseManifest(manifest);
    expect(m?.days.map((d) => d.date)).toEqual(['2012-08-06', '2012-08-16', '2012-08-26']);
    expect(m?.maxDate).toBe('2024-02-19');
  });

  it('rejects bad shapes', () => {
    expect(parseManifest(null)).toBeNull();
    expect(parseManifest({ photo_manifest: { name: 'x' } })).toBeNull();
  });

  it('finds the nearest day with photos, earlier on a tie', () => {
    const days = parseManifest(manifest)!.days;
    expect(nearestPhotoDate(days, '2012-08-17')).toBe('2012-08-16');
    expect(nearestPhotoDate(days, '2012-08-21')).toBe('2012-08-16'); // 5 vs 5 days: earlier wins
    expect(nearestPhotoDate(days, '2030-01-01')).toBe('2012-08-26');
    expect(nearestPhotoDate([], '2020-01-01')).toBeNull();
  });

  it('clamps to the mission range', () => {
    expect(clampDate('2010-01-01', '2012-08-06', '2024-02-19')).toBe('2012-08-06');
    expect(clampDate('2030-01-01', '2012-08-06', '2024-02-19')).toBe('2024-02-19');
  });
});

describe('mars photos', () => {
  it('parses photos, upgrades http, drops bad rows', () => {
    const photos = parsePhotos({
      photos: [
        { id: 1, sol: 5, earth_date: '2012-08-11', camera: { name: 'MAST', full_name: 'Mast Camera' }, img_src: 'http://mars.nasa.gov/a.jpg' },
        { id: 2, sol: 5, earth_date: '2012-08-11', camera: { name: 'FHAZ' }, img_src: 'javascript:alert(1)' },
        { sol: 5 },
      ],
    });
    expect(photos).toHaveLength(1);
    expect(photos[0].src).toBe('https://mars.nasa.gov/a.jpg');
    expect(photos[0].cameraName).toBe('Mast Camera');
    expect(parsePhotos(undefined)).toEqual([]);
  });

  it('builds the photos url', () => {
    const u = new URL(buildPhotosUrl('perseverance', '2024-01-02', 'K'));
    expect(u.pathname).toBe('/mars-photos/api/v1/rovers/perseverance/photos');
    expect(u.searchParams.get('earth_date')).toBe('2024-01-02');
  });
});
