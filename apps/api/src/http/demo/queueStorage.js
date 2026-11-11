import { ONLINE } from './offlineControls.js';

/** @typedef {import('./offlineControls.js').Connection} Connection */
/** @typedef {import('./offlineMode.js').OfflineQueue} OfflineQueue */
/** @typedef {Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>} QueueStorage */

// Per tab and gone when the tab closes; the device key is never stored, so a reload asks for it again.
const STORAGE_KEY = 'palier.demoConsole.offlineQueue';

/**
 * @param {Connection} connection
 * @param {QueueStorage} storage
 */
export function saveConnection(connection, storage) {
  try {
    if (connection.kind === 'online') {
      storage.removeItem(STORAGE_KEY);
      return;
    }
    storage.setItem(STORAGE_KEY, JSON.stringify(connection.queue));
  } catch {
    // Storage is blocked or full: the queue then lives only in memory, which is the behaviour without this feature.
  }
}

/**
 * A reload restarts offline: the queue keeps counting until a key for the same gate is entered and the console goes online.
 * @param {QueueStorage} storage
 * @returns {Connection}
 */
export function restoredConnection(storage) {
  try {
    const stored = JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null');
    return isQueue(stored) ? { kind: 'offline', queue: stored } : ONLINE;
  } catch {
    return ONLINE;
  }
}

/**
 * @param {unknown} value
 * @returns {value is OfflineQueue}
 */
function isQueue(value) {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const { gateId, gateName, kind, items } = /** @type {Record<string, unknown>} */ (value);
  return typeof gateId === 'string' && typeof gateName === 'string' && (kind === 'ENTRY' || kind === 'EXIT') && Array.isArray(items) && items.every(isItem);
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isItem(value) {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const { id, kind, closedAt } = /** @type {Record<string, unknown>} */ (value);
  return typeof id === 'string' && (kind === 'ENTRY' || kind === 'EXIT') && typeof closedAt === 'string';
}
