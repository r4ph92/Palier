import { isValidDisplayText } from './displayText.ts';
import type { GateHealth, GateKind } from './gates.ts';
import type { LotPricingSettings } from './lotPricing.ts';
import type { AisleRectangle } from './parkingSessions.ts';
import type { SpotState } from './spotStates.ts';

// Every mutating /v1/dashboard request carries this header; a cross-site form cannot set it.
export const DASHBOARD_CSRF_HEADER = 'x-requested-with';
export const DASHBOARD_CSRF_VALUE = 'palier-dashboard';

export const LEGAL_NAME_LENGTH = { minimum: 2, maximum: 120 } as const;

// Counted in code points after trimming, with no invisible character: see isValidDisplayText.
export function isValidLegalName(legalName: string): boolean {
  return isValidDisplayText(legalName, LEGAL_NAME_LENGTH);
}

export type KycStatus = 'NOT_STARTED' | 'PENDING' | 'ACTION_REQUIRED' | 'VERIFIED';

export interface DashboardUser {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
}

export interface DashboardOperator {
  readonly id: string;
  readonly legalName: string;
  readonly kycStatus: KycStatus;
}

export interface StripeOnboardingLink {
  readonly url: string;
}

export interface DashboardMeResponse {
  readonly user: DashboardUser;
  readonly operator: DashboardOperator | null;
}

export interface CreateOperatorRequest {
  readonly legalName: string;
}

export interface DashboardLot {
  readonly id: string;
  readonly name: string;
  readonly isOnline: boolean;
}

// Coordinates are null only for a lot made before #64; beaconMajor is null only for a lot inserted without one before #64, and past 65 535 the insert fails (decision 032).
export interface DashboardLotDetails extends DashboardLot {
  readonly address: string;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly capacity: number;
  readonly beaconMajor: number | null;
  readonly pricing: LotPricingSettings | null;
}

export interface LevelSpotCounts {
  readonly code: string;
  readonly counts: Readonly<Record<SpotState, number>>;
}

// SPOTS_TO_CHECK: the counter is above the places taken, and the difference needs a physical check. COUNTER_BELOW: the counter is under them.
export interface CounterGap {
  readonly kind: 'SPOTS_TO_CHECK' | 'COUNTER_BELOW';
  readonly spots: number;
}

export interface DashboardLotOccupancy {
  readonly lotId: string;
  readonly lotName: string;
  readonly vehicleCount: number;
  readonly levels: readonly LevelSpotCounts[];
  readonly occupiedOrAssignedCount: number;
  readonly counterGap: CounterGap;
  // Gates silent for more than 2 minutes, named in the warning above the figures.
  readonly silentGateNames: readonly string[];
}

// rectangle is null for the exit lane, which is not drawn, and for an aisle whose stored shape the read boundary refuses.
export interface DashboardMapAisle {
  readonly id: string;
  readonly code: string;
  readonly beaconMinor: number;
  readonly isExitLane: boolean;
  readonly rectangle: AisleRectangle | null;
}

// Levels come in display order, which is also the order spots are handed out in; aisles by code, the exit lane last.
export interface DashboardMapLevel {
  readonly id: string;
  readonly code: string;
  readonly displayOrder: number;
  readonly aisles: readonly DashboardMapAisle[];
}

// What an operator needs to program the lot's beacons: the platform UUID, the lot's major and each aisle's minor.
export interface DashboardLotMap {
  readonly lotId: string;
  readonly lotName: string;
  readonly platformUuid: string;
  readonly beaconMajor: number | null;
  readonly levels: readonly DashboardMapLevel[];
}

export interface DashboardGateHealth {
  readonly id: string;
  readonly name: string;
  readonly kind: GateKind;
  readonly health: GateHealth;
  readonly lastHeartbeatAt: string | null;
}

// now is the server's clock, so the page tells today from another day as the server judged the gates.
export interface DashboardLotEquipment {
  readonly lotId: string;
  readonly lotName: string;
  readonly now: string;
  readonly gates: readonly DashboardGateHealth[];
}

// Every level of the lot, each once, in the new order; fromLevelIds is the order the page showed when the operator moved a level.
export interface LevelOrderRequest {
  readonly levelIds: readonly string[];
  readonly fromLevelIds: readonly string[];
}

export type DashboardLotListResponse = readonly DashboardLot[];

export type DashboardTestUserListResponse = readonly DashboardUser[];

export interface DashboardTestSignInRequest {
  readonly userId: string;
}

export interface DashboardSignInResponse {
  readonly user: DashboardUser;
}

// The one list of codes: the type derives from it, and the dashboard checks an answer's code against it.
export const DASHBOARD_ERROR_CODES = [
  'UNAUTHORIZED',
  'CSRF_HEADER_MISSING',
  'LEGAL_NAME_INVALID',
  'OPERATOR_EXISTS',
  'NO_OPERATOR',
  'LOT_NOT_FOUND',
  'OPERATOR_NOT_FOUND',
  'STRIPE_UNAVAILABLE',
  'LOT_NAME_REQUIRED',
  'LOT_NAME_INVALID',
  'LOT_ADDRESS_REQUIRED',
  'LOT_ADDRESS_INVALID',
  'LOT_LATITUDE_INVALID',
  'LOT_LONGITUDE_INVALID',
  'LOT_CAPACITY_INVALID',
  'PRICING_INCREMENT_CENTS_INVALID',
  'PRICING_INCREMENT_MINUTES_INVALID',
  'PRICING_DAILY_CAP_REQUIRED',
  'PRICING_DAILY_CAP_INVALID',
  'PRICING_DAILY_CAP_BELOW_INCREMENT',
  'PRICING_HOLD_QUOTA_INVALID',
  'TOO_MANY_LOTS',
  'LOT_BUSY',
  'LEVEL_CODE_INVALID',
  'LEVEL_CODE_TAKEN',
  'LEVEL_LIMIT_REACHED',
  'LEVEL_ORDER_INVALID',
  'LEVEL_NOT_FOUND',
  'AISLE_CODE_INVALID',
  'AISLE_CODE_TAKEN',
  'AISLE_CODE_RESERVED',
  'AISLE_MINOR_INVALID',
  'AISLE_MINOR_TAKEN',
  'AISLE_RECTANGLE_INVALID',
  'AISLE_NOT_FOUND',
  'BATTERY_PERCENT_INVALID',
] as const;

export type DashboardErrorCode = (typeof DASHBOARD_ERROR_CODES)[number];

export interface DashboardErrorBody {
  readonly statusCode: number;
  readonly error: string;
  readonly message: string;
}
