import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { MAX_OFFSET_DAYS } from '../ephemeris/planets';
import { timeStore, useTargetOffset } from '../state/time';

/** Ruler spacing on screen: one tick per day. */
const TICK_PX = 14;
/** Base scrub speed, before the speed-dependent boost. */
const DAYS_PER_PX = 0.25;

/**
 * Drag left to go forward in time, right to go back; a quick flick keeps going and
 * slows down. Dragging faster covers more days per pixel, so decades are reachable
 * without endless swiping.
 */
export function TimeDial() {
  const offset = useTargetOffset();
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(240);
  const drag = useRef({ active: false, lastX: 0, lastT: 0, velocity: 0 });
  const raf = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    cancelAnimationFrame(raf.current);
    drag.current = { active: true, lastX: e.clientX, lastT: e.timeStamp, velocity: 0 };
  };

  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d.active) return;
    const dx = e.clientX - d.lastX;
    const dt = Math.max(1, e.timeStamp - d.lastT);
    const speed = Math.abs(dx) / dt; // px per ms
    const gain = 1 + Math.min(8, speed * 3);
    const days = -dx * DAYS_PER_PX * gain;
    timeStore.nudge(days);
    d.velocity = 0.8 * d.velocity + 0.2 * (days / dt); // days per ms
    d.lastX = e.clientX;
    d.lastT = e.timeStamp;
  };

  const onUp = () => {
    const d = drag.current;
    if (!d.active) return;
    d.active = false;
    let v = d.velocity;
    let last = performance.now();
    const glide = (now: number) => {
      const dt = now - last;
      last = now;
      timeStore.nudge(v * dt);
      v *= Math.exp(-dt / 320);
      if (Math.abs(v) > 0.00005) raf.current = requestAnimationFrame(glide);
    };
    if (Math.abs(v) > 0.00005) raf.current = requestAnimationFrame(glide);
  };

  const px = width / 2 - offset * TICK_PX;

  return (
    <div
      ref={ref}
      className="dial"
      role="slider"
      tabIndex={0}
      aria-label="Date. Drag sideways, scroll, or use the arrow keys to move through days."
      aria-valuemin={-MAX_OFFSET_DAYS}
      aria-valuemax={MAX_OFFSET_DAYS}
      aria-valuenow={Math.round(offset)}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <div className="dial-ticks" style={{ backgroundPosition: `${px}px 100%, ${px}px 100%` }} />
      <div className="dial-needle" />
    </div>
  );
}
