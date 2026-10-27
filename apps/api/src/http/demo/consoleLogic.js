import { translations } from './consoleTranslations.js';

/** @typedef {import('@palier/shared-types').GateIdentity} GateIdentity */
/** @typedef {import('@palier/shared-types').GateKind} GateKind */
/** @typedef {import('@palier/shared-types').GatePassageResponse} GatePassageResponse */
/** @typedef {keyof typeof translations} Language */
/** @typedef {keyof typeof translations.fr} TextKey */
/** @typedef {{ status: number, body: unknown }} ApiResponse */
/**
 * @typedef {object} GateApi
 * @property {(deviceKey: string) => Promise<ApiResponse>} fetchIdentity
 * @property {(deviceKey: string, gateId: string, closedAt: string) => Promise<ApiResponse>} postPassage
 */
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

export { translations };

const OK = 200;
const HOURS_PER_HALF_DAY = 12;
const NO_BREAK_SPACE = ' ';

/** @type {Record<number, TextKey>} */
const MESSAGE_BY_STATUS = { 0: 'unreachable', 401: 'keyRefused', 403: 'gateForbidden', 409: 'gateWithoutLoops' };

/**
 * @param {Language} language
 * @param {TextKey} key
 * @param {Record<string, string | number>} [values]
 * @returns {string}
 */
export function translate(language, key, values = {}) {
  return translations[language][key].replace(/\{(\w+)\}/g, (placeholder, name) => String(values[name] ?? placeholder));
}

/**
 * @param {number} status
 * @returns {TextKey}
 */
export function messageForStatus(status) {
  return MESSAGE_BY_STATUS[status] ?? 'passageFailed';
}

/**
 * @param {Date} moment
 * @param {Language} language
 * @returns {string}
 */
export function formatPassageTime(moment, language) {
  const minutes = String(moment.getMinutes()).padStart(2, '0');
  if (language === 'fr') {
    return `${moment.getHours()}${NO_BREAK_SPACE}h${NO_BREAK_SPACE}${minutes}`;
  }
  const period = moment.getHours() < HOURS_PER_HALF_DAY ? 'AM' : 'PM';
  const hour = moment.getHours() % HOURS_PER_HALF_DAY === 0 ? HOURS_PER_HALF_DAY : moment.getHours() % HOURS_PER_HALF_DAY;
  return `${hour}:${minutes}${NO_BREAK_SPACE}${period}`;
}

/**
 * @param {number} count
 * @param {Language} language
 * @returns {string}
 */
export function vehiclesInside(count, language) {
  const isSingular = language === 'fr' ? count <= 1 : count === 1;
  return translate(language, isSingular ? 'vehiclesInsideOne' : 'vehiclesInsideOther', { count });
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
  const identityOrRefusal = press.identity ?? (await identify(press.deviceKey, api));
  if ('messageKey' in identityOrRefusal) {
    return identityOrRefusal;
  }
  const identity = identityOrRefusal;
  if (identity.kind !== press.loop) {
    return { kind: 'wrongLoop', identity };
  }
  const response = await api.postPassage(press.deviceKey, identity.id, press.pressedAt.toISOString());
  if (response.status !== OK) {
    return { kind: 'refused', identity, messageKey: messageForStatus(response.status) };
  }
  return { kind: 'recorded', identity, passage: /** @type {GatePassageResponse} */ (response.body) };
}

/**
 * @param {string} deviceKey
 * @param {GateApi} api
 * @returns {Promise<GateIdentity | RefusedOutcome>}
 */
async function identify(deviceKey, api) {
  const response = await api.fetchIdentity(deviceKey);
  if (response.status !== OK) {
    return { kind: 'refused', identity: null, messageKey: messageForStatus(response.status) };
  }
  return /** @type {GateIdentity} */ (response.body);
}

/**
 * @param {typeof fetch} fetchFunction
 * @returns {GateApi}
 */
export function createGateApi(fetchFunction) {
  return {
    fetchIdentity: (deviceKey) => request(fetchFunction, '/v1/gates/me', { headers: authorization(deviceKey) }),
    postPassage: (deviceKey, gateId, closedAt) =>
      request(fetchFunction, `/v1/gates/${encodeURIComponent(gateId)}/passage`, {
        method: 'POST',
        headers: { ...authorization(deviceKey), 'content-type': 'application/json' },
        body: JSON.stringify({ closedAt }),
      }),
  };
}

/**
 * @param {string} deviceKey
 * @returns {Record<string, string>}
 */
function authorization(deviceKey) {
  return { authorization: `Bearer ${deviceKey}` };
}

/**
 * @param {typeof fetch} fetchFunction
 * @param {string} url
 * @param {RequestInit} init
 * @returns {Promise<ApiResponse>}
 */
async function request(fetchFunction, url, init) {
  try {
    const response = await fetchFunction(url, { ...init, cache: 'no-store', credentials: 'omit' });
    const body = response.ok ? await response.json() : null;
    return { status: response.status, body };
  } catch {
    return { status: 0, body: null };
  }
}
