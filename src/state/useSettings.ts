import { useSyncExternalStore } from 'react';
import { type Settings, settingsCore } from './settingsCore';

export function useSettings(): Settings {
  return useSyncExternalStore(settingsCore.subscribe, settingsCore.get);
}
