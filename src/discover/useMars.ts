import { useEffect, useState } from 'react';
import { NasaError, messageFor } from './nasa';
import { type Manifest, type MarsPhoto, type RoverName, clampDate, loadManifest, loadPhotos, nearestPhotoDate } from './mars';

export interface MarsState {
  manifest: Manifest | null;
  date: string | null; // the day actually shown (nearest day with photos)
  photos: MarsPhoto[];
  busy: boolean;
  error: string | null;
}

export function useMars(rover: RoverName, requested: string): MarsState {
  const [state, setState] = useState<MarsState>({ manifest: null, date: null, photos: [], busy: true, error: null });

  useEffect(() => {
    const ac = new AbortController();
    setState((s) => ({ ...s, busy: true, error: null }));
    (async () => {
      const manifest = await loadManifest(rover);
      const target = nearestPhotoDate(manifest.days, clampDate(requested, manifest.landingDate, manifest.maxDate));
      if (!target) throw new NasaError('shape');
      const photos = await loadPhotos(rover, target, ac.signal);
      if (!ac.signal.aborted) setState({ manifest, date: target, photos, busy: false, error: null });
    })().catch((e: unknown) => {
      if (ac.signal.aborted) return;
      setState((s) => ({ ...s, busy: false, error: messageFor(e instanceof NasaError ? e.kind : 'network') }));
    });
    return () => ac.abort();
  }, [rover, requested]);

  return state;
}
