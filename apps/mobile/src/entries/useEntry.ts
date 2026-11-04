import type { AssignedSpot, EntryRefusalCode } from '@palier/shared-types';
import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import { PalierUnauthorizedError } from '../api/AuthClient';
import type { EntryClient } from '../api/EntryClient';
import { PalierStatusError, PalierUnreachableError } from '../api/LotsClient';
import { PalierConsentRequiredError, PalierRejectedError } from '../api/VehicleClient';
import type { FollowedEntry, PendingEntryWatch } from './usePendingEntryWatch';

// Refusals with a message of their own; any unknown code reads as "Palier is not responding".
export const ENTRY_REFUSALS = [
  'QR_NOT_RECOGNIZED',
  'NOT_AN_ENTRY_GATE',
  'LOT_NOT_IN_SERVICE',
  'GATE_UNAVAILABLE',
  'PREREQUISITES_MISSING',
  'OPERATOR_NOT_PAYABLE',
  'LOT_FULL',
  'NO_SUITABLE_SPOT',
  'ALREADY_INSIDE',
  'CARD_DECLINED',
  'PAYMENTS_UNAVAILABLE',
  'TOO_MANY_ENTRIES',
] as const satisfies readonly EntryRefusalCode[];

export type EntryRefusal = (typeof ENTRY_REFUSALS)[number];

export type EntryState =
  | { readonly status: 'idle' }
  | { readonly status: 'submitting' }
  | { readonly status: 'entered'; readonly sessionId: string; readonly spot: AssignedSpot; readonly isConfirmed: boolean }
  | { readonly status: 'cancelled'; readonly sessionId: string }
  // authorizedCents is the hold a declined card refused, when the API named it.
  | { readonly status: 'refused'; readonly refusal: EntryRefusal; readonly authorizedCents: number | null }
  | { readonly status: 'notResponding' }
  | { readonly status: 'unreachable' };

export interface EntryController {
  readonly state: EntryState;
  readonly qrContent: string;
  setQrContent(qrContent: string): void;
  submit(): void;
  startOver(): void;
}

const IDLE: EntryState = { status: 'idle' };
const NOT_RESPONDING: EntryState = { status: 'notResponding' };

// The barrier's entry is handed to the watch above the tabs, which alone polls it and reports what became of it.
export function useEntry(client: EntryClient, pendingEntry: PendingEntryWatch): EntryController {
  const [state, setState] = useState<EntryState>(IDLE);
  const [qrContent, setQrContent] = useState('');
  const { followed, watch, clear } = pendingEntry;
  const submit = useCallback(() => {
    if (qrContent.trim() !== '') {
      clear();
      void enter(client, qrContent, { setState, watch });
    }
  }, [client, qrContent, clear, watch]);
  const startOver = useCallback(() => {
    setQrContent('');
    setState(IDLE);
  }, []);
  return { state: withFollowedOutcome(state, followed), qrContent, setQrContent, submit, startOver };
}

// On the spot the outcome replaces the barrier line; once the driver left the spot, only a cancellation still shows, on the form.
function withFollowedOutcome(state: EntryState, followed: FollowedEntry | null): EntryState {
  if (followed === null || followed.outcome === 'waiting') {
    return state;
  }
  const cancelled: EntryState = { status: 'cancelled', sessionId: followed.sessionId };
  if (state.status === 'entered' && state.sessionId === followed.sessionId) {
    return followed.outcome === 'confirmed' ? { ...state, isConfirmed: true } : cancelled;
  }
  return state.status === 'idle' && followed.outcome === 'cancelled' ? cancelled : state;
}

interface EntryUpdates {
  readonly setState: Dispatch<SetStateAction<EntryState>>;
  readonly watch: (sessionId: string) => void;
}

async function enter(client: EntryClient, qrContent: string, { setState, watch }: EntryUpdates): Promise<void> {
  setState({ status: 'submitting' });
  try {
    const entry = await client.enter(qrContent);
    setState({ status: 'entered', sessionId: entry.sessionId, spot: entry.spot, isConfirmed: false });
    watch(entry.sessionId);
  } catch (error) {
    // Run inside the state update so an unexpected error is thrown during render and reaches the error boundary.
    setState(() => stateAfterFailure(error));
  }
}

// A refused session or a missing notice already moves the app off this screen, so the form simply goes back to idle.
// A status error is checked before the network error it extends: the API answered, so the connection is fine.
function stateAfterFailure(error: unknown): EntryState {
  if (error instanceof PalierRejectedError) {
    return isEntryRefusal(error.code) ? { status: 'refused', refusal: error.code, authorizedCents: error.authorizedCents } : NOT_RESPONDING;
  }
  if (error instanceof PalierStatusError) {
    return NOT_RESPONDING;
  }
  if (error instanceof PalierUnreachableError) {
    return { status: 'unreachable' };
  }
  if (error instanceof PalierUnauthorizedError || error instanceof PalierConsentRequiredError) {
    return IDLE;
  }
  throw error;
}

function isEntryRefusal(code: string): code is EntryRefusal {
  return (ENTRY_REFUSALS as readonly string[]).includes(code);
}
