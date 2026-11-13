import { isValidDisplayText } from './displayText.ts';
import type { LotPricingSettings } from './lotPricing.ts';

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
  'LOT_NAME_INVALID',
  'LOT_ADDRESS_INVALID',
  'LOT_COORDINATES_INVALID',
  'LOT_CAPACITY_INVALID',
  'PRICING_INCREMENT_CENTS_INVALID',
  'PRICING_INCREMENT_MINUTES_INVALID',
  'PRICING_DAILY_CAP_REQUIRED',
  'PRICING_DAILY_CAP_INVALID',
  'PRICING_DAILY_CAP_BELOW_INCREMENT',
  'PRICING_HOLD_QUOTA_INVALID',
  'TOO_MANY_LOTS',
] as const;

export type DashboardErrorCode = (typeof DASHBOARD_ERROR_CODES)[number];

export interface DashboardErrorBody {
  readonly statusCode: number;
  readonly error: string;
  readonly message: string;
}
