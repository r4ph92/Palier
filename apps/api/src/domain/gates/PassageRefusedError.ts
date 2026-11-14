export type PassageRefusalReason =
  | 'GATE_WITHOUT_LOOPS'
  | 'CLOSED_AT_INVALID'
  | 'CLOSED_AT_IN_FUTURE'
  | 'GATE_WITHOUT_READER'
  | 'IDENTIFIER_INVALID'
  | 'GATE_NOT_EXIT'
  | 'REPLAY_KIND_MISMATCH'
  | 'REPLAY_IDS_REPEATED'
  | 'CLOSED_AT_TOO_OLD';

const MESSAGES: Record<PassageRefusalReason, string> = {
  GATE_WITHOUT_LOOPS: 'This gate has no loops to report passages.',
  CLOSED_AT_INVALID: 'closedAt is not a date the ledger can store.',
  CLOSED_AT_IN_FUTURE: 'closedAt is more than 5 minutes in the future.',
  GATE_WITHOUT_READER: 'This gate has no plate or transponder reader.',
  IDENTIFIER_INVALID: 'The identifier is not a plate or transponder the reader can send.',
  GATE_NOT_EXIT: 'Only an exit gate can see a vehicle at the exit.',
  REPLAY_KIND_MISMATCH: 'A replayed passage is of another kind than this gate.',
  REPLAY_IDS_REPEATED: 'A passage id appears twice in the batch.',
  CLOSED_AT_TOO_OLD: 'closedAt is more than 7 days in the past.',
};

export class PassageRefusedError extends Error {
  readonly reason: PassageRefusalReason;

  constructor(reason: PassageRefusalReason) {
    super(MESSAGES[reason]);
    this.name = 'PassageRefusedError';
    this.reason = reason;
  }
}
