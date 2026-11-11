import { OK, UNREACHABLE } from './gateApi.js';
import { knownGateIdentity } from './gateIdentity.js';

/** @typedef {import('@palier/shared-types').GateIdentity} GateIdentity */
/** @typedef {import('@palier/shared-types').GateIdentifyResponse} GateIdentifyResponse */
/** @typedef {import('./consoleText.js').TextKey} TextKey */
/** @typedef {Pick<import('./gateApi.js').GateApi, 'fetchIdentity' | 'postIdentify'>} ReaderApi */
/**
 * @typedef {{ kind: 'opened' | 'fallback', identity: GateIdentity }
 *   | { kind: 'refused', identity: GateIdentity | null, messageKey: TextKey }} ReadOutcome
 */

/** @type {Record<number, TextKey>} */
const MESSAGE_BY_STATUS = {
  [UNREACHABLE]: 'unreachable',
  400: 'identifierInvalid',
  401: 'keyRefused',
  403: 'gateForbidden',
  409: 'gateWithoutReader',
};

/**
 * @param {number} status
 * @returns {TextKey}
 */
export function readerMessageForStatus(status) {
  return MESSAGE_BY_STATUS[status] ?? 'readerFailed';
}

/**
 * The plate or transponder the exit reader read, sent to the gate the key belongs to.
 * @param {{ deviceKey: string, identity: GateIdentity | null, identifier: string }} reading
 * @param {ReaderApi} api
 * @returns {Promise<ReadOutcome>}
 */
export async function sendReading(reading, api) {
  const identityOrRefusal = await knownGateIdentity(reading, api);
  if ('messageKey' in identityOrRefusal) {
    return identityOrRefusal;
  }
  const response = await api.postIdentify(reading.deviceKey, identityOrRefusal.id, reading.identifier);
  if (response.status !== OK || response.body === null) {
    return { kind: 'refused', identity: identityOrRefusal, messageKey: readerMessageForStatus(response.status) };
  }
  const { outcome } = /** @type {GateIdentifyResponse} */ (response.body);
  return { kind: outcome === 'opened' ? 'opened' : 'fallback', identity: identityOrRefusal };
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
