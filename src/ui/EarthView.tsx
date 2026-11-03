import { useEffect, useMemo, useState } from 'react';
import { formatLatLon } from '../discover/epic';
import { localIso } from '../discover/nasa';
import { millionKm } from '../discover/units';
import { useEarth } from '../discover/useEarth';
import { useSettings } from '../state/useSettings';
import { ErrorNote } from './ErrorNote';
import { FrameTimeline } from './FrameTimeline';
import { PhotoViewer, type ViewerItem } from './PhotoViewer';
import { useDebounced } from './useDebounced';

/** Earth as DSCOVR sees it: the whole disc, the time, and the day's pictures on a timeline. */
export function EarthView({ shown, onJump }: { shown: Date; onJump: (isoDate: string) => void }) {
  const { units, saveData } = useSettings();
  const requested = useDebounced(localIso(shown), 350);
  const [pick, setPick] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [viewing, setViewing] = useState(false);
  const { date, images, busy, error, retry } = useEarth(requested);

  // Start on the newest picture of the day.
  useEffect(() => {
    setPick(Math.max(0, images.length - 1));
    setPlaying(false);
    setViewing(false);
  }, [date, images.length]);

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
    <div className="dv-earth">
      <div className={`dv-earth-hero${busy ? ' is-busy' : ''}`}>
        {hero ? <img key={hero.name} src={hero.jpg} alt={`Earth at ${hero.time} UTC`} decoding="async" /> : <div className={`dv-hero-empty${busy ? ' skeleton' : ''}`} aria-hidden="true" />}
        {hero && (
          <button
            className="dv-open"
            onClick={() => {
              setPlaying(false);
              setViewing(true);
            }}
            aria-label="View picture full screen"
          />
        )}
        {images.length > 1 && !saveData && (
          <button className="dv-play" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Play the day'} aria-pressed={playing}>
            {playing ? (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
              </svg>
            ) : (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
        )}
      </div>

      <div className="dv-text">
        <div className="dv-kicker">Earth today</div>
        <h1>{hero ? `${hero.time} UTC` : error ? 'Not available' : 'Loading…'}</h1>
        {hero && hero.lat !== null && hero.lon !== null && <p className="dv-sub">Centred on {formatLatLon(hero.lat, hero.lon)}</p>}
        {moved && <p className="dv-note">No pictures on this date, so this is the nearest day ({date}).</p>}
        {error && !busy && <ErrorNote message={error} onRetry={retry} />}

        {hero && (
          <div className="dv-stats">
            {hero.distanceKm !== null && (
              <div>
                <strong>{millionKm(hero.distanceKm, units)}</strong>
                <span>camera to Earth</span>
              </div>
            )}
            <div>
              <strong>{images.length}</strong>
              <span>pictures that day</span>
            </div>
          </div>
        )}

        {images.length > 1 && <FrameTimeline times={images.map((i) => i.time)} value={Math.min(pick, images.length - 1)} onChange={(i) => (setPlaying(false), setPick(i))} />}
        <p className="dv-credit">NASA / NOAA / DSCOVR EPIC</p>
      </div>

      {viewing && items.length > 0 && <PhotoViewer items={items} index={Math.min(pick, items.length - 1)} onIndex={setPick} onClose={() => setViewing(false)} onJump={onJump} />}
    </div>
  );
}
