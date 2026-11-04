import { useState, type Dispatch, type SetStateAction } from 'react';
import type { SavedCard } from '@palier/shared-types';
import { useConfirmSetupIntent } from '@stripe/stripe-react-native';
import type { PaymentMethodClient } from '../api/PaymentMethodClient';
import { useAnnouncement } from '../components/useAnnouncement';
import { i18n } from '../i18n/i18n';

export type SaveStatus = 'idle' | 'saving' | 'incomplete' | 'declined' | 'failed' | 'saved';

// The status line appears without a focus change, so VoiceOver is told about it.
function useAnnounceStatus(status: SaveStatus) {
  useAnnouncement(status === 'idle' || status === 'saving' ? null : i18n.t(`payment.${status}`));
}

type ConfirmSetupIntent = ReturnType<typeof useConfirmSetupIntent>['confirmSetupIntent'];

export function useCardSave(client: PaymentMethodClient, onSaved: (card: SavedCard) => void) {
  const { confirmSetupIntent } = useConfirmSetupIntent();
  const [status, setStatus] = useState<SaveStatus>('idle');
  const { isComplete, changeCard } = useCardCompletion(setStatus);
  useAnnounceStatus(status);

  async function save() {
    if (status === 'saving') {
      return;
    }
    if (!isComplete) {
      setStatus('incomplete');
      return;
    }
    setStatus('saving');
    setStatus(await saveNewCard(client, confirmSetupIntent, onSaved));
  }

  return { status, save, changeCard };
}

// Completing the card clears the "complete the card details" message; a saved card keeps its status.
function useCardCompletion(setStatus: Dispatch<SetStateAction<SaveStatus>>) {
  const [isComplete, setIsComplete] = useState(false);
  function changeCard(complete: boolean) {
    setIsComplete(complete);
    if (complete) {
      setStatus((current) => (current === 'incomplete' ? 'idle' : current));
    }
  }
  return { isComplete, changeCard };
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
