import { isSendableDeviceKey } from './gateIdentity.js';

/** @typedef {import('@palier/shared-types').GateCommand} GateCommand */
/** @typedef {Pick<import('./gateApi.js').GateApi, 'fetchCommands'>} CommandApi */
/** @typedef {import('@palier/shared-types').GateIdentity} GateIdentity */

const OK = 200;
const KEY_REFUSED_STATUSES = [401, 403];
// The barrier must look like it reacts to the scan: the console asks for new commands every second.
export const COMMAND_POLL_MILLISECONDS = 1000;

/**
 * Only a key that named its gate is polled, so a key still being typed never asks for commands.
 * @param {{ isPolling: boolean, connection: { kind: string }, identity: GateIdentity | null }} state
 * @returns {boolean}
 */
export function canPollCommands(state) {
  return !state.isPolling && state.connection.kind === 'online' && state.identity !== null;
}

/**
 * The highest sequence shown: the gate numbers its commands in commit order, so nothing committed later is below it.
 * @param {readonly GateCommand[]} known
 * @returns {number | null}
 */
export function cursorOf(known) {
  return known.length === 0 ? null : Math.max(...known.map((command) => command.sequence));
}

/**
 * Oldest first by sequence, each command once, whatever order the polls answered in.
 * @param {readonly GateCommand[]} known
 * @param {readonly GateCommand[]} incoming
 * @returns {GateCommand[]}
 */
export function mergeCommands(known, incoming) {
  const knownIds = new Set(known.map((command) => command.id));
  const added = incoming.filter((command) => !knownIds.has(command.id));
  return [...known, ...added].sort((left, right) => left.sequence - right.sequence);
}

/** @typedef {{ commands: readonly GateCommand[], isKeyRefused: boolean }} PollResult */

/**
 * A refused or unreachable poll keeps what is shown; the next poll tries again.
 * @param {CommandApi} api
 * @param {string} deviceKey
 * @param {readonly GateCommand[]} known
 * @returns {Promise<PollResult>}
 */
export async function pollCommands(api, deviceKey, known) {
  if (!isSendableDeviceKey(deviceKey)) {
    return { commands: known, isKeyRefused: false };
  }
  const response = await api.fetchCommands(deviceKey, cursorOf(known));
  if (KEY_REFUSED_STATUSES.includes(response.status)) {
    return { commands: known, isKeyRefused: true };
  }
  if (response.status !== OK || !Array.isArray(response.body)) {
    return { commands: known, isKeyRefused: false };
  }
  return { commands: mergeCommands(known, /** @type {GateCommand[]} */ (response.body)), isKeyRefused: false };
}
