import { useEffect, useState } from 'react';
import { clampDate } from './dates';
import { type EpicImage, loadEpicDates, loadEpicDay, nearestEpicDate } from './epic';
import { NasaError, messageFor } from './nasa';

export interface EarthState {
  date: string | null; // the day actually shown (nearest day with images)
  images: EpicImage[];
  busy: boolean;
  error: string | null;
  retry: () => void;
}

export function useEarth(requested: string): EarthState {
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<Omit<EarthState, 'retry'>>({ date: null, images: [], busy: true, error: null });

  useEffect(() => {
    const ac = new AbortController();
    setState((s) => ({ ...s, busy: true, error: null }));
    (async () => {
      const dates = await loadEpicDates();
      const target = nearestEpicDate(dates, clampDate(requested, dates[0], dates[dates.length - 1]));
      if (!target) throw new NasaError('shape');
      const images = await loadEpicDay(target, ac.signal);
      if (!ac.signal.aborted) setState({ date: target, images, busy: false, error: null });
    })().catch((e: unknown) => {
      if (ac.signal.aborted) return;
      setState((s) => ({ ...s, busy: false, error: messageFor(e instanceof NasaError ? e.kind : 'network') }));
    });
    return () => ac.abort();
  }, [requested, nonce]);

  return { ...state, retry: () => setNonce((n) => n + 1) };
}
