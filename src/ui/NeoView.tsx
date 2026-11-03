import { useEffect, useMemo, useState } from 'react';
import { localIso } from '../discover/nasa';
import { type NeoObject, type SortKey, closestOf, formatLunar, neoWindow, sizeComparison, sortNeo } from '../discover/neo';
import { distanceKm, sizeMetres } from '../discover/units';
import { useNeo } from '../discover/useNeo';
import { useSettings } from '../state/useSettings';
import { ErrorNote } from './ErrorNote';
import { Ruler } from './Ruler';
import { useDebounced } from './useDebounced';

const PAGE = 10;
const SORTS: { id: SortKey; label: string }[] = [
  { id: 'date', label: 'By date' },
  { id: 'distance', label: 'Closest' },
  { id: 'size', label: 'Largest' },
];

const passTime = (o: NeoObject) => `${o.date}${o.time ? `, ${o.time} UTC` : ''}`;

/** Asteroids passing Earth in the seven days starting at the dial date. */
export function NeoView({ shown, onJump }: { shown: Date; onJump: (isoDate: string) => void }) {
  const { units } = useSettings();
  const requested = useDebounced(localIso(shown), 350);
  const { objects, start, busy, error, retry } = useNeo(requested);
  const [sort, setSort] = useState<SortKey>('date');
  const [visible, setVisible] = useState(PAGE);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    setVisible(PAGE);
    setOpen(null);
  }, [start, sort]);

  const list = useMemo(() => sortNeo(objects ?? [], sort), [objects, sort]);
  const closest = useMemo(() => closestOf(objects ?? []), [objects]);
  const win = start ? neoWindow(start) : null;

  return (
    <div className="dv-neo">
      <div className="dv-text dv-neo-top">
        {busy && !objects && (
          <div aria-hidden="true">
            <div className="skeleton sk-block" style={{ height: 150 }} />
            <div className="skeleton sk-block" style={{ height: 40, marginTop: 16 }} />
          </div>
        )}
        {error && !busy && <ErrorNote message={error} onRetry={retry} />}

        {closest && (
          <div className={busy ? 'is-busy' : ''}>
            <p className="dv-sub">Closest in the next 7 days</p>
            <div className="dv-big">{formatLunar(closest.lunar)}×</div>
            <p className="dv-bigsub">the Moon's distance</p>
            <Ruler lunar={closest.lunar} />
            <h1>{closest.name}</h1>
            <p className="dv-sub">
              {sizeMetres(closest.diameterM, units)} wide, about like {sizeComparison(closest.diameterM)}. {closest.kmPerSec.toFixed(1)} km/s. Passes {passTime(closest)}.
            </p>
            {closest.hazardous && <span className="pill">Flagged potentially hazardous</span>}
            <div>
              <button className="dv-primary" onClick={() => onJump(closest.date)}>
                Jump to this date
              </button>
            </div>
          </div>
        )}
        {objects && objects.length === 0 && !busy && !error && <p className="dv-sub">NASA lists no close approaches in this window.</p>}
      </div>

      {list.length > 0 && (
        <div className="dv-text dv-neo-list">
          <div className="s-seg" role="radiogroup" aria-label="Sort asteroids">
            {SORTS.map((s) => (
              <button key={s.id} role="radio" aria-checked={sort === s.id} className={sort === s.id ? 'on' : ''} onClick={() => setSort(s.id)}>
                {s.label}
              </button>
            ))}
          </div>

          <ul className={busy ? 'is-busy' : ''}>
            {list.slice(0, visible).map((o) => {
              const id = `${o.id}-${o.date}`;
              const isOpen = open === id;
              return (
                <li key={id}>
                  <button className="dv-row" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : id)}>
                    <span>
                      <strong>{o.name}</strong>
                      <small>{passTime(o)}</small>
                    </span>
                    <span>{formatLunar(o.lunar)}× Moon</span>
                  </button>
                  {isOpen && (
                    <div className="dv-row-more">
                      <Ruler lunar={o.lunar} />
                      <p>
                        {distanceKm(o.km, units)} away. {sizeMetres(o.diameterM, units)} wide, about like {sizeComparison(o.diameterM)}. {o.kmPerSec.toFixed(1)} km/s.
                      </p>
                      {o.hazardous && <span className="pill">Flagged potentially hazardous</span>}
                      <div className="dv-row-actions">
                        <button onClick={() => onJump(o.date)}>Jump to this date</button>
                        {o.url && (
                          <a href={o.url} target="_blank" rel="noopener noreferrer">
                            JPL details ↗
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {visible < list.length && (
            <button className="more-btn" onClick={() => setVisible((v) => v + PAGE)}>
              Show more
            </button>
          )}
          <p className="dv-credit">
            {win ? `Passing Earth ${win.start} to ${win.end}. ` : ''}"Potentially hazardous" is NASA's label for large objects whose orbits pass close to Earth's. It does not mean an impact is expected. Data: NASA NeoWs.
          </p>
        </div>
      )}
    </div>
  );
}
