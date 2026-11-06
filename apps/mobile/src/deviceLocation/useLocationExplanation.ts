import { useCallback, useEffect, useState } from 'react';
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

function useStoredAnswer(store: LocationExplanationStore) {
  const answer = useState<LocationExplanationState>({ status: 'reading' });
  const setState = answer[1];
  useEffect(() => {
    store
      .wasAnswered()
      .catch((error: unknown) => {
        console.warn('Reading the location explanation flag failed; it is shown again', error);
        return false;
      })
      .then((answered) => setState({ status: answered ? 'answered' : 'unanswered' }));
  }, [store, setState]);
  return answer;
}

// Whether the driver has seen the « Always » explanation on this device; a driver who refuses or ignores iOS still counts as answered.
export function useLocationExplanation(store: LocationExplanationStore, location: BackgroundLocationClient): LocationExplanationController {
  const [state, setState] = useStoredAnswer(store);
  const markAnswered = useCallback(async () => {
    await store.markAnswered().catch((error: unknown) => console.warn('Saving the location explanation flag failed', error));
    setState({ status: 'answered' });
  }, [store, setState]);
  const continueToPrompt = useCallback(() => {
    setState({ status: 'prompting' });
    location
      .requestAlways()
      .catch((error: unknown) => console.warn('The « Always » location request failed; automatic detection stays off', error))
      .then(markAnswered);
  }, [location, markAnswered, setState]);
  const continueWithout = useCallback(() => void markAnswered(), [markAnswered]);
  return { state, continueToPrompt, continueWithout };
}
