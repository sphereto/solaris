import { useEffect, useMemo, useState } from 'react';
import { useLibrary } from '../discover/useLibrary';
import { ErrorNote } from './ErrorNote';
import { PhotoViewer, type ViewerItem } from './PhotoViewer';
import { useDebounced } from './useDebounced';

const TOPICS = ['Galaxies', 'Nebulae', 'Moon', 'Mars', 'Aurora', 'Space Station', 'Earth'];
const PAGE = 12;

/** Search NASA's picture archive. Optionally limited to the year on the dial. */
export function LibraryView({ shown, onBack, onJump }: { shown: Date; onBack: () => void; onJump: (isoDate: string) => void }) {
  const dialYear = shown.getFullYear();
  const [query, setQuery] = useState('Galaxies');
  const [text, setText] = useState('');
  const [byYear, setByYear] = useState(false);
  const [visible, setVisible] = useState(PAGE);
  const [open, setOpen] = useState<number | null>(null);

  const settledYear = useDebounced(dialYear, 500);
  const year = byYear ? settledYear : null;
  const { items, total, busy, error, retry } = useLibrary(query, year);

  useEffect(() => {
    setVisible(PAGE);
    setOpen(null);
  }, [query, year]);

  const viewerItems = useMemo<ViewerItem[]>(
    () =>
      (items ?? []).map((i) => ({
        src: i.medium,
        fallback: i.thumb,
        title: i.title,
        kicker: `NASA Image Library · ${i.date}`,
        caption: i.description || undefined,
        credit: i.credit,
        date: i.date,
        link: i.page,
      })),
    [items],
  );

  return (
    <div className="mars">
      <button className="back-btn neo-back" onClick={onBack} aria-label="Back to Discover">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </button>

      <div className="mars-meta neo-title">
        <h2>Image library</h2>
        <p>
          {items ? `${total.toLocaleString('en-US')} pictures match` : 'Loading…'}
          {year !== null && ` in ${year}`}
        </p>
      </div>

      <form
        className="search"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) setQuery(text.trim());
        }}
      >
        <input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Search NASA's archive" aria-label="Search NASA's picture archive" />
        <button type="submit">Search</button>
      </form>

      <div className="chips" role="group" aria-label="Topics">
        {TOPICS.map((t) => (
          <button
            key={t}
            className={`chip${query === t ? ' on' : ''}`}
            onClick={() => {
              setQuery(t);
              setText('');
            }}
            aria-pressed={query === t}
          >
            {t}
          </button>
        ))}
        <button className={`chip${byYear ? ' on' : ''}`} onClick={() => setByYear((b) => !b)} aria-pressed={byYear}>
          Only {dialYear}
        </button>
      </div>

      {error && !busy && <ErrorNote message={error} onRetry={retry} />}
      {busy && !items && (
        <div className="lib-grid" aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className="lib-card skeleton" />
          ))}
        </div>
      )}
      {items && items.length === 0 && !busy && !error && <p className="discover-note">No pictures found. Try another word{byYear ? ' or turn off the year filter' : ''}.</p>}

      {items && items.length > 0 && (
        <>
          <div className={`lib-grid${busy ? ' is-busy' : ''}`}>
            {items.slice(0, visible).map((i, n) => (
              <button key={i.id} className="lib-card" onClick={() => setOpen(n)} aria-label={`${i.title}, ${i.date}`}>
                <img src={i.thumb} alt="" loading="lazy" decoding="async" />
                <span className="lib-cap">
                  <strong>{i.title}</strong>
                  <small>{i.date}</small>
                </span>
              </button>
            ))}
          </div>
          {visible < items.length && (
            <button className="more-btn" onClick={() => setVisible((v) => v + PAGE)}>
              Show more
            </button>
          )}
        </>
      )}
      <p className="apod-credit">NASA Image and Video Library</p>
      {open !== null && viewerItems.length > 0 && <PhotoViewer items={viewerItems} index={Math.min(open, viewerItems.length - 1)} onIndex={setOpen} onClose={() => setOpen(null)} onJump={onJump} />}
    </div>
  );
}
