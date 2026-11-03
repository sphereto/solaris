import { useEffect, useRef, useState } from 'react';
import { longDate } from '../discover/feed';
import { offsetForIsoDate } from '../discover/jump';
import { timeStore } from '../state/time';
import { useSettings } from '../state/useSettings';
import { DateScrubber } from './DateScrubber';
import { DiscoverFeed } from './DiscoverFeed';
import { EarthView } from './EarthView';
import { ExoplanetView } from './ExoplanetView';
import { LibraryView } from './LibraryView';
import { NeoView } from './NeoView';
import { SunView } from './SunView';

type View = 'home' | 'earth' | 'sun' | 'neo' | 'library' | 'exo';

/** Open straight into the image library with a search, e.g. from a planet's screen. */
export interface DiscoverStart {
  view: 'library';
  query: string;
}

const Icon = ({ d }: { d: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

/** Discover, full screen: a feed on top, a full screen for each source, and the date as a sheet. */
export function Discover({ shown, onClose, start }: { shown: Date; onClose: () => void; start?: DiscoverStart | null }) {
  const { dateFormat } = useSettings();
  const [view, setView] = useState<View>(start?.view ?? 'home');
  const [scrub, setScrub] = useState(false);
  const scroll = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);

  const jump = (iso: string) => {
    timeStore.setTarget(offsetForIsoDate(iso));
    onClose();
  };
  const back = () => (view === 'home' ? onClose() : setView('home'));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (scrub) setScrub(false);
      else back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => scroll.current?.scrollTo({ top: 0 }), [view]);

  // Keep Tab inside Discover (the photo viewer, when open, manages its own focus).
  useEffect(() => {
    const onTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !root.current) return;
      if ((e.target as HTMLElement | null)?.closest?.('.viewer')) return;
      const els = [...root.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input, [role="slider"]')].filter((el) => el.getClientRects().length > 0);
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      const active = document.activeElement;
      if (!root.current.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onTab, true);
    return () => window.removeEventListener('keydown', onTab, true);
  }, []);

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    root.current?.querySelector<HTMLElement>('.dv-btn')?.focus();
    return () => before?.focus?.();
  }, []);

  return (
    <div className="dv" role="dialog" aria-modal="true" aria-label="Discover" ref={root}>
      <div className="dv-scroll" ref={scroll}>
        <div className="dv-col">
          {view === 'home' && <DiscoverFeed shown={shown} onOpen={setView} onJump={jump} />}
          {view === 'earth' && <EarthView shown={shown} onJump={jump} />}
          {view === 'neo' && <NeoView shown={shown} onJump={jump} />}
          {view === 'sun' && (
            <div className="dv-pad">
              <SunView onJump={jump} />
            </div>
          )}
          {view === 'library' && (
            <div className="dv-pad">
              <LibraryView shown={shown} onJump={jump} initialQuery={start?.query} />
            </div>
          )}
          {view === 'exo' && (
            <div className="dv-pad">
              <ExoplanetView shown={shown} />
            </div>
          )}
        </div>
      </div>

      <div className="dv-bar">
        <button className="dv-btn" onClick={back} aria-label={view === 'home' ? 'Close Discover' : 'Back to Discover'}>
          <Icon d={view === 'home' ? 'M6 6l12 12M18 6L6 18' : 'M15 6l-6 6 6 6'} />
        </button>
        <span className="dv-fill" />
        <button className="dv-pill" onClick={() => setScrub(true)} aria-haspopup="dialog">
          {longDate(shown, dateFormat)}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {view !== 'library' && (
          <button className="dv-btn" onClick={() => setView('library')} aria-label="Search NASA's pictures">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="6" />
              <path d="M16 16l4 4" />
            </svg>
          </button>
        )}
      </div>

      {scrub && <DateScrubber shown={shown} onClose={() => setScrub(false)} />}
    </div>
  );
}
