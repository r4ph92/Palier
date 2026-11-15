import { frEquipment } from './frEquipment.ts';
import { frGateErrors } from './frGateErrors.ts';
import { frGates } from './frGates.ts';
import { frMap } from './frMap.ts';
import { frPublication, frPublicationErrors } from './frPublication.ts';
import { frSessionErrors, frSessions } from './frSessions.ts';
import { frSpotsToCheck } from './frSpotsToCheck.ts';

// The pages of a lot, gathered so the main dictionary stays short.
export const frPageTexts = {
  spotsToCheck: frSpotsToCheck,
  sessions: frSessions,
  map: frMap,
  equipment: frEquipment,
  gates: frGates,
  publication: frPublication,
};

// The refusals those pages show, beside the dictionary's own.
export const frPageErrors = { ...frSessionErrors, ...frGateErrors, ...frPublicationErrors };
