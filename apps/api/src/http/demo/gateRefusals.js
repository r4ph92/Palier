import { UNREACHABLE } from './gateApi.js';

/** @typedef {import('./consoleText.js').TextKey} TextKey */

/** @type {Readonly<Record<number, TextKey>>} */
const SHARED_MESSAGE_BY_STATUS = { [UNREACHABLE]: 'unreachable', 401: 'keyRefused', 403: 'gateForbidden' };

/**
 * Every gate request answers the same when Palier is out of reach or refuses the key; each adds its own refusals and fallback.
 * @param {Readonly<Record<number, TextKey>>} ownMessageByStatus
 * @param {TextKey} fallback
 * @returns {(status: number) => TextKey}
 */
export function messageForStatusOf(ownMessageByStatus, fallback) {
  /** @type {Readonly<Record<number, TextKey>>} */
  const messageByStatus = { ...SHARED_MESSAGE_BY_STATUS, ...ownMessageByStatus };
  return (status) => messageByStatus[status] ?? fallback;
}
