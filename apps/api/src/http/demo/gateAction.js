import { OK } from './gateApi.js';
import { knownGateIdentity } from './gateIdentity.js';

/** @typedef {import('@palier/shared-types').GateIdentity} GateIdentity */
/** @typedef {import('./consoleText.js').TextKey} TextKey */
/** @typedef {import('./gateApi.js').ApiResponse} ApiResponse */
/** @typedef {{ kind: 'refused', identity: GateIdentity | null, messageKey: TextKey }} GateActionRefusal */
/** @typedef {{ kind: 'answered', identity: GateIdentity, body: unknown }} GateActionAnswer */

/**
 * @typedef {object} GateAction
 * @property {Pick<import('./gateApi.js').GateApi, 'fetchIdentity'>} api
 * @property {(gateId: string) => Promise<ApiResponse>} send
 * @property {(status: number) => TextKey} messageForStatus
 */

/**
 * Finds the gate the key belongs to, sends it the action, and names a refusal by its status.
 * @param {{ deviceKey: string, identity: GateIdentity | null }} request
 * @param {GateAction} action
 * @returns {Promise<GateActionAnswer | GateActionRefusal>}
 */
export async function sendGateAction(request, { api, send, messageForStatus }) {
  const identityOrRefusal = await knownGateIdentity(request, api);
  if ('messageKey' in identityOrRefusal) {
    return identityOrRefusal;
  }
  const response = await send(identityOrRefusal.id);
  if (response.status !== OK || response.body === null) {
    return { kind: 'refused', identity: identityOrRefusal, messageKey: messageForStatus(response.status) };
  }
  return { kind: 'answered', identity: identityOrRefusal, body: response.body };
}
