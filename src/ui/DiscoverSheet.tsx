import { useEffect, useRef, useState } from 'react';
import { formatDate } from '../ephemeris/planets';
import { offsetForIsoDate } from '../discover/jump';
import { apodDateFor, localIso } from '../discover/nasa';
import { useApod } from '../discover/useApod';
import { timeStore, useTargetOffset } from '../state/time';
import { EarthView } from './EarthView';
import { ExoplanetView } from './ExoplanetView';
import { LibraryView } from './LibraryView';
import { ErrorNote } from './ErrorNote';
import { MarsView } from './MarsView';
import { NeoView } from './NeoView';
import { SunView } from './SunView';
import { PhotoViewer } from './PhotoViewer';
import { useDebounced } from './useDebounced';

type View = 'home' | 'mars' | 'earth' | 'sun' | 'neo' | 'library' | 'exo';

/** Discover sheet. It follows the date the dial is pointing at. */
export function DiscoverSheet({ shown, onClose }: { shown: Date; onClose: () => void }) {
  const [view, setView] = useState<View>('home');
  const offset = useTargetOffset();
  const ref = useRef<HTMLElement>(null);

  // Wait for the dial to settle so scrubbing does not spend the API rate limit.
  const date = useDebounced(apodDateFor(shown), 350);
  const { apod, busy, error, retry } = useApod(date);
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState(false);
  const clamped = localIso(shown) !== date;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (view === 'home') onClose();
      else setView('home');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, view]);

  useEffect(() => {
    setOpen(false);
    setViewing(false);
  }, [date]);

  const jump = (iso: string) => {
    timeStore.setTarget(offsetForIsoDate(iso));
    onClose();
  };
  useEffect(() => ref.current?.scrollTo({ top: 0 }), [view]);

  const picture = apod?.mediaType === 'video' ? apod.thumbUrl : apod?.url;

  return (
    <section className="discover-sheet" aria-label="Discover" ref={ref}>
      {view === 'mars' ? (
        <MarsView shown={shown} onBack={() => setView('home')} onJump={jump} />
      ) : view === 'exo' ? (
        <ExoplanetView shown={shown} onBack={() => setView('home')} />
      ) : view === 'library' ? (
        <LibraryView shown={shown} onBack={() => setView('home')} onJump={jump} />
      ) : view === 'neo' ? (
        <NeoView shown={shown} onBack={() => setView('home')} onJump={jump} />
      ) : view === 'sun' ? (
        <SunView onBack={() => setView('home')} onJump={jump} offsetDays={Math.round(offset)} />
      ) : view === 'earth' ? (
        <EarthView shown={shown} onBack={() => setView('home')} onJump={jump} />
      ) : (
        <>
          <header className="discover-head">
            <div>
              <h2>Discover</h2>
              <p>Live from NASA · follows the dial</p>
            </div>
            <span className="discover-chip">{formatDate(shown)}</span>
          </header>

          {clamped && (
            <p className="discover-note">
              NASA has no picture for this date, so this is the closest one ({date}).
            </p>
          )}

          <article className={`apod${busy ? ' is-busy' : ''}`}>
            <div className="apod-frame">
              {picture ? (
                <img src={picture} alt={apod?.title ?? ''} loading="lazy" decoding="async" />
              ) : (
                <div className={`apod-empty${busy ? ' skeleton' : ''}`} aria-hidden="true" />
              )}
              <div className="apod-shade" />
              {apod?.mediaType === 'image' && (
                <button className="hero-open" onClick={() => setViewing(true)} aria-label="View picture full screen" />
              )}
              <div className="apod-caption">
                <span className="apod-kicker">Picture of the day · {apod?.date ?? date}</span>
                <h3>{apod?.title ?? (error ? 'Not available' : 'Loading…')}</h3>
              </div>
            </div>

            {error && !busy && <ErrorNote message={error} onRetry={retry} />}

            {apod && (
              <>
                <p className={`apod-text${open ? ' is-open' : ''}`}>{apod.explanation}</p>
                <div className="apod-actions">
                  {apod.explanation.length > 220 && (
                    <button onClick={() => setOpen((o) => !o)}>{open ? 'Show less' : 'Read more'}</button>
                  )}
                  <a href={apod.hdUrl ?? apod.url} target="_blank" rel="noopener noreferrer">
                    {apod.mediaType === 'video' ? 'Watch video ↗' : 'Open full image ↗'}
                  </a>
                </div>
                <p className="apod-credit">{apod.credit ? `Image credit: ${apod.credit} · ` : ''}NASA APOD</p>
              </>
            )}
          </article>

          {viewing && apod && (
            <PhotoViewer
              items={[
                {
                  src: apod.url,
                  title: apod.title,
                  kicker: `Picture of the day · ${apod.date}`,
                  caption: apod.explanation,
                  credit: apod.credit ? `${apod.credit} / NASA APOD` : 'NASA APOD',
                  date: apod.date,
                  link: apod.hdUrl ?? apod.url,
                },
              ]}
              index={0}
              onIndex={() => {}}
              onClose={() => setViewing(false)}
              onJump={jump}
            />
          )}

          <h3 className="explore-title">Explore</h3>
          <div className="tiles">
            {/* Mars tile hidden: NASA's Mars Rover Photos service is gone. Re-add once the data layer moves to JPL's feed. */}
            <button className="tile tile-earth" onClick={() => setView('earth')}>
              <span className="tile-art" aria-hidden="true" />
              <strong>Earth today</strong>
              <small>Full disc · DSCOVR</small>
            </button>
            <button className="tile tile-sun" onClick={() => setView('sun')}>
              <span className="tile-art" aria-hidden="true" />
              <strong>The Sun now</strong>
              <small>Live · space weather</small>
            </button>
            <button className="tile tile-neo" onClick={() => setView('neo')}>
              <span className="tile-art" aria-hidden="true" />
              <strong>Asteroids</strong>
              <small>Close approaches</small>
            </button>
            <button className="tile tile-lib" onClick={() => setView('library')}>
              <span className="tile-art" aria-hidden="true" />
              <strong>Image library</strong>
              <small>Search NASA's archive</small>
            </button>
            <button className="tile tile-exo" onClick={() => setView('exo')}>
              <span className="tile-art" aria-hidden="true" />
              <strong>Exoplanets</strong>
              <small>Worlds beyond the Sun</small>
            </button>
          </div>
        </>
      )}
    </section>
  );
}
