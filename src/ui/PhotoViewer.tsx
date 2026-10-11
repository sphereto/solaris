import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface ViewerItem {
  src: string;
  fallback?: string; // tried once if src fails to load
  title: string;
  kicker: string;
  caption?: string;
  credit: string;
  date: string; // YYYY-MM-DD
  link: string; // original image
}

/** Keyed by src so the loading state resets for every photo. */
function ViewerImage({ item }: { item: ViewerItem }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [src, setSrc] = useState(item.src);
  if (failed) return <p className="viewer-fail">This image could not be loaded.</p>;
  return (
    <>
      <img
        className={loaded ? 'is-loaded' : ''}
        src={src}
        alt={item.title}
        draggable={false}
        onLoad={() => setLoaded(true)}
        onError={() => (item.fallback && src !== item.fallback ? setSrc(item.fallback) : setFailed(true))}
      />
      {!loaded && <div className="viewer-spin" aria-hidden="true" />}
    </>
  );
}

interface Props {
  items: ViewerItem[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  onJump: (isoDate: string) => void;
}

/** Full-screen photo viewer: swipe or arrow keys to browse, tap to hide the text. */
export function PhotoViewer({ items, index, onIndex, onClose, onJump }: Props) {
  const item = items[index];
  const [chrome, setChrome] = useState(true);
  const [copied, setCopied] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  const go = useCallback(
    (d: number) => {
      const n = index + d;
      if (n >= 0 && n < items.length) onIndex(n);
    },
    [index, items.length, onIndex],
  );

  // Keys are handled in the capture phase so the arrows never move the date behind the viewer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.stopPropagation();
        e.preventDefault();
        go(e.key === 'ArrowLeft' ? -1 : 1);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Home') {
        e.stopPropagation();
      } else if (e.key === 'Tab') {
        const els = root.current?.querySelectorAll<HTMLElement>('button, a[href]');
        if (!els || els.length === 0) return;
        const first = els[0];
        const last = els[els.length - 1];
        const active = document.activeElement;
        if (!root.current?.contains(active)) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [go, onClose]);

  // Move focus in, and give it back when the viewer closes.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    root.current?.querySelector<HTMLElement>('.viewer-close')?.focus();
    return () => before?.focus?.();
  }, []);

  // Warm the neighbours so swiping feels instant.
  useEffect(() => {
    for (const n of [index - 1, index + 1]) {
      if (items[n]) new Image().src = items[n].src;
    }
  }, [index, items]);

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: item.title, url: item.link });
      } else {
        await navigator.clipboard.writeText(item.link);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }
    } catch {
      /* cancelled or blocked */
    }
  };

  const onUp = (e: React.PointerEvent) => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
    else if (Math.abs(dx) < 8 && Math.abs(dy) < 8) setChrome((c) => !c);
  };

  if (!item) return null;

  return createPortal(
    <div className="viewer" role="dialog" aria-modal="true" aria-label={item.title} ref={root}>
      <div
        className="viewer-stage"
        onPointerDown={(e) => (start.current = { x: e.clientX, y: e.clientY })}
        onPointerUp={onUp}
        onPointerCancel={() => (start.current = null)}
      >
        <ViewerImage key={item.src} item={item} />
      </div>

      <div className={`viewer-chrome${chrome ? '' : ' is-hidden'}`}>
        <button className="viewer-close" onClick={onClose} aria-label="Close viewer">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        {items.length > 1 && (
          <>
            <span className="viewer-count">
              {index + 1} / {items.length}
            </span>
            <button className="viewer-nav prev" onClick={() => go(-1)} disabled={index === 0} aria-label="Previous photo">
              ‹
            </button>
            <button className="viewer-nav next" onClick={() => go(1)} disabled={index === items.length - 1} aria-label="Next photo">
              ›
            </button>
          </>
        )}

        <div className="viewer-caption">
          <span className="apod-kicker">{item.kicker}</span>
          <h3>{item.title}</h3>
          {item.caption && <p>{item.caption}</p>}
          <div className="viewer-actions">
            <button onClick={share}>{copied ? 'Link copied' : 'Share'}</button>
            <a href={item.link} target="_blank" rel="noopener noreferrer">
              Original ↗
            </a>
            <button className="jump" onClick={() => onJump(item.date)}>
              Jump to this date
            </button>
          </div>
          <small>Credit: {item.credit}</small>
        </div>
      </div>
    </div>,
    document.body,
  );
}
