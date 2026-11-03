import { useEffect, useMemo, useState } from 'react';
import { firstSentence, longDate } from '../discover/feed';
import { type Snapshot, formatLightYears, loadSnapshot } from '../discover/exoplanets';
import { closestOf, formatLunar } from '../discover/neo';
import { apodDateFor, localIso } from '../discover/nasa';
import { freshBucket, kpLabel, sdoUrl } from '../discover/sun';
import { millionKm } from '../discover/units';
import { useApod } from '../discover/useApod';
import { useEarth } from '../discover/useEarth';
import { useNeo } from '../discover/useNeo';
import { useSun } from '../discover/useSun';
import { useSettings } from '../state/useSettings';
import { ErrorNote } from './ErrorNote';
import { OrbitDiagram } from './ExoplanetView';
import { PhotoViewer } from './PhotoViewer';
import { Ruler } from './Ruler';
import { useDebounced } from './useDebounced';

export type FeedTarget = 'earth' | 'sun' | 'neo' | 'library' | 'exo';

/** Today: one big picture, then a few full-width cards, each leading to a full screen of its own. */
export function DiscoverFeed({ shown, onOpen, onJump }: { shown: Date; onOpen: (t: FeedTarget) => void; onJump: (isoDate: string) => void }) {
  const { units, dateFormat } = useSettings();
  const iso = useDebounced(localIso(shown), 350);
  const apodDate = useDebounced(apodDateFor(shown), 350);
  const { apod, busy, error, retry } = useApod(apodDate);
  const earth = useEarth(iso);
  const sun = useSun();
  const neo = useNeo(iso);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [viewing, setViewing] = useState(false);
  const bucket = useMemo(() => freshBucket(), []);

  useEffect(() => {
    let live = true;
    loadSnapshot().then((s) => live && setSnap(s));
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => setViewing(false), [apodDate]);

  const clamped = localIso(shown) !== apodDate;
  const isToday = localIso(shown) === localIso(new Date());
  const picture = apod?.mediaType === 'video' ? apod.thumbUrl : apod?.url;
  const eImg = earth.images[earth.images.length - 1];
  const closest = closestOf(neo.objects ?? []);
  const planet = snap && snap.generatedAt ? snap.newest[0] : null;

  return (
    <>
      <section className="dv-hero" aria-label="Picture of the day">
        {picture ? <img src={picture} alt={apod?.title ?? ''} decoding="async" /> : <div className={`dv-hero-empty${busy ? ' skeleton' : ''}`} aria-hidden="true" />}
        <div className="dv-hero-shade" />
        {apod?.mediaType === 'image' && <button className="dv-open" onClick={() => setViewing(true)} aria-label="View picture full screen" />}
        <div className="dv-hero-text">
          <div className="dv-kicker">Picture of the day</div>
          <h1>{apod?.title ?? (error ? 'Not available' : 'Loading…')}</h1>
          {apod && <p>{firstSentence(apod.explanation)}</p>}
          {clamped && <p className="dv-note">NASA has no picture for this date, so this is the closest one ({apodDate}).</p>}
          {error && !busy && <ErrorNote message={error} onRetry={retry} />}
        </div>
      </section>

      <section className="dv-now" aria-label="More from NASA">
        <h2 className="dv-h2">{isToday ? 'Happening now' : `On ${longDate(shown, dateFormat)}`}</h2>

        <button className="dv-card" onClick={() => onOpen('earth')}>
          <span className="dv-disc">{eImg ? <img src={eImg.jpg} alt="" loading="lazy" decoding="async" /> : <span className={earth.busy ? 'skeleton' : ''} />}</span>
          <span className="dv-card-text">
            <span className="dv-kicker">Earth now</span>
            <span className="dv-card-title">{eImg ? `${eImg.time} UTC` : earth.error ? 'Unavailable' : 'Loading…'}</span>
            <span className="dv-card-line">{eImg?.distanceKm ? `The whole disc, from ${millionKm(eImg.distanceKm, units)} away.` : 'The whole disc, from a satellite far away.'}</span>
          </span>
        </button>

        <button className="dv-card" onClick={() => onOpen('sun')}>
          <span className="dv-disc dv-disc-sun">
            <img src={sdoUrl('0304', 512, bucket)} alt="" loading="lazy" decoding="async" />
          </span>
          <span className="dv-card-text">
            <span className="dv-kicker">The Sun now</span>
            <span className="dv-card-title">{sun.data?.kp ? `Kp ${Math.round(sun.data.kp.value)}, ${kpLabel(sun.data.kp.value)}` : 'Live'}</span>
            <span className="dv-card-line">A live look at the Sun, and how stormy space weather is.</span>
          </span>
        </button>

        <button className="dv-card dv-card-neo" onClick={() => onOpen('neo')}>
          <span className="dv-kicker dv-neo-kicker">Closest asteroid, next 7 days</span>
          {closest ? (
            <>
              <span className="dv-bignum">{formatLunar(closest.lunar)}×</span>
              <span className="dv-card-line dv-neo-ruler">
                <Ruler lunar={closest.lunar} />
              </span>
              <span className="dv-card-text dv-neo-text">
                <span className="dv-card-title">{closest.name}</span>
                <span className="dv-card-line">the Moon's distance, on {closest.date}</span>
              </span>
            </>
          ) : (
            <span className="dv-card-title dv-neo-wait">{neo.error ? 'Unavailable' : 'Loading…'}</span>
          )}
        </button>

        {planet && (
          <button className="dv-card dv-card-exo" onClick={() => onOpen('exo')}>
            <span className="dv-exo-art">
              <OrbitDiagram p={planet} />
            </span>
            <span className="dv-card-text">
              <span className="dv-kicker">Newest world found</span>
              <span className="dv-card-title">{planet.name}</span>
              <span className="dv-card-line">
                Orbits {planet.host}
                {planet.lightYears !== null ? `, ${formatLightYears(planet.lightYears)} away` : ''}
              </span>
            </span>
          </button>
        )}

        <button className="dv-card dv-card-lib" onClick={() => onOpen('library')}>
          <span className="dv-card-text dv-lib-text">
            <span className="dv-kicker">NASA Image Library</span>
            <span className="dv-card-title">Search the archive</span>
            <span className="dv-card-line">Galaxies, the Moon, Mars, the Space Station and more.</span>
          </span>
        </button>
      </section>

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
          onJump={onJump}
        />
      )}
    </>
  );
}
