import { isLoopEnabled } from './loopPress.js';
import { knownGateIdentity } from './gateIdentity.js';
import { offlineStatusKey, pressLoopOffline, replayQueue, startQueue } from './offlineMode.js';

/** @typedef {import('@palier/shared-types').GateIdentity} GateIdentity */
/** @typedef {import('@palier/shared-types').GateKind} GateKind */
/** @typedef {import('./consoleText.js').ConsoleMessage} ConsoleMessage */
/** @typedef {import('./offlineMode.js').OfflineQueue} OfflineQueue */
/** @typedef {Pick<import('./gateApi.js').GateApi, 'fetchIdentity' | 'replayPassages'>} OfflineControlApi */
/**
 * Offline counts passages in a queue; blocked is an offline queue Palier refused, which only a retry with the right key or a clearing resolves.
 * hasReplayed keeps the "0 passages waiting" line after a replay.
 * @typedef {{ kind: 'online', hasReplayed: boolean } | { kind: 'offline', queue: OfflineQueue } | { kind: 'blocked', queue: OfflineQueue }} Connection
 */
/** @typedef {{ connection?: Connection, identity?: GateIdentity | null, message?: ConsoleMessage | null }} ConsolePatch */
/** @typedef {{ connection: Connection, deviceKey: string, identity: GateIdentity | null }} ToggleRequest */

/** @type {Connection} */
export const ONLINE = { kind: 'online', hasReplayed: false };

/**
 * @param {Connection} connection
 * @returns {OfflineQueue | null}
 */
export function queueOf(connection) {
  return connection.kind === 'online' ? null : connection.queue;
}

/**
 * @param {Connection} connection
 * @returns {boolean}
 */
export function hasPendingPassages(connection) {
  return (queueOf(connection)?.items.length ?? 0) > 0;
}

/**
 * @param {GateKind} loop
 * @param {{ connection: Connection, deviceKey: string, identity: GateIdentity | null }} state
 * @returns {boolean}
 */
export function isLoopAvailable(loop, state) {
  const { connection } = state;
  if (connection.kind === 'online') {
    return isLoopEnabled(loop, state);
  }
  return connection.kind === 'offline' && connection.queue.kind === loop;
}

/**
 * @param {Connection} connection
 * @returns {ConsoleMessage | null}
 */
export function statusMessageOf(connection) {
  if (connection.kind !== 'offline') {
    return null;
  }
  const key = offlineStatusKey(connection.queue.kind);
  return { key, isError: false, tone: connection.queue.kind === 'ENTRY' ? 'degraded' : 'muted' };
}

/**
 * @param {Connection} connection
 * @param {GateKind} loop
 * @param {Date} pressedAt
 * @returns {ConsolePatch}
 */
export function pressLoopWhileOffline(connection, loop, pressedAt) {
  if (connection.kind !== 'offline') {
    return {};
  }
  const queue = pressLoopOffline(connection.queue, loop, pressedAt);
  return { connection: { kind: 'offline', queue }, message: statusMessageOf({ kind: 'offline', queue }) };
}

/**
 * @param {ToggleRequest} request
 * @param {OfflineControlApi} api
 * @returns {Promise<ConsolePatch>}
 */
export async function toggleOffline(request, api) {
  const identityOrRefusal = await knownGateIdentity(request, api);
  if ('messageKey' in identityOrRefusal) {
    return { identity: null, message: { key: identityOrRefusal.messageKey, isError: true } };
  }
  const identity = identityOrRefusal;
  if (request.connection.kind === 'online') {
    return goOffline(identity);
  }
  return goOnline(request, identity, api);
}

/**
 * The gate is identified while still online, since nothing can be asked once the controller has lost contact.
 * @param {GateIdentity} identity
 * @returns {ConsolePatch}
 */
function goOffline(identity) {
  const connection = /** @type {Connection} */ ({ kind: 'offline', queue: startQueue(identity) });
  return { identity, connection, message: statusMessageOf(connection) };
}

/**
 * A failed replay keeps the queue: a retry sends the same ids, which count once.
 * @param {ToggleRequest} request
 * @param {GateIdentity} identity
 * @param {OfflineControlApi} api
 * @returns {Promise<ConsolePatch>}
 */
async function goOnline(request, identity, api) {
  const queue = /** @type {OfflineQueue} */ (queueOf(request.connection));
  if (identity.id !== queue.gateId) {
    return { identity: null, connection: { kind: 'blocked', queue }, message: { key: 'replayGateForbidden', isError: true } };
  }
  const outcome = await replayQueue(queue, request.deviceKey, api);
  if (outcome.failure !== null) {
    return failedReplay(outcome.queue, outcome.failure, identity);
  }
  const message = outcome.vehicleCount === null ? null : { replayed: { count: outcome.replayed, vehicleCount: outcome.vehicleCount }, isError: false };
  return { identity, connection: { kind: 'online', hasReplayed: true }, message: /** @type {ConsoleMessage | null} */ (message) };
}

/**
 * @param {OfflineQueue} queue
 * @param {import('./offlineMode.js').ReplayFailure} failure
 * @param {GateIdentity} identity
 * @returns {ConsolePatch}
 */
function failedReplay(queue, failure, identity) {
  const message = { key: failure.messageKey, isError: true };
  if (failure.isRetryable) {
    return { identity, connection: { kind: 'offline', queue }, message };
  }
  return { identity: null, connection: { kind: 'blocked', queue }, message };
}

/** @returns {ConsolePatch} */
export function clearQueue() {
  return { connection: ONLINE, message: { key: 'queueCleared', isError: false } };
}
