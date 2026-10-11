import { useEffect, useState } from 'react';
import { type LibItem, loadLibrary } from './library';
import { NasaError, messageFor } from './nasa';

export interface LibraryState {
  items: LibItem[] | null; // last good results, kept on screen while a new search loads
  total: number;
  busy: boolean;
  error: string | null;
}

export function useLibrary(query: string, year: number | null): LibraryState {
  const [state, setState] = useState<LibraryState>({ items: null, total: 0, busy: true, error: null });

  useEffect(() => {
    const ac = new AbortController();
    setState((s) => ({ ...s, busy: true, error: null }));
    loadLibrary(query, year, ac.signal)
      .then((r) => {
        if (!ac.signal.aborted) setState({ items: r.items, total: r.total, busy: false, error: null });
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        setState((s) => ({ ...s, busy: false, error: messageFor(e instanceof NasaError ? e.kind : 'network') }));
      });
    return () => ac.abort();
  }, [query, year]);

  return state;
}
