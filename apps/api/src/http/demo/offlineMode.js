import { OK, UNREACHABLE } from './gateApi.js';

/** @typedef {import('@palier/shared-types').GateIdentity} GateIdentity */
/** @typedef {import('@palier/shared-types').GateKind} GateKind */
/** @typedef {import('@palier/shared-types').PassageReplayItem} PassageReplayItem */
/** @typedef {import('./consoleText.js').TextKey} TextKey */
/** @typedef {Pick<import('./gateApi.js').GateApi, 'replayPassages'>} ReplayApi */
/**
 * The passages a controller counted while it had no contact with Palier, bound to the gate that counted them.
 * @typedef {object} OfflineQueue
 * @property {string} gateId
 * @property {GateKind} kind
 * @property {readonly PassageReplayItem[]} items
 */
/** @typedef {{ messageKey: TextKey, isRetryable: boolean }} ReplayFailure */
/** @typedef {{ queue: OfflineQueue, replayed: number, vehicleCount: number | null, failure: ReplayFailure | null }} ReplayOutcome */

const SERVER_ERROR = 500;
// Equal to the server's maximum batch size; a test ties the two.
export const REPLAY_BATCH_SIZE = 500;

/** @type {Record<number, TextKey>} */
const REPLAY_MESSAGE_BY_STATUS = { [UNREACHABLE]: 'replayUnreachable', 401: 'replayKeyRefused', 403: 'replayGateForbidden' };

/**
 * @param {GateIdentity} identity
 * @returns {OfflineQueue}
 */
export function startQueue(identity) {
  return { gateId: identity.id, kind: identity.kind, items: [] };
}

/**
 * An offline controller refuses Palier subscribers at an entry and opens an exit unconditionally.
 * @param {GateKind} kind
 * @returns {TextKey}
 */
export function offlineStatusKey(kind) {
  return kind === 'ENTRY' ? 'offlineEntryRefused' : 'offlineExitOpened';
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
 * Only the passages Palier acknowledged leave the queue; the first failure stops the replay and keeps the rest.
 * @param {OfflineQueue} queue
 * @param {string} deviceKey
 * @param {ReplayApi} api
 * @returns {Promise<ReplayOutcome>}
 */
export async function replayQueue(queue, deviceKey, api) {
  /** @type {ReplayOutcome} */
  let outcome = { queue, replayed: 0, vehicleCount: null, failure: null };
  while (outcome.failure === null && outcome.queue.items.length > 0) {
    outcome = await replayNextBatch(outcome, deviceKey, api);
  }
  return outcome;
}

/**
 * @param {ReplayOutcome} previous
 * @param {string} deviceKey
 * @param {ReplayApi} api
 * @returns {Promise<ReplayOutcome>}
 */
async function replayNextBatch(previous, deviceKey, api) {
  const { queue } = previous;
  const batch = queue.items.slice(0, REPLAY_BATCH_SIZE);
  const response = await api.replayPassages(deviceKey, queue.gateId, batch);
  if (response.status !== OK || response.body === null) {
    return { ...previous, failure: replayFailure(response.status) };
  }
  const { vehicleCount } = /** @type {import('@palier/shared-types').PassageReplayResponse} */ (response.body);
  const rest = { ...queue, items: queue.items.slice(batch.length) };
  return { queue: rest, replayed: previous.replayed + batch.length, vehicleCount, failure: null };
}

/**
 * A refused batch would be refused again, so only an unreachable Palier, a server error or an unreadable answer is worth retrying.
 * Retrying after an unreadable 200 is safe: the batch's ids count once.
 * @param {number} status
 * @returns {ReplayFailure}
 */
function replayFailure(status) {
  const isRetryable = status === UNREACHABLE || status >= SERVER_ERROR || status === OK;
  const messageKey = REPLAY_MESSAGE_BY_STATUS[status] ?? (isRetryable ? 'replayFailed' : 'replayRefused');
  return { messageKey, isRetryable };
}
