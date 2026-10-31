import { useEffect, useState } from 'react';
import type { SavedCard } from '@palier/shared-types';
import type { PaymentMethodClient } from '../api/PaymentMethodClient';

export type CardState =
  | { readonly status: 'loading' }
  | { readonly status: 'failed' }
  | { readonly status: 'loaded'; readonly card: SavedCard | null };

export function usePaymentCard(client: PaymentMethodClient) {
  const [state, setState] = useState<CardState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    client
      .fetchCard()
      .then((card) => active && setState({ status: 'loaded', card }))
      .catch(() => active && setState({ status: 'failed' }));
    return () => {
      active = false;
    };
  }, [client]);

  const setCard = (card: SavedCard) => setState({ status: 'loaded', card });
  return { state, setCard };
}
