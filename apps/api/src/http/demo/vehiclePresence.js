import { sendGateAction } from './gateAction.js';
import { messageForStatusOf } from './gateRefusals.js';

/** @typedef {import('@palier/shared-types').GateIdentity} GateIdentity */
/** @typedef {import('@palier/shared-types').GatePresenceResponse} GatePresenceResponse */
/** @typedef {import('./consoleText.js').TextKey} TextKey */
/** @typedef {Pick<import('./gateApi.js').GateApi, 'fetchIdentity' | 'postPresence'>} PresenceApi */
/**
 * @typedef {{ kind: GatePresenceResponse['outcome'], identity: GateIdentity }
 *   | { kind: 'refused', identity: GateIdentity | null, messageKey: TextKey }} PresenceOutcome
 */

export const presenceMessageForStatus = messageForStatusOf({ 409: 'gateNotExit' }, 'presenceFailed');

/** @type {Record<GatePresenceResponse['outcome'], TextKey>} */
const PRESENCE_MESSAGES = { waiting: 'presenceWaiting', opened: 'presenceOpened', fallback: 'presenceFallback' };

/**
 * A vehicle is on the exit gate's arming loop: Palier opens when exactly one app reported the exit beacon in the last minute.
 * @param {{ deviceKey: string, identity: GateIdentity | null }} presence
 * @param {PresenceApi} api
 * @returns {Promise<PresenceOutcome>}
 */
export async function sendPresence(presence, api) {
  const send = (/** @type {string} */ gateId) => api.postPresence(presence.deviceKey, gateId);
  const answer = await sendGateAction(presence, { api, send, messageForStatus: presenceMessageForStatus });
  if (answer.kind === 'refused') {
    return answer;
  }
  return { kind: /** @type {GatePresenceResponse} */ (answer.body).outcome, identity: answer.identity };
}

/**
 * @param {{ deviceKey: string, identity: GateIdentity | null, isOffline: boolean }} state
 * @returns {boolean}
 */
export function isPresenceEnabled(state) {
  return !state.isOffline && state.deviceKey !== '' && (state.identity === null || state.identity.kind === 'EXIT');
}

/**
 * @param {PresenceOutcome} outcome
 * @returns {import('./consoleText.js').ConsoleMessage}
 */
export function presenceMessage(outcome) {
  if (outcome.kind === 'refused') {
    return { key: outcome.messageKey, isError: true };
  }
  return { key: PRESENCE_MESSAGES[outcome.kind], isError: outcome.kind === 'fallback' };
}
