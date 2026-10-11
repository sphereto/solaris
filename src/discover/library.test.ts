import { describe, expect, it } from 'vitest';
import { buildLibraryUrl, mediumUrl, parseLibrary, plainText } from './library';

const item = (over: object = {}, dataOver: object = {}) => ({
  href: 'https://images-assets.nasa.gov/image/x/collection.json',
  data: [
    {
      nasa_id: 'GSFC_1',
      title: 'A &amp; B',
      description: '<p>The <b>Moon</b> &quot;rises&quot;.</p>',
      date_created: '2017-12-08T00:00:00Z',
      media_type: 'image',
      center: 'GSFC',
      ...dataOver,
    },
  ],
  links: [{ rel: 'preview', href: 'http://images-assets.nasa.gov/image/x/x~thumb.jpg' }],
  ...over,
});

describe('image library', () => {
  it('cleans html text', () => {
    expect(plainText('<a href="x">Hello &amp; welcome</a>   there')).toBe('Hello & welcome there');
    expect(plainText(undefined)).toBe('');
  });

  it('parses items, upgrades links and picks a medium size', () => {
    const r = parseLibrary({ collection: { items: [item()], metadata: { total_hits: 5938 } } });
    expect(r.total).toBe(5938);
    expect(r.items[0]).toMatchObject({
      id: 'GSFC_1',
      title: 'A & B',
      description: 'The Moon "rises".',
      date: '2017-12-08',
      credit: 'GSFC',
      page: 'https://images.nasa.gov/details/GSFC_1',
    });
    expect(r.items[0].thumb).toBe('https://images-assets.nasa.gov/image/x/x~thumb.jpg');
    expect(r.items[0].medium).toBe('https://images-assets.nasa.gov/image/x/x~medium.jpg');
  });

  it('prefers a photographer credit and drops unusable rows', () => {
    const r = parseLibrary({
      collection: {
        items: [
          item({}, { photographer: 'Jane Doe' }),
          item({}, { media_type: 'video' }),
          item({ links: [] }),
          item({}, { date_created: 'unknown' }),
          { data: [] },
        ],
      },
    });
    expect(r.items).toHaveLength(1);
    expect(r.items[0].credit).toBe('Jane Doe');
    expect(parseLibrary(null)).toEqual({ items: [], total: 0 });
  });

  it('builds the search url, with an optional year', () => {
    const u = new URL(buildLibraryUrl('mars rover', 2012));
    expect(u.searchParams.get('q')).toBe('mars rover');
    expect(u.searchParams.get('media_type')).toBe('image');
    expect(u.searchParams.get('year_start')).toBe('2012');
    expect(new URL(buildLibraryUrl('moon', null)).searchParams.has('year_start')).toBe(false);
    expect(mediumUrl('https://a/b.jpg')).toBe('https://a/b.jpg');
  });
});
