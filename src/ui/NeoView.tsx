import { useEffect, useMemo, useState } from 'react';
import { localIso } from '../discover/nasa';
import { type NeoObject, type SortKey, closestOf, formatKm, formatLunar, formatSize, ldPosition, neoWindow, sizeComparison, sortNeo } from '../discover/neo';
import { useNeo } from '../discover/useNeo';
import { useDebounced } from './useDebounced';

const PAGE = 10;
const SORTS: { id: SortKey; label: string }[] = [
  { id: 'date', label: 'By date' },
  { id: 'distance', label: 'Closest first' },
  { id: 'size', label: 'Largest first' },
];

/** Distance from Earth on a log scale, with the Moon marked. */
function Ruler({ lunar }: { lunar: number }) {
  const pct = (l: number) => `${ldPosition(l) * 100}%`;
  return (
    <div className="ruler" role="img" aria-label={`${formatLunar(lunar)} times the distance to the Moon`}>
      <span className="ruler-earth" />
      <span className="ruler-tick" style={{ left: pct(1) }}>
        <i>Moon</i>
      </span>
      <span className="ruler-tick" style={{ left: pct(10) }}>
        <i>10×</i>
      </span>
      <span className="ruler-dot" style={{ left: pct(lunar) }} />
    </div>
  );
}

function Facts({ o }: { o: NeoObject }) {
  return (
    <p className="neo-facts">
      <span>
        {formatLunar(o.lunar)}× the Moon's distance ({formatKm(o.km)})
      </span>
      <span>
        {formatSize(o.diameterM)} wide, about like {sizeComparison(o.diameterM)}
      </span>
      <span>{o.kmPerSec.toFixed(1)} km/s</span>
    </p>
  );
}

/** Asteroids passing Earth in the seven days starting at the dial date. */
export function NeoView({ shown, onBack, onJump }: { shown: Date; onBack: () => void; onJump: (isoDate: string) => void }) {
  const requested = useDebounced(localIso(shown), 350);
  const { objects, start, busy, error } = useNeo(requested);
  const [sort, setSort] = useState<SortKey>('date');
  const [visible, setVisible] = useState(PAGE);

  useEffect(() => setVisible(PAGE), [start, sort]);

  const list = useMemo(() => sortNeo(objects ?? [], sort), [objects, sort]);
  const closest = useMemo(() => closestOf(objects ?? []), [objects]);
  const win = start ? neoWindow(start) : null;

  return (
    <div className="mars">
      <button className="back-btn neo-back" onClick={onBack} aria-label="Back to Discover">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </button>

      <div className="mars-meta neo-title">
        <h2>Asteroids</h2>
        <p>{win ? `Passing Earth ${win.start} to ${win.end}` : 'Loading…'}</p>
      </div>
      {error && !busy && (
        <p className="discover-error" role="status">
          {error}
        </p>
      )}

      {closest && (
        <section className={`neo-hero${busy ? ' is-busy' : ''}`} aria-label="Closest approach">
          <span className="apod-kicker">Closest in these 7 days</span>
          <div className="neo-big">
            {formatLunar(closest.lunar)}
            <small>times the Moon's distance</small>
          </div>
          <Ruler lunar={closest.lunar} />
          <h3>{closest.name}</h3>
          <Facts o={closest} />
          <div className="neo-actions">
            <button className="jump" onClick={() => onJump(closest.date)}>
              Jump to {closest.date}
            </button>
            {closest.url && (
              <a href={closest.url} target="_blank" rel="noopener noreferrer">
                JPL details ↗
              </a>
            )}
          </div>
        </section>
      )}

      {objects && objects.length === 0 && !busy && !error && <p className="discover-note">NASA lists no close approaches in this window.</p>}

      {list.length > 0 && (
        <>
          <div className="chips" role="group" aria-label="Sort">
            {SORTS.map((s) => (
              <button key={s.id} className={`chip${sort === s.id ? ' on' : ''}`} onClick={() => setSort(s.id)} aria-pressed={sort === s.id}>
                {s.label}
              </button>
            ))}
          </div>

          <ul className={`neo-list${busy ? ' is-busy' : ''}`}>
            {list.slice(0, visible).map((o) => (
              <li key={`${o.id}-${o.date}`}>
                <div className="neo-row-head">
                  <strong>{o.name}</strong>
                  <span>
                    {o.date}
                    {o.time ? ` ${o.time} UTC` : ''}
                  </span>
                </div>
                <Ruler lunar={o.lunar} />
                <Facts o={o} />
                {o.hazardous && <span className="pill">Flagged potentially hazardous</span>}
                <div className="neo-actions">
                  <button onClick={() => onJump(o.date)}>Jump to this date</button>
                  {o.url && (
                    <a href={o.url} target="_blank" rel="noopener noreferrer">
                      JPL details ↗
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {visible < list.length && (
            <button className="more-btn" onClick={() => setVisible((v) => v + PAGE)}>
              Show more
            </button>
          )}
          <p className="apod-credit">
            "Potentially hazardous" is NASA's label for large objects whose orbits pass close to Earth's. It does not mean an impact is expected.
            Data: NASA NeoWs.
          </p>
        </>
      )}
    </div>
  );
}
