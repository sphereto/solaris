import { useEffect, useState } from 'react';
import { dateForOffset, formatClock, formatDate, formatDayOffset } from '../ephemeris/planets';
import { timeStore, useTargetOffset } from '../state/time';
import { Credits } from './Credits';
import { TimeDial } from './TimeDial';

function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Wheel and keyboard controls for the date, on top of the drag dial. */
function useDateControls() {
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement | null)?.closest('.credits-panel')) return;
      e.preventDefault();
      const clamped = Math.max(-240, Math.min(240, e.deltaY));
      timeStore.nudge(clamped * 0.04); // scroll down moves forward in time
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) return;
      const step = e.altKey ? 365 : e.shiftKey ? 30 : 1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') timeStore.nudge(step);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') timeStore.nudge(-step);
      else if (e.key === 'Home') timeStore.reset();
      else return;
      e.preventDefault();
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
    };
  }, []);
}

export function Hud() {
  const offset = useTargetOffset();
  const now = useNow(15_000);
  const [showCredits, setShowCredits] = useState(false);
  useDateControls();

  // Whole days, so the date and the "+N days" counter always agree.
  const days = Math.round(offset);
  const shown = dateForOffset(now, days);

  return (
    <div className="hud">
      <div className="hud-top">
        <span className="readout" aria-label="Date shown">
          {formatDate(shown)}
        </span>
        <button className="credits-link" onClick={() => setShowCredits(true)}>
          credits
        </button>
        <span className="readout" aria-label="Current time">
          {formatClock(now)}
        </span>
      </div>

      <div className="hud-bottom">
        <button
          className="counter readout"
          onClick={() => timeStore.reset()}
          title="Tap to return to today"
          aria-label={`${formatDayOffset(days)} from today. Tap to return to today.`}
        >
          {formatDayOffset(days)}
        </button>
        <TimeDial />
      </div>

      {showCredits && <Credits onClose={() => setShowCredits(false)} />}
    </div>
  );
}
