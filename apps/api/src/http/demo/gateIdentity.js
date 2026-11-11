import { OK, UNREACHABLE } from './gateApi.js';

/** @typedef {import('@palier/shared-types').GateIdentity} GateIdentity */
/** @typedef {import('./consoleText.js').TextKey} TextKey */
/** @typedef {{ kind: 'refused', identity: null, messageKey: TextKey }} IdentityRefusal */

export const DEVICE_KEY_SHAPE = /^[A-Za-z0-9_-]{43}$/;

/** @type {Record<number, TextKey>} */
const MESSAGE_BY_STATUS = { [UNREACHABLE]: 'unreachable', 401: 'keyRefused', 403: 'gateForbidden', 409: 'gateWithoutLoops' };

/**
 * @param {number} status
 * @returns {TextKey}
 */
export function messageForStatus(status) {
  return MESSAGE_BY_STATUS[status] ?? 'passageFailed';
}

/**
 * The gate the key belongs to: the one already known, else the one Palier names. A key a header cannot carry is refused without a request.
 * @param {{ deviceKey: string, identity: GateIdentity | null }} request
 * @param {Pick<import('./gateApi.js').GateApi, 'fetchIdentity'>} api
 * @returns {Promise<GateIdentity | IdentityRefusal>}
 */
export async function knownGateIdentity(request, api) {
  if (!DEVICE_KEY_SHAPE.test(request.deviceKey)) {
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
