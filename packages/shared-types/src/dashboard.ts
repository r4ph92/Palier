// Every mutating /v1/dashboard request carries this header; a cross-site form cannot set it.
export const DASHBOARD_CSRF_HEADER = 'x-requested-with';
export const DASHBOARD_CSRF_VALUE = 'palier-dashboard';

export type KycStatus = 'NOT_STARTED' | 'PENDING' | 'VERIFIED';

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

export type DashboardLotListResponse = readonly DashboardLot[];

export type DashboardTestUserListResponse = readonly DashboardUser[];

export interface DashboardTestSignInRequest {
  readonly userId: string;
}

export interface DashboardSignInResponse {
  readonly user: DashboardUser;
}

export type DashboardErrorCode =
  | 'UNAUTHORIZED'
  | 'CSRF_HEADER_MISSING'
  | 'LEGAL_NAME_INVALID'
  | 'OPERATOR_EXISTS'
  | 'NO_OPERATOR'
  | 'LOT_NOT_FOUND';

export interface DashboardErrorBody {
  readonly statusCode: number;
  readonly error: string;
  readonly message: string;
}
