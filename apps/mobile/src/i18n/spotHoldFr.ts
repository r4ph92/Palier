import type { SpotHoldRefusalCode } from '@palier/shared-types';
import { LOT_NOT_IN_SERVICE, NOT_RESPONDING, TOO_MANY_ATTEMPTS } from './sharedFr';

// « 15 min » never breaks across two lines.
const HOLD_FOR_FIFTEEN_MINUTES = 'Garantir une place 15\u00A0min';
// The banner sets the time apart in mono; VoiceOver reads the whole sentence.
const GUARANTEED_UNTIL = 'Place garantie jusqu’à';

export const spotHoldFr = {
  hold: HOLD_FOR_FIFTEEN_MINUTES,
  holding: 'Garantie en cours…',
  holdAccessibilityLabel: `${HOLD_FOR_FIFTEEN_MINUTES} à %{lotName}`,
  holdingAccessibilityLabel: 'Garantie en cours à %{lotName}',
  guaranteedUntilLead: GUARANTEED_UNTIL,
  guaranteedUntil: `${GUARANTEED_UNTIL} %{time}`,
  notResponding: NOT_RESPONDING,
  release: 'Libérer',
  releasing: 'Libération…',
  releaseAccessibilityLabel: 'Libérer la garantie à %{lotName}',
  releasingAccessibilityLabel: 'Libération de la garantie à %{lotName}',
  releasePrompt: 'Libérer cette garantie?',
  releaseConfirm: 'Oui, libérer',
  releaseConfirmAccessibilityLabel: 'Oui, libérer la garantie à %{lotName}',
  releaseNotFound: 'Cette garantie n’existe plus, actualisez la liste',
  releaseUnavailable: 'Impossible de libérer la garantie pour le moment, réessayez dans un instant',
  releaseCancel: 'Annuler',
  released: 'Garantie libérée',
  expired: 'Votre place garantie a expiré',
  expiredAccessibilityLabel: '%{expired}, %{lotName}',
  minutesLeft: { one: '%{count} minute restante', other: '%{count} minutes restantes' },
  bannerAccessibilityLabel: '%{guaranteedUntil}, %{lotName}, %{minutesLeft}',
  refusals: {
    PREREQUISITES_MISSING: 'Ajoutez une plaque et une carte avant de garantir une place',
    HOLD_ALREADY_EXISTS: 'Vous avez déjà une place garantie',
    HOLD_QUOTA_REACHED: 'Trop de places garanties dans ce parking pour le moment',
    NO_SUITABLE_SPOT: 'Aucune place disponible',
    LOT_NOT_FOUND: 'Ce parking n’est plus offert',
    LOT_NOT_IN_SERVICE,
    HOLD_UNAVAILABLE: 'Impossible de garantir une place pour le moment, réessayez dans un instant',
    TOO_MANY_HOLD_ATTEMPTS: TOO_MANY_ATTEMPTS,
    HOLD_NOT_FOUND: 'Cette garantie n’existe plus',
    HOLD_EXPIRED: 'Cette garantie a déjà expiré',
  } satisfies Record<SpotHoldRefusalCode, string>,
};
