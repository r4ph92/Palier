import type { SpotHold } from '@palier/shared-types';

const MILLISECONDS_PER_SECOND = 1000;

// The time left is measured on the server's clock and then counted down by the device's, so a phone set a few
// minutes off still shows the right countdown.
export interface HeldSpot {
  readonly spotHold: SpotHold;
  readonly receivedAt: number;
  readonly millisecondsLeftAtReceipt: number;
  // True for a hold this driver just took, until the banner has moved VoiceOver to it once.
  readonly isFresh: boolean;
}

export function heldSpotFrom(spotHold: SpotHold, receivedAt: number, isFresh: boolean): HeldSpot {
  const millisecondsLeftAtReceipt = Date.parse(spotHold.expiresAt) - Date.parse(spotHold.now);
  return { spotHold, receivedAt, millisecondsLeftAtReceipt, isFresh };
}

export function secondsLeft(held: HeldSpot, deviceNow: number): number {
  const millisecondsLeft = held.millisecondsLeftAtReceipt - Math.max(0, deviceNow - held.receivedAt);
  return Math.max(0, Math.ceil(millisecondsLeft / MILLISECONDS_PER_SECOND));
}

export type HoldCountdown = { readonly kind: 'counting'; readonly secondsLeft: number } | { readonly kind: 'expired' };

export function holdCountdown(held: HeldSpot, deviceNow: number): HoldCountdown {
  const seconds = secondsLeft(held, deviceNow);
  return seconds === 0 ? { kind: 'expired' } : { kind: 'counting', secondsLeft: seconds };
}
