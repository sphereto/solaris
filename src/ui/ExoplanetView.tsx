import { useEffect, useState } from 'react';
import {
  type Planet,
  type Snapshot,
  formatLightYears,
  formatPeriod,
  formatTemp,
  loadSnapshot,
  methodLabel,
  orbitRadiusPx,
  planetDotRadius,
  sizeCirclePx,
  starColor,
} from '../discover/exoplanets';
import { useDebounced } from './useDebounced';

type ListKey = 'newest' | 'nearest' | 'earth' | 'year';

/** The planet's orbit next to Earth's, on a log scale. Decorative: the real numbers are listed below. */
function OrbitDiagram({ p }: { p: Planet }) {
  const cx = 180;
  const cy = 120;
  const earth = orbitRadiusPx(1);
  const r = p.orbitAu !== null ? orbitRadiusPx(p.orbitAu) : null;
  const angle = (-40 * Math.PI) / 180;
  return (
    <svg className="orbit" viewBox="0 0 360 240" role="img" aria-label={`${p.name} orbiting ${p.host}, with Earth's orbit for comparison`}>
      <circle className="orbit-earth" cx={cx} cy={cy} r={earth} />
      <text className="orbit-label" x={cx} y={cy - earth - 5} textAnchor="middle">
        Earth's orbit
      </text>
      {r !== null && <circle className="orbit-planet" cx={cx} cy={cy} r={r} />}
      <circle cx={cx} cy={cy} r={12} style={{ fill: starColor(p.starTempK) }} />
      {r !== null && <circle cx={cx + r * Math.cos(angle)} cy={cy + r * Math.sin(angle)} r={planetDotRadius(p.radiusEarth)} style={{ fill: '#8fd3e0' }} />}
    </svg>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="exo-stat">
      <strong>{value}</strong>
      <small>{label}</small>
    </div>
  );
}

/** Planets beyond the Sun, from a data snapshot made at build time. */
export function ExoplanetView({ shown, onBack }: { shown: Date; onBack: () => void }) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [key, setKey] = useState<ListKey>('newest');
  const [pick, setPick] = useState(0);
  const dialYear = shown.getFullYear();
  const year = useDebounced(dialYear, 400);

  useEffect(() => {
    let live = true;
    loadSnapshot().then((s) => live && setSnap(s));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => setPick(0), [key, year]);

  const list: Planet[] = !snap ? [] : key === 'newest' ? snap.newest : key === 'nearest' ? snap.nearest : key === 'earth' ? snap.earthSized : (snap.byYear[year] ?? []);
  const p = list[pick];
  const missing = snap !== null && snap.generatedAt === null;
  const found = snap?.yearCounts[year] ?? 0;

  return (
    <div className="mars">
      <button className="back-btn neo-back" onClick={onBack} aria-label="Back to Discover">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </button>

      <div className="mars-meta neo-title">
        <h2>Exoplanets</h2>
        <p>
          {!snap && 'Loading…'}
          {snap && !missing && `${snap.total.toLocaleString('en-US')} confirmed worlds, as of ${snap.generatedAt?.slice(0, 10)}`}
        </p>
      </div>

      {missing && (
        <p className="discover-error" role="status">
          The exoplanet data file has not been generated yet. Run <code>pnpm data:exoplanets</code> and commit the result, or let the next deploy create it.
        </p>
      )}

      {!snap && (
        <div aria-hidden="true">
          <div className="skeleton sk-block" style={{ aspectRatio: '3 / 2', marginTop: 16 }} />
          <div className="skeleton sk-block" style={{ height: 56, marginTop: 14 }} />
        </div>
      )}

      {snap && !missing && (
        <>
          <div className="chips" role="group" aria-label="Which planets">
            <button className={`chip${key === 'newest' ? ' on' : ''}`} onClick={() => setKey('newest')} aria-pressed={key === 'newest'}>
              Newest
            </button>
            <button className={`chip${key === 'nearest' ? ' on' : ''}`} onClick={() => setKey('nearest')} aria-pressed={key === 'nearest'}>
              Nearest
            </button>
            <button className={`chip${key === 'earth' ? ' on' : ''}`} onClick={() => setKey('earth')} aria-pressed={key === 'earth'}>
              Earth-sized, mild
            </button>
            <button className={`chip${key === 'year' ? ' on' : ''}`} onClick={() => setKey('year')} aria-pressed={key === 'year'}>
              Found in {dialYear}
            </button>
          </div>

          {key === 'year' && (
            <p className="discover-note">
              {found > 0 ? `${found.toLocaleString('en-US')} planets were found in ${year}. Showing the nearest ${list.length}.` : `No planets were found in ${year}. The first confirmed discoveries came in 1992.`}
            </p>
          )}

          {p && (
            <>
              <div className="exo-hero">
                <OrbitDiagram p={p} />
                <div className="apod-shade" />
                <div className="apod-caption">
                  <span className="apod-kicker">Orbits {p.host}</span>
                  <h3>{p.name}</h3>
                </div>
              </div>

              <div className="exo-stats">
                <Stat value={p.lightYears !== null ? formatLightYears(p.lightYears).replace(' light-years', ' ly') : 'unknown'} label="from Earth" />
                <Stat value={p.periodDays !== null ? formatPeriod(p.periodDays) : 'unknown'} label="one year there" />
                <Stat value={p.radiusEarth !== null ? `${p.radiusEarth}× Earth` : 'unknown'} label="width" />
              </div>

              {p.radiusEarth !== null && (
                <div className="exo-sizes" role="img" aria-label={`Size next to Earth: ${p.radiusEarth} times Earth's width`}>
                  <span>
                    <i style={{ width: 24, height: 24, background: 'radial-gradient(circle at 35% 30%, #8fd3e0, #1d4a6b)' }} />
                    Earth
                  </span>
                  <span>
                    <i style={{ width: sizeCirclePx(p.radiusEarth), height: sizeCirclePx(p.radiusEarth), background: 'radial-gradient(circle at 35% 30%, #ffd9a0, #8a4a2a)' }} />
                    {p.name}
                  </span>
                </div>
              )}

              <ul className="exo-facts">
                {p.tempK !== null && <li>Equilibrium temperature {formatTemp(p.tempK)}</li>}
                {p.massEarth !== null && <li>About {p.massEarth}× Earth's mass</li>}
                {p.orbitAu !== null && <li>Orbits {p.orbitAu} AU from its star (Earth is at 1)</li>}
                {p.year !== null && (
                  <li>
                    Found in {p.year}
                    {p.method ? ` by ${methodLabel(p.method)}` : ''}
                  </li>
                )}
                {p.planetsInSystem !== null && p.planetsInSystem > 1 && <li>One of {p.planetsInSystem} known planets around {p.host}</li>}
              </ul>
            </>
          )}

          {list.length > 1 && (
            <ul className="exo-list">
              {list.map((x, i) => (
                <li key={x.name}>
                  <button className={i === pick ? 'on' : ''} onClick={() => setPick(i)} aria-pressed={i === pick}>
                    <strong>{x.name}</strong>
                    <span>{x.lightYears !== null ? `${formatLightYears(x.lightYears).replace(' light-years', ' ly')}` : ''}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="apod-credit">
            NASA Exoplanet Archive.
            {key === 'earth' && ' "Earth-sized, mild" means 0.5 to 1.6 times Earth\'s width with an equilibrium temperature of 180 to 310 K. It is a rough filter, not a claim that life is possible.'}
          </p>
        </>
      )}
    </div>
  );
}
