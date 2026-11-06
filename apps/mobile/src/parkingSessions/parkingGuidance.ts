import type { AssignedSpot, PlanAisle } from '@palier/shared-types';
import { i18n } from '../i18n/i18n';

// Once an aisle is seen: whether the driver is in the right one.
export function aisleSentence(spot: AssignedSpot, currentAisle: PlanAisle): string {
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
