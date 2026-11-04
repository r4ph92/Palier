import type { AssignedSpot } from '@palier/shared-types';
import { useCallback, useState } from 'react';
import { PalierUnauthorizedError } from '../api/AuthClient';
import type { EntryClient } from '../api/EntryClient';
import { PalierUnreachableError } from '../api/LotsClient';
import { PalierConsentRequiredError, PalierRejectedError } from '../api/VehicleClient';

// Refusals the driver can act on or understand; any other code reads as "cannot reach Palier".
export const ENTRY_REFUSALS = [
  'QR_NOT_RECOGNIZED',
  'NOT_AN_ENTRY_GATE',
  'LOT_NOT_IN_SERVICE',
  'PREREQUISITES_MISSING',
  'OPERATOR_NOT_PAYABLE',
  'LOT_FULL',
  'ALREADY_INSIDE',
  'CARD_DECLINED',
] as const;

export type EntryRefusal = (typeof ENTRY_REFUSALS)[number];

export type EntryState =
  | { readonly status: 'idle' }
  | { readonly status: 'submitting' }
  | { readonly status: 'entered'; readonly spot: AssignedSpot }
  | { readonly status: 'refused'; readonly refusal: EntryRefusal }
  | { readonly status: 'unreachable' };

export interface EntryController {
  readonly state: EntryState;
  readonly qrContent: string;
  setQrContent(qrContent: string): void;
  submit(): void;
  startOver(): void;
}

const IDLE: EntryState = { status: 'idle' };

export function useEntry(client: EntryClient): EntryController {
  const [state, setState] = useState<EntryState>(IDLE);
  const [qrContent, setQrContent] = useState('');
  const submit = useCallback(async () => {
    setState({ status: 'submitting' });
    try {
      const entry = await client.enter(qrContent);
      setState({ status: 'entered', spot: entry.spot });
    } catch (error) {
      // Run inside the state update so an unexpected error is thrown during render and reaches the error boundary.
      setState(() => stateAfterFailure(error));
    }
  }, [client, qrContent]);
  const startOver = useCallback(() => {
    setQrContent('');
    setState(IDLE);
  }, []);
  return { state, qrContent, setQrContent, submit, startOver };
}

// A refused session or a missing notice already moves the app off this screen, so the form simply goes back to idle.
function stateAfterFailure(error: unknown): EntryState {
  if (error instanceof PalierRejectedError) {
    return isEntryRefusal(error.code) ? { status: 'refused', refusal: error.code } : { status: 'unreachable' };
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
