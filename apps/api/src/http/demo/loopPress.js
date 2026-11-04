import { UNREACHABLE } from './gateApi.js';

/** @typedef {import('@palier/shared-types').GateIdentity} GateIdentity */
/** @typedef {import('@palier/shared-types').GateKind} GateKind */
/** @typedef {import('@palier/shared-types').GatePassageResponse} GatePassageResponse */
/** @typedef {import('./gateApi.js').GateApi} GateApi */
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

const OK = 200;
const DEVICE_KEY_SHAPE = /^[A-Za-z0-9_-]{43}$/;

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
 * @param {GateApi} api
 * @returns {Promise<PressOutcome>}
 */
export async function pressLoop(press, api) {
  if (!DEVICE_KEY_SHAPE.test(press.deviceKey)) {
    return { kind: 'refused', identity: null, messageKey: 'keyRefused' };
  }
  const identityOrRefusal = press.identity ?? (await identify(press.deviceKey, api));
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

/**
 * @param {string} deviceKey
 * @param {GateApi} api
 * @returns {Promise<GateIdentity | RefusedOutcome>}
 */
async function identify(deviceKey, api) {
  const response = await api.fetchIdentity(deviceKey);
  if (response.status !== OK || response.body === null) {
    return { kind: 'refused', identity: null, messageKey: messageForStatus(response.status) };
  }
  return /** @type {GateIdentity} */ (response.body);
}
