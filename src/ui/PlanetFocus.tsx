import { useEffect, useMemo, useState } from 'react';
import { PLANETS, formatDate, planetStates } from '../ephemeris/planets';
import { PLANET_VISUALS } from '../scene/planetData';
import { PLANET_FACTS, formatRotation, formatYear } from '../scene/planetFacts';
import { PLANET_COUNT } from '../scene/layout';
import { focusStore } from '../state/focus';

interface Props {
  index: number | null;
  shown: Date;
  daysFromToday: number;
  onPictures: (planetName: string) => void;
  /** True while a sheet or dialog is on top, so keys and Esc belong to it. */
  suspended: boolean;
}

const Chevron = ({ dir }: { dir: 'left' | 'right' }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d={dir === 'left' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} />
  </svg>
);

/** The text beside the zoomed-in planet. The 3D scene does the zooming; this is the typography. */
export function PlanetFocus({ index, shown, daysFromToday, onPictures, suspended }: Props) {
  // Keep the last planet on screen while the view fades out.
  const [last, setLast] = useState<number | null>(index);
  useEffect(() => {
    if (index !== null) setLast(index);
  }, [index]);

  useEffect(() => {
    if (index === null || suspended) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') focusStore.clear();
      else if (e.key === 'ArrowLeft') focusStore.step(-1);
      else if (e.key === 'ArrowRight') focusStore.step(1);
      else return;
      e.stopPropagation();
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [index, suspended]);

  const time = shown.getTime();
  const distanceAu = useMemo(() => (last === null ? null : planetStates(new Date(time))[last].distanceAu), [last, time]);

  if (last === null) return null;
  const planet = PLANETS[last];
  const facts = PLANET_FACTS[planet.id];
  const prev = PLANETS[last - 1];
  const next = PLANETS[last + 1];

  return (
    <div className={`focus${index === null ? ' is-leaving' : ''}`} role="region" aria-label={`${planet.name}, planet ${last + 1} of ${PLANET_COUNT}`}>
      <div className="focus-top">
        <button className="focus-pill" onClick={() => focusStore.clear()}>
          <Chevron dir="left" />
          Solar system
        </button>
        <span className="focus-pill focus-date">{formatDate(shown)}</span>
      </div>

      <div className="focus-text" key={planet.id}>
        <div className="focus-kicker">
          Planet {last + 1} of {PLANET_COUNT}
        </div>
        <h1>{planet.name}</h1>
        <p className="focus-blurb">{facts.blurb}</p>
        <div className="focus-facts">
          <div className="focus-fact">
            <strong>{distanceAu !== null ? `${distanceAu.toFixed(2)} AU` : ''}</strong>
            <span>{daysFromToday === 0 ? 'from the Sun today' : `from the Sun on ${formatDate(shown)}`}</span>
          </div>
          <div className="focus-fact">
            <strong>{formatRotation(PLANET_VISUALS[planet.id].spinHours)}</strong>
            <span>one day</span>
          </div>
          <div className="focus-fact">
            <strong>{formatYear(facts.orbitDays)}</strong>
            <span>one trip around the Sun</span>
          </div>
        </div>
      </div>

      <button className="focus-cta" onClick={() => onPictures(planet.name)}>
        Pictures of {planet.name}
      </button>

      <div className="focus-nav">
        <button className="focus-pill" onClick={() => focusStore.step(-1)} disabled={!prev} aria-label={prev ? `Previous planet, ${prev.name}` : 'No previous planet'}>
          <Chevron dir="left" />
          {prev?.name ?? ''}
        </button>
        <button className="focus-pill" onClick={() => focusStore.step(1)} disabled={!next} aria-label={next ? `Next planet, ${next.name}` : 'No next planet'}>
          {next?.name ?? ''}
          <Chevron dir="right" />
        </button>
      </div>
    </div>
  );
}
