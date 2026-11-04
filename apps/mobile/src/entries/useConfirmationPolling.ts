import { useEffect } from 'react';
import type { EntrySessionState } from '@palier/shared-types';
import type { EntryClient } from '../api/EntryClient';
import { PalierUnauthorizedError } from '../api/AuthClient';
import { PalierStatusError, PalierUnreachableError } from '../api/LotsClient';
import { PalierConsentRequiredError, PalierRejectedError } from '../api/VehicleClient';

export const ENTRY_STATUS_POLL_MILLISECONDS = 2000;
export const ENTRY_STATUS_POLL_LIMIT_MILLISECONDS = 2 * 60 * 1000;
const MAXIMUM_POLLS = ENTRY_STATUS_POLL_LIMIT_MILLISECONDS / ENTRY_STATUS_POLL_MILLISECONDS;

type Outcome = 'confirmed' | 'cancelled' | 'waiting' | 'refused';

interface Handlers {
  onConfirmed: () => void;
  onUnexpectedError: (error: unknown) => void;
}

export function useConfirmationPolling(client: EntryClient, sessionId: string | null, handlers: Handlers): void {
  const { onConfirmed, onUnexpectedError } = handlers;
  useEffect(() => {
    return sessionId === null ? undefined : startPolling(client, sessionId, { onConfirmed, onUnexpectedError });
  }, [client, sessionId, onConfirmed, onUnexpectedError]);
}

type PollHandlers = Handlers & { stop: () => void };

interface Poll {
  isActive: boolean;
  isAsking: boolean;
  count: number;
}

// A request still in flight never overlaps the next tick.
function startPolling(client: EntryClient, sessionId: string, handlers: Handlers): () => void {
  const poll: Poll = { isActive: true, isAsking: false, count: 0 };
  const stop = () => {
    poll.isActive = false;
    clearInterval(timer);
  };
  const timer = setInterval(() => void tick(poll, () => askOnce(client, sessionId), { ...handlers, stop }), ENTRY_STATUS_POLL_MILLISECONDS);
  return stop;
}

async function tick(poll: Poll, ask: () => Promise<Outcome>, handlers: PollHandlers): Promise<void> {
  if (poll.isAsking) {
    return;
  }
  poll.isAsking = true;
  poll.count += 1;
  try {
    settle(poll, await ask(), handlers);
  } catch (error) {
    stopAndReport(poll, error, handlers);
  } finally {
    poll.isAsking = false;
  }
}

function settle(poll: Poll, outcome: Outcome, handlers: PollHandlers): void {
  if (poll.isActive && outcome === 'confirmed') {
    handlers.onConfirmed();
  }
  if (outcome !== 'waiting' || poll.count >= MAXIMUM_POLLS) {
    handlers.stop();
  }
}

function stopAndReport(poll: Poll, error: unknown, handlers: PollHandlers): void {
  const wasActive = poll.isActive;
  handlers.stop();
  if (wasActive) {
    handlers.onUnexpectedError(error);
  }
}

async function askOnce(client: EntryClient, sessionId: string): Promise<Outcome> {
  try {
    return outcomeOf((await client.status(sessionId)).state);
  } catch (error) {
    return outcomeOfFailure(error);
  }
}

// A status error is checked before the network error it extends: the API answered, so only a 4xx is final (status() has no refusal statuses, so a proxy 5xx stays a status error).
function outcomeOfFailure(error: unknown): Outcome {
  if (error instanceof PalierUnauthorizedError || error instanceof PalierConsentRequiredError || error instanceof PalierRejectedError) {
    return 'refused';
  }
  if (error instanceof PalierStatusError) {
    return error.status >= 500 ? 'waiting' : 'refused';
  }
  if (error instanceof PalierUnreachableError) {
    return 'waiting';
  }
  throw error;
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
