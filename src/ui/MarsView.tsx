import { useEffect, useMemo, useState } from 'react';
import { localIso } from '../discover/nasa';
import { ROVERS, type RoverName } from '../discover/mars';
import { useMars } from '../discover/useMars';
import { PhotoViewer, type ViewerItem } from './PhotoViewer';
import { useDebounced } from './useDebounced';

const PAGE = 12;

/** Mars photos for the date the dial is pointing at (nearest day with photos). */
export function MarsView({ shown, onBack, onJump }: { shown: Date; onBack: () => void; onJump: (isoDate: string) => void }) {
  const requested = useDebounced(localIso(shown), 350);
  const [rover, setRover] = useState<RoverName>('curiosity');
  const [camera, setCamera] = useState('ALL');
  const [pick, setPick] = useState(0);
  const [visible, setVisible] = useState(PAGE);
  const [viewing, setViewing] = useState(false);
  const { manifest, date, photos, busy, error } = useMars(rover, requested);

  useEffect(() => {
    setCamera('ALL');
    setPick(0);
    setVisible(PAGE);
    setViewing(false);
  }, [rover, date]);

  const cameras = [...new Set(photos.map((p) => p.camera))];
  const list = camera === 'ALL' ? photos : photos.filter((p) => p.camera === camera);
  const hero = list[pick] ?? list[0];
  const items = useMemo<ViewerItem[]>(
    () =>
      list.map((p) => ({
        src: p.src,
        title: p.cameraName,
        kicker: `${manifest?.name ?? 'Rover'} · sol ${p.sol}`,
        caption: `Taken ${p.date} on Mars sol ${p.sol}.`,
        credit: 'NASA/JPL-Caltech',
        date: p.date,
        link: p.src,
      })),
    [photos, camera, manifest],
  );
  const moved = date !== null && date !== requested;

  return (
    <div className="mars">
      <button className="back-btn" onClick={onBack} aria-label="Back to Discover">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </button>

      <div className={`apod-frame mars-hero${busy ? ' is-busy' : ''}`}>
        {hero ? <img key={hero.id} src={hero.src} alt={`${hero.cameraName}, sol ${hero.sol}`} decoding="async" /> : <div className="apod-empty" aria-hidden="true" />}
        <div className="apod-shade" />
        {hero && <button className="hero-open" onClick={() => setViewing(true)} aria-label="View photo full screen" />}
        <div className="apod-caption">
          <span className="apod-kicker">
            {manifest?.name ?? 'Rover'} · sol {hero?.sol ?? '…'}
          </span>
          <h3>{hero?.cameraName ?? (error ? 'Not available' : 'Loading…')}</h3>
        </div>
      </div>

      <div className="mars-meta">
        <h2>Mars</h2>
        <p>
          {date ?? requested} · {photos.length} photos
          {moved && ' · nearest day with photos'}
        </p>
      </div>
      {error && !busy && (
        <p className="discover-error" role="status">
          {error}
        </p>
      )}

      <div className="chips" role="group" aria-label="Rover">
        {ROVERS.map((r) => (
          <button key={r.id} className={`chip${rover === r.id ? ' on' : ''}`} onClick={() => setRover(r.id)} aria-pressed={rover === r.id}>
            {r.label}
          </button>
        ))}
      </div>
      {cameras.length > 1 && (
        <div className="chips" role="group" aria-label="Camera">
          {['ALL', ...cameras].map((c) => (
            <button
              key={c}
              className={`chip${camera === c ? ' on' : ''}`}
              onClick={() => {
                setCamera(c);
                setPick(0);
                setVisible(PAGE);
              }}
              aria-pressed={camera === c}
            >
              {c === 'ALL' ? 'All' : c}
            </button>
          ))}
        </div>
      )}

      <div className="thumbs">
        {list.slice(0, visible).map((p, i) => (
          <button key={p.id} className={i === pick ? 'on' : ''} onClick={() => setPick(i)} aria-label={`${p.cameraName}, photo ${i + 1}`}>
            <img src={p.src} alt="" loading="lazy" decoding="async" />
          </button>
        ))}
      </div>
      {visible < list.length && (
        <button className="more-btn" onClick={() => setVisible((v) => v + PAGE)}>
          Show more
        </button>
      )}
      <p className="apod-credit">NASA/JPL-Caltech · Mars Rover Photos</p>
      {viewing && <PhotoViewer items={items} index={Math.min(pick, items.length - 1)} onIndex={setPick} onClose={() => setViewing(false)} onJump={onJump} />}
    </div>
  );
}
