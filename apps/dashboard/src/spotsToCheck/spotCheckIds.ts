export const SPOT_CHECK_STATUS_ID = 'spot-check-status';

export function checkButtonId(spotId: string): string {
  return `spot-${spotId}-check`;
}

export function checkErrorId(spotId: string): string {
  return `spot-${spotId}-check-error`;
}
