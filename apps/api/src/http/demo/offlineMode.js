import { UNREACHABLE } from './gateApi.js';
import { DEVICE_KEY_SHAPE, identify } from './loopPress.js';

/** @typedef {import('@palier/shared-types').GateIdentity} GateIdentity */
/** @typedef {import('@palier/shared-types').GateKind} GateKind */
/** @typedef {import('@palier/shared-types').PassageReplayItem} PassageReplayItem */
/** @typedef {import('./consoleText.js').TextKey} TextKey */
/** @typedef {Pick<import('./gateApi.js').GateApi, 'fetchIdentity'>} OfflineApi */
/** @typedef {Pick<import('./gateApi.js').GateApi, 'replayPassages'>} ReplayApi */
/**
 * The passages a controller counted while it had no contact with Palier, bound to the gate that counted them.
 * @typedef {object} OfflineQueue
 * @property {string} deviceKey
 * @property {string} gateId
 * @property {GateKind} kind
 * @property {readonly PassageReplayItem[]} items
 */
/** @typedef {{ messageKey: TextKey, isRetryable: boolean }} ReplayFailure */
/** @typedef {{ queue: OfflineQueue, replayed: number, vehicleCount: number | null, failure: ReplayFailure | null }} ReplayOutcome */
/** @typedef {{ kind: 'offline', identity: GateIdentity, queue: OfflineQueue } | { kind: 'refused', identity: GateIdentity | null, messageKey: TextKey }} GoOfflineOutcome */

const OK = 200;
const SERVER_ERROR = 500;
// Matches the server's maximum batch size.
export const REPLAY_BATCH_SIZE = 500;

/** @type {Record<number, TextKey>} */
const REPLAY_MESSAGE_BY_STATUS = { [UNREACHABLE]: 'unreachable', 401: 'keyRefused', 403: 'gateForbidden' };

/**
 * An offline controller refuses Palier subscribers at an entry and opens an exit unconditionally.
 * @param {GateKind} kind
 * @returns {TextKey}
 */
export function offlineStatusKey(kind) {
  return kind === 'ENTRY' ? 'offlineEntryRefused' : 'offlineExitOpened';
}

/**
 * The gate must be known before the controller loses contact, since nothing can be asked while offline.
 * @param {{ deviceKey: string, identity: GateIdentity | null }} request
 * @param {OfflineApi} api
 * @returns {Promise<GoOfflineOutcome>}
 */
export async function goOffline(request, api) {
  if (!DEVICE_KEY_SHAPE.test(request.deviceKey)) {
    return { kind: 'refused', identity: null, messageKey: 'keyRefused' };
  }
  const identityOrRefusal = request.identity ?? (await identify(request.deviceKey, api));
  if ('messageKey' in identityOrRefusal) {
    return identityOrRefusal;
  }
  const queue = { deviceKey: request.deviceKey, gateId: identityOrRefusal.id, kind: identityOrRefusal.kind, items: [] };
  return { kind: 'offline', identity: identityOrRefusal, queue };
}

/**
 * Counts the passage locally with its own id and time; a loop of the other kind is ignored.
 * @param {OfflineQueue} queue
 * @param {GateKind} loop
 * @param {Date} pressedAt
 * @returns {OfflineQueue}
 */
export function pressLoopOffline(queue, loop, pressedAt) {
  if (loop !== queue.kind) {
    return queue;
  }
  const item = { id: crypto.randomUUID(), kind: loop, closedAt: pressedAt.toISOString() };
  return { ...queue, items: [...queue.items, item] };
}

/**
 * @param {number} replayed
 * @param {number} vehicleCount
 * @returns {import('./consoleText.js').ConsoleMessage}
 */
export function replayedMessage(replayed, vehicleCount) {
  return { key: replayed === 1 ? 'passagesReplayedOne' : 'passagesReplayedOther', isError: false, count: replayed, vehicleCount };
}

/**
 * Only the passages Palier acknowledged leave the queue; the first failure stops the replay and keeps the rest.
 * @param {OfflineQueue} queue
 * @param {ReplayApi} api
 * @returns {Promise<ReplayOutcome>}
 */
export async function replayQueue(queue, api) {
  /** @type {ReplayOutcome} */
  let outcome = { queue, replayed: 0, vehicleCount: null, failure: null };
  while (outcome.failure === null && outcome.queue.items.length > 0) {
    outcome = await replayNextBatch(outcome, api);
  }
  return outcome;
}

/**
 * @param {ReplayOutcome} previous
 * @param {ReplayApi} api
 * @returns {Promise<ReplayOutcome>}
 */
async function replayNextBatch(previous, api) {
  const { queue } = previous;
  const batch = queue.items.slice(0, REPLAY_BATCH_SIZE);
  const response = await api.replayPassages(queue.deviceKey, queue.gateId, batch);
  if (response.status !== OK || response.body === null) {
    return { ...previous, failure: replayFailure(response.status) };
  }
  const { vehicleCount } = /** @type {import('@palier/shared-types').PassageReplayResponse} */ (response.body);
  const rest = { ...queue, items: queue.items.slice(batch.length) };
  return { queue: rest, replayed: previous.replayed + batch.length, vehicleCount, failure: null };
}

/**
 * A refused batch would be refused again, so only an unreachable Palier or a server error is worth retrying.
 * @param {number} status
 * @returns {ReplayFailure}
 */
function replayFailure(status) {
  const isRetryable = status === UNREACHABLE || status >= SERVER_ERROR || status === OK;
  return { messageKey: REPLAY_MESSAGE_BY_STATUS[status] ?? 'replayFailed', isRetryable };
}
