import type { AssignedSpot, EntryRefusalCode } from '@palier/shared-types';
import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import { PalierUnauthorizedError } from '../api/AuthClient';
import type { EntryClient } from '../api/EntryClient';
import { PalierStatusError, PalierUnreachableError } from '../api/LotsClient';
import { PalierConsentRequiredError, PalierRejectedError } from '../api/VehicleClient';
import { useConfirmationPolling } from './useConfirmationPolling';

// Refusals with a message of their own; PAYMENTS_UNAVAILABLE and any unknown code read as "Palier is not responding".
export const ENTRY_REFUSALS = [
  'QR_NOT_RECOGNIZED',
  'NOT_AN_ENTRY_GATE',
  'LOT_NOT_IN_SERVICE',
  'GATE_UNAVAILABLE',
  'PREREQUISITES_MISSING',
  'OPERATOR_NOT_PAYABLE',
  'LOT_FULL',
  'ALREADY_INSIDE',
  'CARD_DECLINED',
  'TOO_MANY_ENTRIES',
] as const satisfies readonly EntryRefusalCode[];

export type EntryRefusal = (typeof ENTRY_REFUSALS)[number];

export type EntryState =
  | { readonly status: 'idle' }
  | { readonly status: 'submitting' }
  | { readonly status: 'entered'; readonly sessionId: string; readonly spot: AssignedSpot; readonly isConfirmed: boolean }
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

export function useEntry(client: EntryClient): EntryController {
  const [state, setState] = useState<EntryState>(IDLE);
  const [qrContent, setQrContent] = useState('');
  const submit = useCallback(() => {
    if (qrContent.trim() !== '') {
      void enter(client, qrContent, setState);
    }
  }, [client, qrContent]);
  const startOver = useCallback(() => {
    setQrContent('');
    setState(IDLE);
  }, []);
  const confirm = useCallback(() => setState(withEntryConfirmed), []);
  // Thrown inside the state update, like in enter(), so an unexpected error reaches the error boundary.
  const failConfirmation = useCallback((error: unknown) => setState(() => { throw error; }), []);
  useConfirmationPolling(client, unconfirmedSessionId(state), { onConfirmed: confirm, onUnexpectedError: failConfirmation });
  return { state, qrContent, setQrContent, submit, startOver };
}

function unconfirmedSessionId(state: EntryState): string | null {
  return state.status === 'entered' && !state.isConfirmed ? state.sessionId : null;
}

function withEntryConfirmed(state: EntryState): EntryState {
  return state.status === 'entered' ? { ...state, isConfirmed: true } : state;
}

async function enter(client: EntryClient, qrContent: string, setState: Dispatch<SetStateAction<EntryState>>): Promise<void> {
  setState({ status: 'submitting' });
  try {
    const entry = await client.enter(qrContent);
    setState({ status: 'entered', sessionId: entry.sessionId, spot: entry.spot, isConfirmed: false });
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
