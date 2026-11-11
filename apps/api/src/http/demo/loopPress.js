import { OK } from './gateApi.js';
import { knownGateIdentity, messageForStatus } from './gateIdentity.js';

/** @typedef {import('@palier/shared-types').GateIdentity} GateIdentity */
/** @typedef {import('@palier/shared-types').GateKind} GateKind */
/** @typedef {import('@palier/shared-types').GatePassageResponse} GatePassageResponse */
/** @typedef {Pick<import('./gateApi.js').GateApi, 'fetchIdentity' | 'postPassage'>} PassageApi */
/** @typedef {import('./consoleText.js').TextKey} TextKey */
/**
 * @typedef {object} LoopPress
 * @property {GateKind} loop
 * @property {string} deviceKey
 * @property {GateIdentity | null} identity
 * @property {Date} pressedAt
 */
/** @typedef {{ kind: 'refused', identity: GateIdentity | null, messageKey: TextKey }} RefusedOutcome */
/**
 * @typedef {{ kind: 'recorded', identity: GateIdentity, passage: GatePassageResponse }
 *   | RefusedOutcome
 *   | { kind: 'wrongLoop', identity: GateIdentity }} PressOutcome
 */

/**
 * @param {GateKind} loop
 * @param {{ deviceKey: string, identity: GateIdentity | null }} state
 * @returns {boolean}
 */
export function isLoopEnabled(loop, state) {
  if (state.deviceKey === '') {
    return false;
  }
  return state.identity === null || state.identity.kind === loop;
}

/**
 * @param {LoopPress} press
 * @param {PassageApi} api
 * @returns {Promise<PressOutcome>}
 */
export async function pressLoop(press, api) {
  const identityOrRefusal = await knownGateIdentity(press, api);
  if ('messageKey' in identityOrRefusal) {
    return identityOrRefusal;
  }
  const identity = identityOrRefusal;
  if (identity.kind !== press.loop) {
    return { kind: 'wrongLoop', identity };
  }
  const response = await api.postPassage(press.deviceKey, identity.id, press.pressedAt.toISOString());
  if (response.status !== OK || response.body === null) {
    return { kind: 'refused', identity, messageKey: passageRefusal(response.status) };
  }
  return { kind: 'recorded', identity, passage: /** @type {GatePassageResponse} */ (response.body) };
}

/**
 * @param {number} status
 * @returns {TextKey}
 */
function passageRefusal(status) {
  return status === OK ? 'passageUnconfirmed' : messageForStatus(status);
}
