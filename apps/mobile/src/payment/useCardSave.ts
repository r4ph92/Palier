import { useState } from 'react';
import type { SavedCard } from '@palier/shared-types';
import { useConfirmSetupIntent } from '@stripe/stripe-react-native';
import type { PaymentMethodClient } from '../api/PaymentMethodClient';

export type SaveStatus = 'idle' | 'saving' | 'incomplete' | 'declined' | 'failed' | 'saved';

type ConfirmSetupIntent = ReturnType<typeof useConfirmSetupIntent>['confirmSetupIntent'];

export function useCardSave(client: PaymentMethodClient, onSaved: (card: SavedCard) => void) {
  const { confirmSetupIntent } = useConfirmSetupIntent();
  const [isComplete, setIsComplete] = useState(false);
  const [status, setStatus] = useState<SaveStatus>('idle');

  async function save() {
    if (!isComplete) {
      setStatus('incomplete');
      return;
    }
    setStatus('saving');
    setStatus(await saveNewCard(client, confirmSetupIntent, onSaved));
  }

  return { status, save, setIsComplete };
}

// Stripe confirms the card with the app's setup intent; Palier then records only the brand and last four digits.
async function saveNewCard(client: PaymentMethodClient, confirm: ConfirmSetupIntent, onSaved: (card: SavedCard) => void): Promise<SaveStatus> {
  try {
    const clientSecret = await client.createSetupIntent();
    const { setupIntent, error } = await confirm(clientSecret, { paymentMethodType: 'Card' });
    const paymentMethodId = setupIntent?.paymentMethod?.id;
    if (error !== undefined || paymentMethodId === undefined) {
      return 'declined';
    }
    onSaved(await client.saveCard(paymentMethodId));
    return 'saved';
  } catch {
    return 'failed';
  }
}
