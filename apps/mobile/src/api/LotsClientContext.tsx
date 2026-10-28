import { createContext, useContext, type ReactNode } from 'react';
import type { LotsClient } from './LotsClient';

const LotsClientContext = createContext<LotsClient | null>(null);

interface LotsClientProviderProps {
  readonly client: LotsClient;
  readonly children: ReactNode;
}

export function LotsClientProvider({ client, children }: LotsClientProviderProps) {
  return <LotsClientContext.Provider value={client}>{children}</LotsClientContext.Provider>;
}

export function useLotsClient(): LotsClient {
  const client = useContext(LotsClientContext);
  if (client === null) {
    throw new Error('useLotsClient must be used inside a LotsClientProvider.');
  }
  return client;
}
