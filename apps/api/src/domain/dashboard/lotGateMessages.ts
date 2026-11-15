import { GATE_ENDPOINT_MAX_LENGTH, GATE_NAME_LENGTH, MAX_GATES_PER_LOT, type GateDraftErrorCode } from '@palier/shared-types/gateDraft';
import type { LotGateRefusal } from './LotGateRepository.ts';

export type LotGateReason = GateDraftErrorCode | LotGateRefusal;

export const LOT_GATE_MESSAGES: Readonly<Record<Exclude<LotGateReason, 'LOT_NOT_FOUND' | 'LOT_BUSY'>, string>> = {
  GATE_NOT_FOUND: 'No such gate.',
  GATE_NAME_REQUIRED: 'Enter the gate name.',
  GATE_NAME_INVALID: `The gate name must be ${GATE_NAME_LENGTH.minimum} to ${GATE_NAME_LENGTH.maximum} characters, with no invisible characters.`,
  GATE_NAME_TAKEN: 'This lot already has a gate with this name.',
  GATE_ENDPOINT_NOT_HTTPS: `The endpoint must be an https address of at most ${GATE_ENDPOINT_MAX_LENGTH} characters, with no user name or password.`,
  GATE_ENDPOINT_REQUIRED: 'The access-control API needs its https endpoint.',
  GATE_EXIT_ID_ON_ENTRY: 'Only an exit gate identifies vehicles.',
  GATE_EXIT_LIMIT: 'One exit gate per parking lot for now.',
  GATE_LIMIT_REACHED: `A lot has at most ${MAX_GATES_PER_LOT} gates.`,
};
