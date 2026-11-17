import { frEquipment } from './frEquipment.ts';
import { frGateErrors } from './frGateErrors.ts';
import { frGates } from './frGates.ts';
import { frMap } from './frMap.ts';
import { frPublication, frPublicationErrors } from './frPublication.ts';
import { frSessionErrors, frSessions } from './frSessions.ts';
import { frStaleSessionErrors, frStaleSessions } from './frStaleSessions.ts';
import { frSpotsToCheck } from './frSpotsToCheck.ts';

// The pages of a lot, gathered so the main dictionary stays short.
export const frPageTexts = {
  spotsToCheck: frSpotsToCheck,
  sessions: frSessions,
  staleSessions: frStaleSessions,
  map: frMap,
  equipment: frEquipment,
  gates: frGates,
  publication: frPublication,
};

export const frPageErrors = { ...frSessionErrors, ...frStaleSessionErrors, ...frGateErrors, ...frPublicationErrors };
