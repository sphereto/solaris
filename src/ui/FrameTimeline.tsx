import { useRef } from 'react';
import { minutesOfDay, nearestIndexByMinutes } from '../discover/feed';

interface Props {
  times: string[]; // "HH:MM", one per picture
  value: number;
  onChange: (index: number) => void;
}

/** A day's pictures laid out by time of day. Tap or drag to choose one; arrow keys step through. */
export function FrameTimeline({ times, value, onChange }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const minutes = times.map(minutesOfDay);
  const frac = (m: number) => `${(m / 1440) * 100}%`;

  const pick = (clientX: number) => {
    const r = track.current?.getBoundingClientRect();
    if (!r || r.width === 0) return;
    const x = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    onChange(nearestIndexByMinutes(minutes, x * 1440));
  };

  return (
    <div className="dv-tl-wrap">
      <div
        ref={track}
        className="dv-tl"
        role="slider"
        tabIndex={0}
        aria-label="Time of day"
        aria-valuemin={0}
        aria-valuemax={times.length - 1}
        aria-valuenow={value}
        aria-valuetext={`${times[value]} UTC`}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          pick(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.buttons) pick(e.clientX);
        }}
        onKeyDown={(e) => {
          const step = e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : 0;
          if (!step) return;
          e.preventDefault();
          e.stopPropagation();
          onChange(Math.min(times.length - 1, Math.max(0, value + step)));
        }}
      >
        {minutes.map((m, i) => (
          <i key={i} style={{ left: frac(m) }} />
        ))}
        <b style={{ left: frac(minutes[value] ?? 0) }} />
      </div>
      <div className="dv-tl-labels" aria-hidden="true">
        <span>00:00</span>
        <span>24:00</span>
      </div>
    </div>
  );
}
