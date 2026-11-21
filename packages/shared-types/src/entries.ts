import type { TariffPolicy } from './lotPricing.ts';

export interface EntryRequest {
  // What the entry terminal's QR holds: its link, or the bare token at the end of that link.
  readonly qrContent: string;
  // The tariff the driver saw and accepted (#151). Missing or not the lot's current one: TARIFF_CHANGED, nothing held or opened.
  readonly tariff?: TariffPolicy;
}

// Read before the barrier: what the driver accepts by tapping « Entrer » (#151).
export interface EntryQuoteRequest {
  readonly qrContent: string;
}

export interface EntryQuoteResponse {
  readonly lotName: string;
  readonly tariff: TariffPolicy;
  // What the card will hold until exit: the daily cap (Q19).
  readonly holdCents: number;
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

export const ENTRY_SESSION_STATES = ['CREATED', 'ENTRY_CONFIRMED', 'PARKED_PRESUMED', 'PARKED_UNCONFIRMED', 'PARKED_CONFIRMED', 'CANCELLED', 'CLOSED_PAID', 'CLOSED_CAPTURE_PENDING'] as const;

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

const WALKED_AWAY: readonly unknown[] = WALKED_AWAY_STATES;

export function isWalkedAwayState(candidate: unknown): candidate is WalkedAwayState {
  return WALKED_AWAY.includes(candidate);
}

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
  | 'GATE_SILENT'
  | 'OPERATOR_NOT_PAYABLE'
  | 'PREREQUISITES_MISSING'
  | 'LOT_FULL'
  | 'NO_SUITABLE_SPOT'
  | 'ALREADY_INSIDE'
  | 'CARD_DECLINED'
  | 'PAYMENTS_UNAVAILABLE'
  | 'TOO_MANY_ENTRIES'
  | 'TARIFF_CHANGED';

export interface EntryRefusalBody {
  readonly statusCode: number;
  readonly error: EntryRefusalCode;
  readonly message: string;
  // CARD_DECLINED only: the hold the card refused, so the app can name the amount.
  readonly authorizedCents?: number;
  // TARIFF_CHANGED only: the lot's current tariff, shown to the driver before she accepts it.
  readonly tariff?: TariffPolicy;
}

export type GateCommandKind = 'OPEN';

export interface GateCommand {
  readonly id: string;
  readonly kind: GateCommandKind;
  readonly issuedAt: string;
  // The gate's own count, in commit order: the console sends the last one it shows as afterSequence.
  readonly sequence: number;
}

export type GateCommandListResponse = readonly GateCommand[];
