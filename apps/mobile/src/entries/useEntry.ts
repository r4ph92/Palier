import type { AssignedSpot, EntryQuoteResponse, EntryRefusalCode } from '@palier/shared-types';
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
  'GATE_SILENT',
  'PREREQUISITES_MISSING',
  'OPERATOR_NOT_PAYABLE',
  'LOT_FULL',
  'NO_SUITABLE_SPOT',
  'ALREADY_INSIDE',
  'CARD_DECLINED',
  'PAYMENTS_UNAVAILABLE',
  'TOO_MANY_ENTRIES',
  'TARIFF_CHANGED',
] as const satisfies readonly EntryRefusalCode[];

export type EntryRefusal = (typeof ENTRY_REFUSALS)[number];

export type EntryState =
  | { readonly status: 'idle' }
  | { readonly status: 'submitting' }
  // The tariff and the hold the driver accepts with « Entrer » (#151); tariffChanged once the lot's tariff changed under her.
  | { readonly status: 'quoted'; readonly quote: EntryQuoteResponse; readonly tariffChanged: boolean }
  | { readonly status: 'entering'; readonly quote: EntryQuoteResponse; readonly tariffChanged: boolean }
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
  // Reads the lot's tariff for the QR: nothing is held or opened yet.
  submit(): void;
  // « Entrer »: enters at the tariff on screen.
  accept(): void;
  startOver(): void;
}

const IDLE: EntryState = { status: 'idle' };
const NOT_RESPONDING: EntryState = { status: 'notResponding' };

// The barrier's entry is handed to the watch above the tabs, which alone polls it and reports what became of it.
export function useEntry(client: EntryClient, pendingEntry: PendingEntryWatch): EntryController {
  const [state, setState] = useState<EntryState>(IDLE);
  const [qrContent, setQrContent] = useState('');
  const { followed, watch, submissionEnded, clear } = pendingEntry;
  const submit = useCallback(() => {
    if (qrContent.trim() !== '') {
      clear();
      void readQuote(client, qrContent, setState);
    }
  }, [client, qrContent, clear]);
  const accept = useAccept(client, { qrContent, state }, { setState, watch, submissionEnded });
  const startOver = useCallback(() => {
    setQrContent('');
    setState(IDLE);
  }, []);
  return { state: withFollowedOutcome(state, followed), qrContent, setQrContent, submit, accept, startOver };
}

// « Entrer » enters only from the tariff screen, at the tariff it shows.
function useAccept(client: EntryClient, { qrContent, state }: { readonly qrContent: string; readonly state: EntryState }, updates: EntryUpdates): () => void {
  const { setState, watch, submissionEnded } = updates;
  return useCallback(() => {
    if (state.status === 'quoted') {
      void enter(client, { qrContent, quote: state.quote }, { setState, watch, submissionEnded });
    }
  }, [client, qrContent, state, setState, watch, submissionEnded]);
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
  readonly submissionEnded: () => void;
}

async function readQuote(client: EntryClient, qrContent: string, setState: Dispatch<SetStateAction<EntryState>>): Promise<void> {
  setState({ status: 'submitting' });
  try {
    setState({ status: 'quoted', quote: await client.quote(qrContent), tariffChanged: false });
  } catch (error) {
    // Run inside the state update so an unexpected error is thrown during render and reaches the error boundary.
    setState(() => stateAfterFailure(error));
  }
}

interface AcceptedEntry {
  readonly qrContent: string;
  readonly quote: EntryQuoteResponse;
}

async function enter(client: EntryClient, { qrContent, quote }: AcceptedEntry, { setState, watch, submissionEnded }: EntryUpdates): Promise<void> {
  setState({ status: 'entering', quote, tariffChanged: false });
  try {
    const entry = await client.enter(qrContent, quote.tariff);
    setState({ status: 'entered', sessionId: entry.sessionId, spot: entry.spot, isConfirmed: false });
    watch(entry.sessionId);
  } catch (error) {
    setState(() => changedTariffState(error, quote) ?? stateAfterFailure(error));
  } finally {
    submissionEnded();
  }
}

// The barrier stayed shut: the driver sees the lot's new tariff and its hold (the daily cap, Q19), and enters only if she taps « Entrer » again.
function changedTariffState(error: unknown, quote: EntryQuoteResponse): EntryState | null {
  if (!(error instanceof PalierRejectedError) || error.code !== 'TARIFF_CHANGED' || error.tariff === null) {
    return null;
  }
  return { status: 'quoted', quote: { ...quote, tariff: error.tariff, holdCents: error.tariff.dailyCapCents }, tariffChanged: true };
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
