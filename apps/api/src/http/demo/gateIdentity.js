import { OK } from './gateApi.js';
import { messageForStatusOf } from './gateRefusals.js';

/** @typedef {import('@palier/shared-types').GateIdentity} GateIdentity */
/** @typedef {import('./consoleText.js').TextKey} TextKey */
/** @typedef {{ kind: 'refused', identity: null, messageKey: TextKey }} IdentityRefusal */

const HEADER_SAFE_CHARACTERS = /^[\x21-\x7E]+$/;
const LONGEST_SENDABLE_DEVICE_KEY = 512;

/**
 * Whether a header can carry the key; Palier alone decides if it is a real one, so a wrong key is answered 401 like any other.
 * @param {string} deviceKey
 * @returns {boolean}
 */
export function isSendableDeviceKey(deviceKey) {
  return deviceKey.length <= LONGEST_SENDABLE_DEVICE_KEY && HEADER_SAFE_CHARACTERS.test(deviceKey);
}

export const messageForStatus = messageForStatusOf({ 409: 'gateWithoutLoops' }, 'passageFailed');

/**
 * The gate the key belongs to: the one already known, else the one Palier names. A key a header cannot carry is refused without a request.
 * @param {{ deviceKey: string, identity: GateIdentity | null }} request
 * @param {Pick<import('./gateApi.js').GateApi, 'fetchIdentity'>} api
 * @returns {Promise<GateIdentity | IdentityRefusal>}
 */
export async function knownGateIdentity(request, api) {
  if (!isSendableDeviceKey(request.deviceKey)) {
    return { kind: 'refused', identity: null, messageKey: 'keyRefused' };
  }
  if (request.identity !== null) {
    return request.identity;
  }
  const response = await api.fetchIdentity(request.deviceKey);
  if (response.status !== OK || response.body === null) {
    return { kind: 'refused', identity: null, messageKey: messageForStatus(response.status) };
  }
  return /** @type {GateIdentity} */ (response.body);
}
