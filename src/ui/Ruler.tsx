import { formatLunar, ldPosition } from '../discover/neo';

/** Distance from Earth on a log scale, with the Moon and 10 Moon distances marked. */
export function Ruler({ lunar }: { lunar: number }) {
  const pct = (l: number) => `${ldPosition(l) * 100}%`;
  return (
    <div className="ruler" role="img" aria-label={`${formatLunar(lunar)} times the distance to the Moon`}>
      <span className="ruler-earth" />
      <span className="ruler-tick" style={{ left: pct(1) }}>
        <i>Moon</i>
      </span>
      <span className="ruler-tick" style={{ left: pct(10) }}>
        <i>10×</i>
      </span>
      <span className="ruler-dot" style={{ left: pct(lunar) }} />
    </div>
  );
}
