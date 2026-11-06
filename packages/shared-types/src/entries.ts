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

export const ENTRY_SESSION_STATES = ['CREATED', 'ENTRY_CONFIRMED', 'PARKED_PRESUMED', 'PARKED_UNCONFIRMED', 'PARKED_CONFIRMED', 'CANCELLED'] as const;

export type EntrySessionState = (typeof ENTRY_SESSION_STATES)[number];

// A driver has at most one session in these states: the one the app shows as current.
// PARKED_UNCONFIRMED: the driver walked away in another aisle and is asked where they parked; PARKED_CONFIRMED: they answered.
export const ACTIVE_ENTRY_SESSION_STATES = [
  'CREATED',
  'ENTRY_CONFIRMED',
  'PARKED_PRESUMED',
  'PARKED_UNCONFIRMED',
  'PARKED_CONFIRMED',
] as const satisfies readonly EntrySessionState[];

export type ActiveEntrySessionState = (typeof ACTIVE_ENTRY_SESSION_STATES)[number];

// The driver walked away from the car: the spot is presumed, asked about, or answered.
export const WALKED_AWAY_STATES = ['PARKED_PRESUMED', 'PARKED_UNCONFIRMED', 'PARKED_CONFIRMED'] as const satisfies readonly ActiveEntrySessionState[];

export type WalkedAwayState = (typeof WALKED_AWAY_STATES)[number];

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
  | 'NO_SUITABLE_SPOT'
  | 'ALREADY_INSIDE'
  | 'CARD_DECLINED'
  | 'PAYMENTS_UNAVAILABLE'
  | 'TOO_MANY_ENTRIES';

export interface EntryRefusalBody {
  readonly statusCode: number;
  readonly error: EntryRefusalCode;
  readonly message: string;
  // CARD_DECLINED only: the hold the card refused, so the app can name the amount.
  readonly authorizedCents?: number;
}

export type GateCommandKind = 'OPEN';

export interface GateCommand {
  readonly id: string;
  readonly kind: GateCommandKind;
  readonly issuedAt: string;
}

export type GateCommandListResponse = readonly GateCommand[];
