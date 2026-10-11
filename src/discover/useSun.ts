import { useEffect, useState } from 'react';
import { type SunData, loadSun } from './sun';

/** Space weather numbers, refreshed every 5 minutes while the screen is open. */
export function useSun(): { data: SunData | null; busy: boolean } {
  const [data, setData] = useState<SunData | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    const ac = new AbortController();
    const run = () =>
      loadSun(ac.signal)
        .then((d) => {
          if (ac.signal.aborted) return;
          setData(d);
          setBusy(false);
        })
        .catch(() => setBusy(false));
    run();
    const id = setInterval(run, 300_000);
    return () => {
      ac.abort();
      clearInterval(id);
    };
  }, []);

  return { data, busy };
}
