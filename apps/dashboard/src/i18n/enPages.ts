import { enExits } from './enExits.ts';
import { enEquipment } from './enEquipment.ts';
import { enGateErrors } from './enGateErrors.ts';
import { enGates } from './enGates.ts';
import { enMap } from './enMap.ts';
import { enPublication, enPublicationErrors } from './enPublication.ts';
import { enSessionErrors, enSessions } from './enSessions.ts';
import { enStaleSessionErrors, enStaleSessions } from './enStaleSessions.ts';
import { enSpotsToCheck } from './enSpotsToCheck.ts';

// The pages of a lot, gathered so the main dictionary stays short.
export const enPageTexts = {
  spotsToCheck: enSpotsToCheck,
  sessions: enSessions,
  staleSessions: enStaleSessions,
  exits: enExits,
  map: enMap,
  equipment: enEquipment,
  gates: enGates,
  publication: enPublication,
};

export const enPageErrors = { ...enSessionErrors, ...enStaleSessionErrors, ...enGateErrors, ...enPublicationErrors };
