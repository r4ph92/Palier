import type { Translations } from './fr';
import { LOT_NOT_IN_SERVICE, NOT_RESPONDING, TOO_MANY_ATTEMPTS } from './sharedEn';

const HOLD_FOR_FIFTEEN_MINUTES = 'Guarantee a spot for 15\u00A0min';
const GUARANTEED_UNTIL = 'Spot guaranteed until';

export const spotHoldEn: Translations['spotHold'] = {
  hold: HOLD_FOR_FIFTEEN_MINUTES,
  holding: 'Guaranteeing…',
  holdAccessibilityLabel: `${HOLD_FOR_FIFTEEN_MINUTES} at %{lotName}`,
  holdingAccessibilityLabel: 'Guaranteeing at %{lotName}',
  guaranteedUntilLead: GUARANTEED_UNTIL,
  guaranteedUntil: `${GUARANTEED_UNTIL} %{time}`,
  notResponding: NOT_RESPONDING,
  release: 'Release',
  releasing: 'Releasing…',
  releaseAccessibilityLabel: 'Release the guarantee at %{lotName}',
  releasingAccessibilityLabel: 'Releasing the guarantee at %{lotName}',
  releasePrompt: 'Release this guarantee?',
  releaseConfirm: 'Yes, release',
  releaseUnavailable: 'Can’t release the guarantee right now, try again in a moment',
  releaseCancel: 'Cancel',
  released: 'Guarantee released',
  minutesLeft: { one: '%{count} minute left', other: '%{count} minutes left' },
  bannerAccessibilityLabel: '%{guaranteedUntil}, %{lotName}, %{minutesLeft}',
  refusals: {
    PREREQUISITES_MISSING: 'Add a plate and a card before guaranteeing a spot',
    HOLD_ALREADY_EXISTS: 'You already have a guaranteed spot',
    HOLD_QUOTA_REACHED: 'Too many guaranteed spots in this lot right now',
    NO_SUITABLE_SPOT: 'No spot available',
    LOT_NOT_FOUND: 'This lot is no longer offered',
    LOT_NOT_IN_SERVICE,
    HOLD_UNAVAILABLE: 'Can’t guarantee a spot right now, try again in a moment',
    TOO_MANY_HOLD_ATTEMPTS: TOO_MANY_ATTEMPTS,
    HOLD_NOT_FOUND: 'This guarantee no longer exists',
    HOLD_EXPIRED: 'This guarantee has already expired',
  },
};
