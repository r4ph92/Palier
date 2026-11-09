import type { ActiveEntrySessionState, AssignedSpot, WalkedAwayState } from './entries.ts';

// The driver's session in progress, priced by the API's clock: the app shows these figures as they are.
// spot is the one the driver said they parked in once they answered, the assigned one before.
export interface CurrentParkingSession {
  readonly sessionId: string;
  readonly state: ActiveEntrySessionState;
  readonly lotName: string;
  readonly spot: AssignedSpot;
  // When the driver scanned at the entry terminal; billing starts then.
  readonly enteredAt: string;
  readonly elapsedMinutes: number;
  readonly amountCents: number;
  readonly dailyCapCents: number;
  // The lot's beacon major, which the app monitors while the session lasts; null for a lot without beacons.
  readonly beaconMajor: number | null;
  readonly levelPlan: LevelPlan | null;
  // PARKED_UNCONFIRMED only: the driver walked away in another aisle, and is asked where they parked.
  readonly question: ParkedQuestion | null;
}

// The aisle the device last saw at the walk, with its free spots ordered by number: the likeliest answers come first.
export interface ParkedQuestion {
  readonly aisleCode: string;
  readonly freeSpotNumbers: readonly string[];
}

// D8: an aisle is drawn as a rectangle on its level's grid; the units mean nothing beyond their proportions.
export interface AisleRectangle {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

// rectangle is null for an aisle the operator has not drawn; its code and minor still guide the driver.
export interface PlanAisle {
  readonly code: string;
  readonly beaconMinor: number;
  readonly rectangle: AisleRectangle | null;
}

// The level of the assigned spot, with its aisles the driver can drive in (exit lanes left out), ordered by code.
export interface LevelPlan {
  readonly levelCode: string;
  readonly aisles: PlanAisle[];
}

export interface CurrentParkingSessionResponse {
  readonly session: CurrentParkingSession | null;
}

// Test environments only: the instant the API's clock reads.
export interface TestClockReading {
  readonly now: string;
}

export interface BackdateParkingSessionRequest {
  readonly enteredAt: string;
}

export interface ParkedPresumptionRequest {
  readonly detectedAt: string;
  // The beacon minor of the aisle the device last saw, when it knows one: another aisle than the spot's asks the driver where they parked.
  readonly detectedAisleMinor?: number;
}

// The same answer when an earlier signal already recorded the walk: state and parkedAt are then those of that first walk.
export interface ParkedPresumptionResponse {
  readonly state: WalkedAwayState;
  readonly parkedAt: string;
}

export type ParkedPresumptionRefusalCode = 'SESSION_NOT_FOUND' | 'ENTRY_NOT_CONFIRMED' | 'SESSION_CLOSED' | 'LOT_BUSY';

// The number the driver read on the ground, as typed: Palier normalizes « b3 » or « B – 3 » to « B-3 ».
export interface ParkedSpotAnswerRequest {
  readonly spotNumber: string;
}

// The same answer when the driver had already answered: spot is then the one first confirmed.
export interface ParkedSpotAnswerResponse {
  readonly state: 'PARKED_CONFIRMED';
  readonly spot: AssignedSpot;
}

export type ParkedSpotAnswerRefusalCode =
  | 'SESSION_NOT_FOUND'
  | 'NOT_ASKED'
  | 'SESSION_CLOSED'
  | 'UNKNOWN_SPOT'
  | 'SPOT_TAKEN'
  | 'SPOT_OUT_OF_SERVICE'
  | 'LOT_BUSY';

// The number of the spot the driver found taken, as the app showed it: a report naming a spot that is no longer theirs changes nothing.
export interface SpotTakenRequest {
  readonly spotNumber: string;
}

// none-free: the reported spot is flagged and the driver is asked where they parked, like a walk in another aisle.
export type SpotTakenResponse = { readonly outcome: 'reassigned'; readonly spot: AssignedSpot } | { readonly outcome: 'none-free' };

export type SpotTakenRefusalCode =
  | 'SESSION_NOT_FOUND'
  | 'ENTRY_NOT_CONFIRMED'
  | 'ALREADY_PARKED'
  | 'SESSION_CLOSED'
  | 'SPOT_NOT_ASSIGNED'
  | 'LOT_BUSY';

// What the driver paid on leaving, from the lot's pricing at entry: the figures behind "13 × 0,75 $".
export interface ExitReceipt {
  readonly exitedAt: string;
  readonly durationMinutes: number;
  readonly increments: number;
  readonly incrementCents: number;
  readonly totalCents: number;
  // The daily cap (or the card hold) held the total under increments × incrementCents.
  readonly capped: boolean;
}

// The same receipt when the exit was already done: the first tap's figures.
export interface ExitResponse {
  readonly receipt: ExitReceipt;
}

export type ExitRefusalCode =
  | 'SESSION_NOT_FOUND'
  | 'ENTRY_NOT_CONFIRMED'
  | 'SESSION_CLOSED'
  | 'GATE_UNAVAILABLE'
  | 'PAYMENTS_UNAVAILABLE'
  | 'LOT_BUSY';

// One line of the receipt history: a closed, paid session, newest exit first.
export interface ReceiptSummary {
  readonly sessionId: string;
  readonly lotName: string;
  readonly exitedAt: string;
  readonly durationMinutes: number;
  readonly totalCents: number;
}

export interface ReceiptListResponse {
  readonly receipts: ReceiptSummary[];
}

// The exit receipt with where and when the driver came in and which card paid; cardLast4 is null for a session opened before the card was recorded.
export interface ReceiptDetail extends ExitReceipt {
  readonly sessionId: string;
  readonly lotName: string;
  readonly enteredAt: string;
  readonly cardLast4: string | null;
}

export interface ReceiptDetailResponse {
  readonly receipt: ReceiptDetail;
}
