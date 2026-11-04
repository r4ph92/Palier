export interface EntryRequest {
  // What the entry terminal's QR holds: its link, or the bare token at the end of that link.
  readonly qrContent: string;
}

export interface AssignedSpot {
  readonly number: string;
  readonly levelCode: string;
  readonly aisleCode: string;
}

export interface EntryResponse {
  readonly sessionId: string;
  readonly spot: AssignedSpot;
  readonly barrierOpened: true;
}

export type EntrySessionState = 'CREATED' | 'ENTRY_CONFIRMED' | 'CANCELLED';

export interface EntryStatusResponse {
  readonly sessionId: string;
  readonly state: EntrySessionState;
  readonly spot: AssignedSpot;
  // When the entry loop proved the car passed; null until then.
  readonly entryConfirmedAt: string | null;
}

export type EntryRefusalCode =
  | 'QR_NOT_RECOGNIZED'
  | 'NOT_AN_ENTRY_GATE'
  | 'LOT_NOT_IN_SERVICE'
  | 'GATE_UNAVAILABLE'
  | 'OPERATOR_NOT_PAYABLE'
  | 'PREREQUISITES_MISSING'
  | 'LOT_FULL'
  | 'ALREADY_INSIDE'
  | 'CARD_DECLINED'
  | 'PAYMENTS_UNAVAILABLE'
  | 'TOO_MANY_ENTRIES';

export type GateCommandKind = 'OPEN';

export interface GateCommand {
  readonly id: string;
  readonly kind: GateCommandKind;
  readonly issuedAt: string;
}

export type GateCommandListResponse = readonly GateCommand[];
