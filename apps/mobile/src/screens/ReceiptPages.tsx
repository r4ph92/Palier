import { useState } from 'react';
import type { ReceiptClient } from '../api/ReceiptClient';
import { ReceiptScreen } from './ReceiptScreen';
import { ReceiptsScreen } from './ReceiptsScreen';

interface ReceiptPagesProps {
  readonly client: ReceiptClient;
  readonly onBack: () => void;
}

// The list, and one receipt opened from it. Leaving the account tab drops the choice, so Reçus always reopens on the list.
export function ReceiptPages({ client, onBack }: ReceiptPagesProps) {
  const [openedId, setOpenedId] = useState<string | null>(null);
  if (openedId === null) {
    return <ReceiptsScreen client={client} onOpenReceipt={setOpenedId} onBack={onBack} />;
  }
  return <ReceiptScreen client={client} sessionId={openedId} onBack={() => setOpenedId(null)} />;
}
