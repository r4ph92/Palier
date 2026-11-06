import type { AssignedSpot, PlanAisle } from '@palier/shared-types';
import { i18n } from '../i18n/i18n';

export function aisleSentence(spot: AssignedSpot, currentAisle: PlanAisle): string {
  if (currentAisle.code === spot.aisleCode) {
    return i18n.t('session.plan.rightAisle');
  }
  return i18n.t('session.plan.wrongAisle', { current: currentAisle.code, assigned: spot.aisleCode });
}

// What VoiceOver reads for the drawing itself, naming only what is drawn; the guidance sentence is read once, as text, beside it.
export function planImageLabel(spot: AssignedSpot, currentAisle: PlanAisle | null, drawnAisleCodes: readonly string[]): string {
  const level = i18n.t('session.plan.imageLabel', { level: spot.levelCode });
  const assigned = drawnAisleCodes.includes(spot.aisleCode) ? i18n.t('session.plan.imageAssigned', { aisle: spot.aisleCode, spot: spot.number }) : '';
  const isCurrentDrawn = currentAisle !== null && drawnAisleCodes.includes(currentAisle.code);
  const here = isCurrentDrawn ? i18n.t('session.plan.imageHere', { aisle: currentAisle.code }) : '';
  return `${level}${assigned}${here}`;
}
