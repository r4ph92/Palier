import type { ExitReceipt } from '@palier/shared-types';
import { useEffect, useState } from 'react';
import type { ReceiptClient } from '../api/ReceiptClient';

export const PENDING_RECEIPT_POLL_MILLISECONDS = 15_000;

// The receipt of an exit whose capture is pending: asked again until Palier has it, which is a 404 until the capture is taken.
// Any failure, a 404 included, only means "not yet": the next poll asks again, and Reçus holds the receipt either way.
export function usePendingReceipt(client: ReceiptClient, sessionId: string): ExitReceipt | null {
  const [receipt, setReceipt] = useState<ExitReceipt | null>(null);
  useEffect(() => {
    let isOpen = true;
    const poll = () => {
      client.findReceipt(sessionId).then(
        ({ receipt: found }) => {
          if (isOpen) {
            setReceipt(found);
          }
        },
        () => undefined,
      );
    };
    const timer = setInterval(poll, PENDING_RECEIPT_POLL_MILLISECONDS);
    return () => {
      isOpen = false;
      clearInterval(timer);
    };
  }, [client, sessionId]);
  return receipt;
}
