import { useEffect, useState } from 'react';
import { type Apod, NasaError, fetchApod, messageFor, readCachedApod, writeCachedApod } from './nasa';

export interface ApodView {
  apod: Apod | null; // last good picture, kept on screen while the next one loads
  busy: boolean;
  error: string | null;
}

export function useApod(date: string): ApodView {
  const [view, setView] = useState<ApodView>(() => {
    const cached = readCachedApod(date);
    return { apod: cached, busy: !cached, error: null };
  });

  useEffect(() => {
    const cached = readCachedApod(date);
    if (cached) {
      setView({ apod: cached, busy: false, error: null });
      return;
    }
    setView((v) => ({ ...v, busy: true, error: null }));
    const ac = new AbortController();
    fetchApod(date, ac.signal)
      .then((apod) => {
        writeCachedApod(apod);
        setView({ apod, busy: false, error: null });
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        const kind = e instanceof NasaError ? e.kind : 'network';
        setView((v) => ({ ...v, busy: false, error: messageFor(kind) }));
      });
    return () => ac.abort();
  }, [date]);

  return view;
}
