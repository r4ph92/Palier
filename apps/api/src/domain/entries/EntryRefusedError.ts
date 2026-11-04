import type { EntryRefusalCode } from '@palier/shared-types';

const MESSAGES: Record<EntryRefusalCode, string> = {
  QR_NOT_RECOGNIZED: 'This QR is not a Palier terminal.',
  NOT_AN_ENTRY_GATE: 'This QR is not an entry terminal.',
  LOT_NOT_IN_SERVICE: 'This lot is not in service.',
  GATE_UNAVAILABLE: 'This gate cannot be opened by Palier right now.',
  OPERATOR_NOT_PAYABLE: 'This lot cannot take payments right now.',
  PREREQUISITES_MISSING: 'Add a plate and a card before entering.',
  LOT_FULL: 'This lot is full.',
  NO_SUITABLE_SPOT: 'No free spot fits this vehicle.',
  ALREADY_INSIDE: 'You already have an entry in progress.',
  CARD_DECLINED: 'The card was declined.',
  PAYMENTS_UNAVAILABLE: 'Card payments are unavailable right now.',
  TOO_MANY_ENTRIES: 'Too many entry attempts. Try again in a few minutes.',
};

export interface EntryRefusalOptions extends ErrorOptions {
  // CARD_DECLINED only: the hold the card refused.
  readonly authorizedCents?: number;
}

export class EntryRefusedError extends Error {
  readonly reason: EntryRefusalCode;
  readonly authorizedCents: number | undefined;

  constructor(reason: EntryRefusalCode, options?: EntryRefusalOptions) {
    super(MESSAGES[reason], options);
    this.name = 'EntryRefusedError';
    this.reason = reason;
    this.authorizedCents = options?.authorizedCents;
  }
}
