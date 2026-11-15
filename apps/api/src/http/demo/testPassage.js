import { OK, UNREACHABLE } from './gateApi.js';
import { knownGateIdentity } from './gateIdentity.js';

/** @typedef {import('@palier/shared-types').GateIdentity} GateIdentity */
/** @typedef {import('@palier/shared-types').GateTestPassageResponse} GateTestPassageResponse */
/** @typedef {import('./consoleText.js').TextKey} TextKey */
/** @typedef {Pick<import('./gateApi.js').GateApi, 'fetchIdentity' | 'postTestPassage'>} TestPassageApi */
/**
 * @typedef {{ kind: 'verified', identity: GateIdentity, verifiedAt: Date }
 *   | { kind: 'refused', identity: GateIdentity | null, messageKey: TextKey }} TestPassageOutcome
 */

/** @type {Record<number, TextKey>} */
const MESSAGE_BY_STATUS = { [UNREACHABLE]: 'unreachable', 401: 'keyRefused', 403: 'gateForbidden', 409: 'gateNotHeard' };

/**
 * @param {number} status
 * @returns {TextKey}
 */
export function testPassageMessageForStatus(status) {
  return MESSAGE_BY_STATUS[status] ?? 'testPassageFailed';
}

/**
 * The controller's self-test: Palier marks the gate verified when it was heard in the last two minutes. No vehicle is counted.
 * @param {{ deviceKey: string, identity: GateIdentity | null }} request
 * @param {TestPassageApi} api
 * @returns {Promise<TestPassageOutcome>}
 */
export async function sendTestPassage(request, api) {
  const identityOrRefusal = await knownGateIdentity(request, api);
  if ('messageKey' in identityOrRefusal) {
    return identityOrRefusal;
  }
  const response = await api.postTestPassage(request.deviceKey, identityOrRefusal.id);
  if (response.status !== OK || response.body === null) {
    return { kind: 'refused', identity: identityOrRefusal, messageKey: testPassageMessageForStatus(response.status) };
  }
  const { verifiedAt } = /** @type {GateTestPassageResponse} */ (response.body);
  return { kind: 'verified', identity: identityOrRefusal, verifiedAt: new Date(verifiedAt) };
}

/**
 * Offline, the controller cannot reach Palier, so there is nothing to test.
 * @param {{ deviceKey: string, isOffline: boolean }} state
 * @returns {boolean}
 */
export function isTestPassageEnabled(state) {
  return !state.isOffline && state.deviceKey !== '';
}

/**
 * @param {TestPassageOutcome} outcome
 * @returns {import('./consoleText.js').ConsoleMessage}
 */
export function testPassageMessage(outcome) {
  if (outcome.kind === 'refused') {
    return { key: outcome.messageKey, isError: true };
  }
  return { verifiedAt: outcome.verifiedAt, isError: false };
}
