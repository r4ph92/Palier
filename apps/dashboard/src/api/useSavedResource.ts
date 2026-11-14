import { useCallback, useState } from 'react';
import { useResource, type LoadedResource } from './useResource.ts';

export interface SavedResource<T> extends LoadedResource<T> {
  // What a write answered, shown in place of the first load: the page always shows what the API saved.
  readonly latest: T | null;
  readonly show: (value: T) => void;
  // Reads it again after a write refused because the page was out of date; false when that read failed too.
  readonly refresh: () => Promise<boolean>;
}

// load must stay stable (useCallback): it runs once, again on reload, and on refresh.
export function useSavedResource<T>(load: () => Promise<T>): SavedResource<T> {
  const loaded = useResource(load);
  const [latest, setLatest] = useState<T | null>(null);
  const refresh = useCallback(async () => {
    try {
      setLatest(await load());
      return true;
    } catch {
      return false;
    }
  }, [load]);
  return { ...loaded, latest, show: setLatest, refresh };
}
