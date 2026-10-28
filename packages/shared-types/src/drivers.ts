export interface DriverProfile {
  readonly id: string;
  readonly firstName: string;
}

export interface TestDriver {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
}

export type TestDriverListResponse = readonly TestDriver[];

export interface SignInResponse {
  readonly token: string;
  readonly driver: DriverProfile;
}

export interface CurrentDriver extends DriverProfile {
  readonly acceptedNoticeVersion: string | null;
}

export interface NoticeAcceptance {
  readonly noticeVersion: string;
}
