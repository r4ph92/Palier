import * as SecureStore from 'expo-secure-store';

const LOCATION_EXPLANATION_ANSWERED_KEY = 'palier.locationExplanationAnswered';
const ANSWERED = 'true';

export interface LocationExplanationStore {
  wasAnswered(): Promise<boolean>;
  markAnswered(): Promise<void>;
}

// The iOS prompt is asked once per device, not per driver, so signing out does not clear this.
export const secureLocationExplanationStore: LocationExplanationStore = {
  wasAnswered: async () => (await SecureStore.getItemAsync(LOCATION_EXPLANATION_ANSWERED_KEY)) === ANSWERED,
  markAnswered: () => SecureStore.setItemAsync(LOCATION_EXPLANATION_ANSWERED_KEY, ANSWERED),
};
