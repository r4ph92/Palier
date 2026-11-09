import type { ReceiptDetail, ReceiptSummary } from '@palier/shared-types';
import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { PalierUnauthorizedError } from '../api/AuthClient';
import { PalierStatusError, PalierUnreachableError } from '../api/LotsClient';
import type { ReceiptClient } from '../api/ReceiptClient';
import { PalierConsentRequiredError } from '../api/VehicleClient';

export type ReceiptsState<T> = { readonly status: 'loading' } | { readonly status: 'loaded'; readonly value: T } | { readonly status: 'error' };

export interface ReceiptsController<T> {
  readonly state: ReceiptsState<T>;
  reload(): void;
}

export function useReceiptList(client: ReceiptClient): ReceiptsController<readonly ReceiptSummary[]> {
  const [state, setState] = useState<ReceiptsState<readonly ReceiptSummary[]>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let isLatestAttempt = true;
    client.listReceipts().then(
      ({ receipts }) => isLatestAttempt && setState({ status: 'loaded', value: receipts }),
      (error: unknown) => isLatestAttempt && settleFailure(error, setState),
    );
    return () => {
      isLatestAttempt = false;
    };
  }, [client, attempt]);
  const reload = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((previous) => previous + 1);
  }, []);
  return { state, reload };
}

export function useReceipt(client: ReceiptClient, sessionId: string): ReceiptsController<ReceiptDetail> {
  const [state, setState] = useState<ReceiptsState<ReceiptDetail>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let isLatestAttempt = true;
    client.findReceipt(sessionId).then(
      ({ receipt }) => isLatestAttempt && setState({ status: 'loaded', value: receipt }),
      (error: unknown) => isLatestAttempt && settleFailure(error, setState),
    );
    return () => {
      isLatestAttempt = false;
    };
  }, [client, sessionId, attempt]);
  const reload = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((previous) => previous + 1);
  }, []);
  return { state, reload };
}

// A refused session or a missing notice already moves the app off this screen. A receipt that no longer exists (a 404, for
// instance after its 90 days) shows the same retry message as a network error.
function settleFailure<T>(error: unknown, setState: Dispatch<SetStateAction<ReceiptsState<T>>>): void {
  if (error instanceof PalierUnreachableError || error instanceof PalierStatusError) {
    setState({ status: 'error' });
    return;
  }
  if (error instanceof PalierConsentRequiredError || error instanceof PalierUnauthorizedError) {
    return;
  }
  setState(() => {
    throw error;
  });
}
