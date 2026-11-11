import { UNREACHABLE } from './gateApi.js';
import { DEVICE_KEY_SHAPE, identify } from './loopPress.js';

/** @typedef {import('@palier/shared-types').GateIdentity} GateIdentity */
/** @typedef {import('@palier/shared-types').GatePresenceResponse} GatePresenceResponse */
/** @typedef {import('./consoleText.js').TextKey} TextKey */
/** @typedef {Pick<import('./gateApi.js').GateApi, 'fetchIdentity' | 'postPresence'>} PresenceApi */
/**
 * @typedef {{ kind: GatePresenceResponse['outcome'], identity: GateIdentity }
 *   | { kind: 'refused', identity: GateIdentity | null, messageKey: TextKey }} PresenceOutcome
 */

const OK = 200;

/** @type {Record<number, TextKey>} */
const MESSAGE_BY_STATUS = { [UNREACHABLE]: 'unreachable', 401: 'keyRefused', 403: 'gateForbidden', 409: 'gateNotExit' };

/**
 * @param {number} status
 * @returns {TextKey}
 */
export function presenceMessageForStatus(status) {
  return MESSAGE_BY_STATUS[status] ?? 'presenceFailed';
}

/**
 * A vehicle is on the exit gate's arming loop: Palier opens when exactly one app reported the exit beacon in the last minute.
 * @param {{ deviceKey: string, identity: GateIdentity | null }} presence
 * @param {PresenceApi} api
 * @returns {Promise<PresenceOutcome>}
 */
export async function sendPresence(presence, api) {
  if (!DEVICE_KEY_SHAPE.test(presence.deviceKey)) {
    return { kind: 'refused', identity: null, messageKey: 'keyRefused' };
  }
  const identityOrRefusal = presence.identity ?? (await identify(presence.deviceKey, api));
  if ('messageKey' in identityOrRefusal) {
    return identityOrRefusal;
  }
  const response = await api.postPresence(presence.deviceKey, identityOrRefusal.id);
  if (response.status !== OK || response.body === null) {
    return { kind: 'refused', identity: identityOrRefusal, messageKey: presenceMessageForStatus(response.status) };
  }
  return { kind: /** @type {GatePresenceResponse} */ (response.body).outcome, identity: identityOrRefusal };
}

/**
 * @param {{ deviceKey: string, identity: GateIdentity | null }} state
 * @returns {boolean}
 */
export function isPresenceEnabled(state) {
  return state.deviceKey !== '' && (state.identity === null || state.identity.kind === 'EXIT');
}
