import { useEffect } from 'react';
import type { EntrySessionState } from '@palier/shared-types';
import type { EntryClient } from '../api/EntryClient';
import { PalierStatusError, PalierUnreachableError } from '../api/LotsClient';

export const ENTRY_STATUS_POLL_MILLISECONDS = 2000;
export const ENTRY_STATUS_POLL_LIMIT_MILLISECONDS = 2 * 60 * 1000;
const MAXIMUM_POLLS = ENTRY_STATUS_POLL_LIMIT_MILLISECONDS / ENTRY_STATUS_POLL_MILLISECONDS;

type Outcome = 'confirmed' | 'cancelled' | 'waiting' | 'refused';

export function useConfirmationPolling(client: EntryClient, sessionId: string | null, onConfirmed: () => void): void {
  useEffect(() => {
    return sessionId === null ? undefined : startPolling(client, sessionId, onConfirmed);
  }, [client, sessionId, onConfirmed]);
}

interface Poll {
  isActive: boolean;
  isAsking: boolean;
  count: number;
}

// A request still in flight never overlaps the next tick.
function startPolling(client: EntryClient, sessionId: string, onConfirmed: () => void): () => void {
  const poll: Poll = { isActive: true, isAsking: false, count: 0 };
  const stop = () => {
    poll.isActive = false;
    clearInterval(timer);
  };
  const timer = setInterval(() => void tick(poll, () => askOnce(client, sessionId), { onConfirmed, stop }), ENTRY_STATUS_POLL_MILLISECONDS);
  return stop;
}

async function tick(poll: Poll, ask: () => Promise<Outcome>, handlers: { onConfirmed: () => void; stop: () => void }): Promise<void> {
  if (poll.isAsking) {
    return;
  }
  poll.isAsking = true;
  poll.count += 1;
  const outcome = await ask();
  poll.isAsking = false;
  if (poll.isActive && outcome === 'confirmed') {
    handlers.onConfirmed();
  }
  if (outcome !== 'waiting' || poll.count >= MAXIMUM_POLLS) {
    handlers.stop();
  }
}

async function askOnce(client: EntryClient, sessionId: string): Promise<Outcome> {
  try {
    return outcomeOf((await client.status(sessionId)).state);
  } catch (error) {
    if (error instanceof PalierStatusError) {
      return 'refused';
    }
    if (error instanceof PalierUnreachableError) {
      return 'waiting';
    }
    throw error;
  }
}

function outcomeOf(state: EntrySessionState): Outcome {
  switch (state) {
    case 'ENTRY_CONFIRMED':
      return 'confirmed';
    case 'CANCELLED':
      return 'cancelled';
    case 'CREATED':
      return 'waiting';
  }
}
