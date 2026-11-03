import { useEffect } from 'react';
import { CREDITS } from '../credits';

export function Credits({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="credits-backdrop" onClick={onClose}>
      <div
        className="credits-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Credits"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Credits</h2>
        <p className="credits-intro">Solaris is open source (MIT). Made with:</p>
        <ul>
          {CREDITS.map((c) => (
            <li key={c.title}>
              <strong>{c.title}</strong>
              <br />
              <a href={c.url} target="_blank" rel="noopener noreferrer">
                {c.text}
              </a>
              <br />
              <a href={c.licenseUrl} target="_blank" rel="noopener noreferrer">
                {c.license}
              </a>
            </li>
          ))}
        </ul>
        <p className="credits-note">Planet sizes and ring spacing are not to scale. Positions are real.</p>
        <button className="credits-close" onClick={onClose} autoFocus>
          close
        </button>
      </div>
    </div>
  );
}
