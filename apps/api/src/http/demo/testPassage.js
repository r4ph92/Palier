import { sendGateAction } from './gateAction.js';
import { messageForStatusOf } from './gateRefusals.js';

/** @typedef {import('@palier/shared-types').GateIdentity} GateIdentity */
/** @typedef {import('@palier/shared-types').GateTestPassageResponse} GateTestPassageResponse */
/** @typedef {import('./consoleText.js').TextKey} TextKey */
/** @typedef {Pick<import('./gateApi.js').GateApi, 'fetchIdentity' | 'postTestPassage'>} TestPassageApi */
/**
 * @typedef {{ kind: 'verified', identity: GateIdentity, verifiedAt: Date }
 *   | { kind: 'refused', identity: GateIdentity | null, messageKey: TextKey }} TestPassageOutcome
 */

export const testPassageMessageForStatus = messageForStatusOf({ 409: 'gateNotHeard' }, 'testPassageFailed');

/**
 * The controller's self-test: Palier marks the gate verified when its last heartbeat is recent enough. No vehicle is counted.
 * @param {{ deviceKey: string, identity: GateIdentity | null }} request
 * @param {TestPassageApi} api
 * @returns {Promise<TestPassageOutcome>}
 */
export async function sendTestPassage(request, api) {
  const send = (/** @type {string} */ gateId) => api.postTestPassage(request.deviceKey, gateId);
  const answer = await sendGateAction(request, { api, send, messageForStatus: testPassageMessageForStatus });
  if (answer.kind === 'refused') {
    return answer;
  }
  const { verifiedAt } = /** @type {GateTestPassageResponse} */ (answer.body);
  return { kind: 'verified', identity: answer.identity, verifiedAt: new Date(verifiedAt) };
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
