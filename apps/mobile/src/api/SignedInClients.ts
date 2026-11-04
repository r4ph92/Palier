import type { EntryClient } from './EntryClient';
import type { LotsClient } from './LotsClient';
import type { PaymentMethodClient } from './PaymentMethodClient';
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
}

export type CreateSignedInClients = (session: SignedInSession) => SignedInClients;
