import { goOffline, offlineStatusKey, pressLoopOffline, replayedMessage, replayQueue } from './offlineMode.js';

/** @typedef {import('./consoleRender.js').ConsoleState} ConsoleState */
/** @typedef {import('@palier/shared-types').GateKind} GateKind */
/** @typedef {Pick<import('./gateApi.js').GateApi, 'fetchIdentity' | 'replayPassages'>} OfflineControlApi */

/**
 * @param {ConsoleState} state
 * @param {GateKind} loop
 */
export function pressLoopWhileOffline(state, loop) {
  if (state.pending === null) {
    return;
  }
  state.pending = pressLoopOffline(state.pending, loop, new Date());
  state.message = { key: offlineStatusKey(state.pending.kind), isError: false };
}

/**
 * @param {ConsoleState} state
 * @param {OfflineControlApi} api
 */
export async function toggleOffline(state, api) {
  await (state.offline ? switchOnline(state, api) : switchOffline(state, api));
}

/**
 * @param {ConsoleState} state
 * @param {OfflineControlApi} api
 */
async function switchOffline(state, api) {
  const outcome = await goOffline({ deviceKey: state.deviceKey, identity: state.identity }, api);
  state.identity = outcome.identity;
  if (outcome.kind === 'refused') {
    state.message = { key: outcome.messageKey, isError: true };
    return;
  }
  state.offline = true;
  state.pending = outcome.queue;
  state.message = { key: offlineStatusKey(outcome.queue.kind), isError: false };
}

// A failed replay keeps the console offline with its queue: a retry sends the same ids, which count once.
/**
 * @param {ConsoleState} state
 * @param {OfflineControlApi} api
 */
async function switchOnline(state, api) {
  if (state.pending === null) {
    return;
  }
  const outcome = await replayQueue(state.pending, api);
  state.pending = outcome.queue;
  if (outcome.failure !== null) {
    state.message = { key: outcome.failure.messageKey, isError: true };
    state.isQueueBlocked = !outcome.failure.isRetryable;
    return;
  }
  state.offline = false;
  state.message = outcome.vehicleCount === null ? null : replayedMessage(outcome.replayed, outcome.vehicleCount);
}

/** @param {ConsoleState} state */
export function clearQueue(state) {
  state.offline = false;
  state.pending = null;
  state.isQueueBlocked = false;
  state.message = null;
}
