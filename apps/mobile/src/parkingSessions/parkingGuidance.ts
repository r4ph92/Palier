import type { AssignedSpot, PlanAisle } from '@palier/shared-types';
import { WORD_JOINER } from '../components/SpotLine';
import { i18n } from '../i18n/i18n';

// The sentence under the spot: where to go until an aisle is seen, then whether the driver is in the right one.
export function guidanceSentence(spot: AssignedSpot, currentAisle: PlanAisle | null): string {
  if (currentAisle === null) {
    return i18n.t('session.plan.goTo', { aisle: spot.aisleCode, spot: unbrokenSpotNumber(spot) });
  }
  if (currentAisle.code === spot.aisleCode) {
    return i18n.t('session.plan.rightAisle');
  }
  return i18n.t('session.plan.wrongAisle', { current: currentAisle.code, assigned: spot.aisleCode });
}

// What VoiceOver reads for the drawing itself; the guidance sentence is read once, as text, beside it.
export function planImageLabel(spot: AssignedSpot, currentAisle: PlanAisle | null): string {
  const drawing = i18n.t('session.plan.imageLabel', { level: spot.levelCode, aisle: spot.aisleCode, spot: spot.number });
  return currentAisle === null ? drawing : `${drawing}${i18n.t('session.plan.imageHere', { aisle: currentAisle.code })}`;
}

export function unbrokenSpotNumber(spot: AssignedSpot): string {
  return spot.number.replaceAll('-', `-${WORD_JOINER}`);
}
