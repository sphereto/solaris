import { useEffect, useMemo, useState } from 'react';
import { formatLatLon } from '../discover/epic';
import { millionKm } from '../discover/units';
import { useSettings } from '../state/useSettings';
import { localIso } from '../discover/nasa';
import { useEarth } from '../discover/useEarth';
import { ErrorNote } from './ErrorNote';
import { PhotoViewer, type ViewerItem } from './PhotoViewer';
import { useDebounced } from './useDebounced';

/** Full-disc Earth pictures from DSCOVR for the date the dial is pointing at. */
export function EarthView({ shown, onBack, onJump }: { shown: Date; onBack: () => void; onJump: (isoDate: string) => void }) {
  const { units, saveData } = useSettings();
  const requested = useDebounced(localIso(shown), 350);
  const [pick, setPick] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [viewing, setViewing] = useState(false);
  const { date, images, busy, error, retry } = useEarth(requested);

  useEffect(() => {
    setPick(0);
    setPlaying(false);
    setViewing(false);
  }, [date]);

  // Play the day: Earth turning, one picture at a time.
  useEffect(() => {
    if (!playing || images.length < 2) return;
    for (const i of images) new Image().src = i.jpg;
    const id = setInterval(() => setPick((p) => (p + 1) % images.length), 450);
    return () => clearInterval(id);
  }, [playing, images]);

  const hero = images[pick];
  const moved = date !== null && date !== requested;

  const items = useMemo<ViewerItem[]>(
    () =>
      images.map((i) => ({
        src: i.jpg,
        title: `${i.time} UTC`,
        kicker: 'Earth · DSCOVR EPIC',
        caption: i.lat !== null && i.lon !== null ? `Centred on ${formatLatLon(i.lat, i.lon)}.` : undefined,
        credit: 'NASA / NOAA / DSCOVR EPIC',
        date: i.date,
        link: i.png,
      })),
    [images],
  );

  return (
    <div className="mars">
      <button className="back-btn" onClick={onBack} aria-label="Back to Discover">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </button>

      <div className={`apod-frame earth-hero${busy ? ' is-busy' : ''}`}>
        {hero ? <img key={hero.name} src={hero.jpg} alt={`Earth at ${hero.time} UTC`} decoding="async" /> : <div className={`apod-empty${busy ? ' skeleton' : ''}`} aria-hidden="true" />}
        <div className="apod-shade" />
        {hero && (
          <button
            className="hero-open"
            onClick={() => {
              setPlaying(false);
              setViewing(true);
            }}
            aria-label="View picture full screen"
          />
        )}
        <div className="apod-caption">
          <span className="apod-kicker">DSCOVR · {hero?.date ?? date ?? requested}</span>
          <h3>{hero ? `${hero.time} UTC` : error ? 'Not available' : 'Loading…'}</h3>
        </div>
      </div>

      <div className="mars-meta">
        <h2>Earth today</h2>
        <p>
          {date ?? requested} · {images.length} pictures
          {moved && ' · nearest day with pictures'}
        </p>
      </div>
      {error && !busy && <ErrorNote message={error} onRetry={retry} />}

      {hero && (hero.lat !== null || hero.distanceKm !== null) && (
        <p className="facts">
          {hero.lat !== null && hero.lon !== null && <span>Centred on {formatLatLon(hero.lat, hero.lon)}</span>}
          {hero.distanceKm !== null && <span>Camera {millionKm(hero.distanceKm, units)} from Earth</span>}
        </p>
      )}

      {images.length > 1 && !saveData && (
        <div className="chips">
          <button className={`chip${playing ? ' on' : ''}`} onClick={() => setPlaying((p) => !p)} aria-pressed={playing}>
            {playing ? 'Pause' : 'Play the day'}
          </button>
        </div>
      )}

      {busy && images.length === 0 && (
        <div className="thumbs four" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="skeleton sk-thumb" />
          ))}
        </div>
      )}
      <div className="thumbs four">
        {images.map((i, n) => (
          <button
            key={i.name}
            className={n === pick ? 'on' : ''}
            onClick={() => {
              setPlaying(false);
              setPick(n);
            }}
            aria-label={`Earth at ${i.time} UTC`}
          >
            <img src={i.thumb} alt="" loading="lazy" decoding="async" />
          </button>
        ))}
      </div>
      <p className="apod-credit">NASA / NOAA / DSCOVR EPIC</p>
      {viewing && items.length > 0 && <PhotoViewer items={items} index={Math.min(pick, items.length - 1)} onIndex={setPick} onClose={() => setViewing(false)} onJump={onJump} />}
    </div>
  );
}
