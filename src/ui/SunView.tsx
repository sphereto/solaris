import { useMemo, useState } from 'react';
import { localIso } from '../discover/nasa';
import { SDO_CHANNELS, type SdoChannel, freshBucket, kpLabel, sdoUrl, utcTime } from '../discover/sun';
import { useSun } from '../discover/useSun';
import { useSettings } from '../state/useSettings';
import { PhotoViewer, type ViewerItem } from './PhotoViewer';

/** Live pictures of the Sun and current space weather. Not tied to the dial. */
export function SunView({ onBack, onJump, offsetDays }: { onBack: () => void; onJump: (isoDate: string) => void; offsetDays: number }) {
  const [channel, setChannel] = useState<SdoChannel>('0304');
  const [viewing, setViewing] = useState(false);
  const { data } = useSun();
  const { saveData } = useSettings();
  const size = saveData ? 512 : 1024;
  const bucket = useMemo(() => freshBucket(), []);
  const info = SDO_CHANNELS.find((c) => c.id === channel)!;

  const items = useMemo<ViewerItem[]>(
    () => [
      {
        src: sdoUrl(channel, size, bucket),
        title: info.label,
        kicker: 'The Sun now · SDO',
        caption: info.note,
        credit: 'NASA / SDO',
        date: localIso(new Date()),
        link: sdoUrl(channel, 4096, bucket),
      },
    ],
    [channel, bucket, info, size],
  );

  return (
    <div className="mars">
      <button className="back-btn" onClick={onBack} aria-label="Back to Discover">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </button>

      <div className="apod-frame earth-hero">
        <img key={channel} src={sdoUrl(channel, size, bucket)} alt={`The Sun in ${info.label.toLowerCase()} light, live from NASA SDO`} decoding="async" />
        <div className="apod-shade" />
        <button className="hero-open" onClick={() => setViewing(true)} aria-label="View picture full screen" />
        <div className="apod-caption">
          <span className="apod-kicker">SDO · live</span>
          <h3>{info.label}</h3>
        </div>
      </div>

      <div className="mars-meta">
        <h2>The Sun now</h2>
        <p>Live from NASA SDO and NOAA. {info.note}</p>
      </div>
      {offsetDays !== 0 && <p className="discover-note">This is the Sun right now, not the date on the dial.</p>}

      <div className="chips" role="group" aria-label="Light">
        {SDO_CHANNELS.map((c) => (
          <button key={c.id} className={`chip${channel === c.id ? ' on' : ''}`} onClick={() => setChannel(c.id)} aria-pressed={channel === c.id}>
            {c.label}
          </button>
        ))}
      </div>

      {data?.kp && (
        <p className="facts">
          <span>
            Kp {Math.round(data.kp.value)}: {kpLabel(data.kp.value)}
          </span>
          <span>Measured {utcTime(data.kp.time)}</span>
        </p>
      )}
      {data?.scales && (
        <div className="chips">
          <span className="pill">Radio blackouts R{data.scales.r}</span>
          <span className="pill">Radiation storms S{data.scales.s}</span>
          <span className="pill">Geomagnetic storms G{data.scales.g}</span>
        </div>
      )}
      {data && !data.kp && !data.scales && <p className="discover-error">Space weather numbers are unavailable right now.</p>}

      <p className="apod-credit">NASA / SDO · NOAA Space Weather Prediction Center</p>
      {viewing && <PhotoViewer items={items} index={0} onIndex={() => {}} onClose={() => setViewing(false)} onJump={onJump} />}
    </div>
  );
}
