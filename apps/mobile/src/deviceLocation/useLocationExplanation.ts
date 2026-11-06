import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { useSingleFlight } from '../useSingleFlight';
import type { BackgroundLocationClient } from './BackgroundLocationClient';
import type { LocationExplanationStore } from './LocationExplanationStore';

export type LocationExplanationState =
  | { readonly status: 'reading' }
  | { readonly status: 'unanswered' }
  | { readonly status: 'prompting' }
  | { readonly status: 'answered' };

export interface LocationExplanationController {
  readonly state: LocationExplanationState;
  readonly continueToPrompt: () => void;
  readonly continueWithout: () => void;
}

interface StoredAnswer {
  readonly state: LocationExplanationState;
  readonly setState: Dispatch<SetStateAction<LocationExplanationState>>;
}

function wasAnsweredOrFalse(store: LocationExplanationStore): Promise<boolean> {
  return store.wasAnswered().catch((error: unknown) => {
    console.warn('Reading the location explanation flag failed; it is shown again', error);
    return false;
  });
}

function useStoredAnswer(store: LocationExplanationStore): StoredAnswer {
  const [state, setState] = useState<LocationExplanationState>({ status: 'reading' });
  useEffect(() => {
    let isCurrent = true;
    wasAnsweredOrFalse(store).then((answered) => {
      if (isCurrent) {
        setState({ status: answered ? 'answered' : 'unanswered' });
      }
    });
    return () => {
      isCurrent = false;
    };
  }, [store]);
  return { state, setState };
}

// A driver who refuses or ignores iOS still counts as answered.
export function useLocationExplanation(store: LocationExplanationStore, location: BackgroundLocationClient): LocationExplanationController {
  const { state, setState } = useStoredAnswer(store);
  const { run } = useSingleFlight<'prompt'>();
  const markAnswered = useCallback(async () => {
    await store.markAnswered().catch((error: unknown) => console.warn('Saving the location explanation flag failed', error));
    setState({ status: 'answered' });
  }, [store, setState]);
  const continueToPrompt = useCallback(() => {
    run('prompt', async () => {
      setState({ status: 'prompting' });
      await location.requestAlways().catch((error: unknown) => console.warn('The « Always » location request failed; automatic detection stays off', error));
      await markAnswered();
    });
  }, [location, markAnswered, run, setState]);
  const continueWithout = useCallback(() => void markAnswered(), [markAnswered]);
  return { state, continueToPrompt, continueWithout };
}
