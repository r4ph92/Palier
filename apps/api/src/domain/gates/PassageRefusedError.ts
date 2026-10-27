export type PassageRefusalReason = 'GATE_FORBIDDEN' | 'GATE_WITHOUT_LOOPS' | 'CLOSED_AT_IN_FUTURE';

const MESSAGES: Record<PassageRefusalReason, string> = {
  GATE_FORBIDDEN: 'This device key does not belong to this gate.',
  GATE_WITHOUT_LOOPS: 'This gate has no loops to report passages.',
  CLOSED_AT_IN_FUTURE: 'closedAt is more than 5 minutes in the future.',
};

export class PassageRefusedError extends Error {
  readonly reason: PassageRefusalReason;

  constructor(reason: PassageRefusalReason) {
    super(MESSAGES[reason]);
    this.name = 'PassageRefusedError';
    this.reason = reason;
  }
}
