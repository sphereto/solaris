import { useEffect, useRef } from 'react';
import { longDate, relativeDays } from '../discover/feed';
import { offsetForIsoDate } from '../discover/jump';
import { localIso } from '../discover/nasa';
import { useSettings } from '../state/useSettings';
import { timeStore, useTargetOffset } from '../state/time';

const TICK_PX = 20; // one day

/** Where "1 month ago" and "1 year ago" land, counted from today. */
function presetOffset(monthsBack: number): number {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsBack);
  return offsetForIsoDate(localIso(d));
}

/** The date dial, as a bottom sheet inside Discover. It moves the same date the 3D view uses. */
export function DateScrubber({ shown, onClose }: { shown: Date; onClose: () => void }) {
  const { dateFormat } = useSettings();
  const offset = useTargetOffset();
  const drag = useRef<{ x: number; start: number } | null>(null);
  const doneRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    doneRef.current?.focus();
    return () => before?.focus?.();
  }, []);

  const day = Math.round(offset);
  const shift = -((offset * TICK_PX) % TICK_PX);

  return (
    <>
      <div className="dv-dim" onClick={onClose} aria-hidden="true" />
      <div className="dv-scrub" role="dialog" aria-label="Choose a date">
        <div className="dv-grab" aria-hidden="true" />
        <div className="dv-kicker">Following this date</div>
        <h2>{longDate(shown, dateFormat)}</h2>
        <p className="dv-sub">{relativeDays(day)}</p>

        <div
          className="dv-sc-track"
          role="slider"
          tabIndex={0}
          aria-label="Date"
          aria-valuemin={-36500}
          aria-valuemax={36500}
          aria-valuenow={day}
          aria-valuetext={`${longDate(shown, dateFormat)}, ${relativeDays(day)}`}
          style={{ backgroundPositionX: `${shift}px` }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, start: timeStore.getTarget() };
          }}
          onPointerMove={(e) => {
            if (drag.current) timeStore.setTarget(drag.current.start - (e.clientX - drag.current.x) / TICK_PX);
          }}
          onPointerUp={() => {
            drag.current = null;
            timeStore.setTarget(Math.round(timeStore.getTarget()));
          }}
          onPointerCancel={() => (drag.current = null)}
          onKeyDown={(e) => {
            const step = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : e.key === 'PageDown' ? -30 : e.key === 'PageUp' ? 30 : 0;
            if (!step) return;
            e.preventDefault();
            e.stopPropagation();
            timeStore.setTarget(Math.round(timeStore.getTarget()) + step);
          }}
        >
          <span className="dv-sc-month">{longDate(shown, 'mdy').replace(/\s\d+,/, '')}</span>
          <span className="dv-needle" />
        </div>

        <div className="dv-quick">
          <button onClick={() => timeStore.setTarget(0)}>Today</button>
          <button onClick={() => timeStore.setTarget(presetOffset(1))}>1 month ago</button>
          <button onClick={() => timeStore.setTarget(presetOffset(12))}>1 year ago</button>
        </div>
        <button className="dv-primary dv-done" onClick={onClose} ref={doneRef}>
          Done
        </button>
      </div>
    </>
  );
}
