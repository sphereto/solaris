import { useEffect, useState } from 'react';
import { NasaError, messageFor } from './nasa';
import { type NeoObject, loadNeo } from './neo';

export interface NeoState {
  objects: NeoObject[] | null; // last good list, kept while the next window loads
  start: string | null;
  busy: boolean;
  error: string | null;
  retry: () => void;
}

export function useNeo(start: string): NeoState {
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<Omit<NeoState, 'retry'>>({ objects: null, start: null, busy: true, error: null });

  useEffect(() => {
    const ac = new AbortController();
    setState((s) => ({ ...s, busy: true, error: null }));
    loadNeo(start, ac.signal)
      .then((objects) => {
        if (!ac.signal.aborted) setState({ objects, start, busy: false, error: null });
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        setState((s) => ({ ...s, busy: false, error: messageFor(e instanceof NasaError ? e.kind : 'network') }));
      });
    return () => ac.abort();
  }, [start, nonce]);

  return { ...state, retry: () => setNonce((n) => n + 1) };
}
