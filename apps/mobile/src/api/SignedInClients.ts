import type { BackgroundLocationClient } from '../deviceLocation/BackgroundLocationClient';
import type { DeviceLocationClient } from '../deviceLocation/DeviceLocationClient';
import type { LocationExplanationStore } from '../deviceLocation/LocationExplanationStore';
import type { OfflineWalkStore } from '../parkingSessions/OfflineWalkStore';
import type { EntryClient } from './EntryClient';
import type { LotsClient } from './LotsClient';
import type { ParkingSessionClient } from './ParkingSessionClient';
import type { PaymentMethodClient } from './PaymentMethodClient';
import type { SpotHoldClient } from './SpotHoldClient';
import type { VehicleClient } from './VehicleClient';

// What every client of a signed-in driver receives: the token and what to do when the API refuses it.
export interface SignedInSession {
  readonly token: string;
  readonly onUnauthorized: () => void;
  readonly onConsentRequired: () => void;
}

// A new API client is one more field here and one more line in App.tsx's factory.
export interface SignedInClients {
  readonly lots: LotsClient;
  readonly payment: PaymentMethodClient;
  readonly vehicles: VehicleClient;
  readonly entry: EntryClient;
  readonly parkingSession: ParkingSessionClient;
  readonly spotHold: SpotHoldClient;
  readonly location: DeviceLocationClient;
  readonly backgroundLocation: BackgroundLocationClient;
  readonly locationExplanation: LocationExplanationStore;
  readonly offlineWalks: OfflineWalkStore;
}

export type CreateSignedInClients = (session: SignedInSession) => SignedInClients;
