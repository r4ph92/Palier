import { sendGateAction } from './gateAction.js';
import { messageForStatusOf } from './gateRefusals.js';

/** @typedef {import('@palier/shared-types').GateIdentity} GateIdentity */
/** @typedef {import('@palier/shared-types').GateIdentifyResponse} GateIdentifyResponse */
/** @typedef {import('./consoleText.js').TextKey} TextKey */
/** @typedef {Pick<import('./gateApi.js').GateApi, 'fetchIdentity' | 'postIdentify'>} ReaderApi */
/**
 * @typedef {{ kind: 'opened' | 'fallback', identity: GateIdentity }
 *   | { kind: 'refused', identity: GateIdentity | null, messageKey: TextKey }} ReadOutcome
 */

export const readerMessageForStatus = messageForStatusOf({ 400: 'identifierInvalid', 409: 'gateWithoutReader' }, 'readerFailed');

/**
 * The plate or transponder the exit reader read, sent to the gate the key belongs to.
 * @param {{ deviceKey: string, identity: GateIdentity | null, identifier: string }} reading
 * @param {ReaderApi} api
 * @returns {Promise<ReadOutcome>}
 */
export async function sendReading(reading, api) {
  const send = (/** @type {string} */ gateId) => api.postIdentify(reading.deviceKey, gateId, reading.identifier);
  const answer = await sendGateAction(reading, { api, send, messageForStatus: readerMessageForStatus });
  if (answer.kind === 'refused') {
    return answer;
  }
  const { outcome } = /** @type {GateIdentifyResponse} */ (answer.body);
  return { kind: outcome === 'opened' ? 'opened' : 'fallback', identity: answer.identity };
}

/**
 * @param {{ deviceKey: string, identity: GateIdentity | null, isOffline: boolean }} state
 * @returns {boolean}
 */
export function isReaderEnabled(state) {
  return !state.isOffline && state.deviceKey !== '' && (state.identity === null || state.identity.kind === 'EXIT');
}

/**
 * @param {ReadOutcome} outcome
 * @returns {import('./consoleText.js').ConsoleMessage}
 */
export function readingMessage(outcome) {
  if (outcome.kind === 'refused') {
    return { key: outcome.messageKey, isError: true };
  }
  return outcome.kind === 'opened' ? { key: 'readerOpened', isError: false } : { key: 'readerFallback', isError: true };
}
