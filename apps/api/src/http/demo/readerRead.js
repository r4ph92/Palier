import { UNREACHABLE } from './gateApi.js';
import { DEVICE_KEY_SHAPE, identify } from './loopPress.js';

/** @typedef {import('@palier/shared-types').GateIdentity} GateIdentity */
/** @typedef {import('@palier/shared-types').GateIdentifyResponse} GateIdentifyResponse */
/** @typedef {import('./consoleText.js').TextKey} TextKey */
/** @typedef {Pick<import('./gateApi.js').GateApi, 'fetchIdentity' | 'postIdentify'>} ReaderApi */
/**
 * @typedef {{ kind: 'opened' | 'fallback', identity: GateIdentity }
 *   | { kind: 'refused', identity: GateIdentity | null, messageKey: TextKey }} ReadOutcome
 */

const OK = 200;

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
  if (!DEVICE_KEY_SHAPE.test(reading.deviceKey)) {
    return { kind: 'refused', identity: null, messageKey: 'keyRefused' };
  }
  const identityOrRefusal = reading.identity ?? (await identify(reading.deviceKey, api));
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
 * @param {{ deviceKey: string, identity: GateIdentity | null }} state
 * @returns {boolean}
 */
export function isReaderEnabled(state) {
  return state.deviceKey !== '' && (state.identity === null || state.identity.kind === 'EXIT');
}
