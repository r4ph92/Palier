export type PassageRefusalReason = 'GATE_FORBIDDEN' | 'GATE_WITHOUT_LOOPS' | 'CLOSED_AT_INVALID' | 'CLOSED_AT_IN_FUTURE' | 'GATE_WITHOUT_READER' | 'IDENTIFIER_INVALID';

const MESSAGES: Record<PassageRefusalReason, string> = {
  GATE_FORBIDDEN: 'This device key does not belong to this gate.',
  GATE_WITHOUT_LOOPS: 'This gate has no loops to report passages.',
  CLOSED_AT_INVALID: 'closedAt is not a date the ledger can store.',
  CLOSED_AT_IN_FUTURE: 'closedAt is more than 5 minutes in the future.',
  GATE_WITHOUT_READER: 'This gate has no plate or transponder reader.',
  IDENTIFIER_INVALID: 'The identifier is not a plate or transponder the reader can send.',
};

export class PassageRefusedError extends Error {
  readonly reason: PassageRefusalReason;

  constructor(reason: PassageRefusalReason) {
    super(MESSAGES[reason]);
    this.name = 'PassageRefusedError';
    this.reason = reason;
  }
}
