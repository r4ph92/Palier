import { DEVICE_KEY_SHAPE } from './loopPress.js';

/** @typedef {import('@palier/shared-types').GateCommand} GateCommand */
/** @typedef {Pick<import('./gateApi.js').GateApi, 'fetchCommands'>} CommandApi */
/** @typedef {import('./gateApi.js').CommandCursor} CommandCursor */

const OK = 200;
// The barrier must look like it reacts to the scan: the console asks for new commands every second.
export const COMMAND_POLL_MILLISECONDS = 1000;

/**
 * The last command shown; its id tells apart two commands of the same millisecond.
 * @param {readonly GateCommand[]} known
 * @returns {CommandCursor | null}
 */
export function cursorOf(known) {
  const last = known.at(-1);
  return last === undefined ? null : { issuedAt: last.issuedAt, id: last.id };
}

/**
 * Oldest first, each command once, whatever order the polls answered in.
 * @param {readonly GateCommand[]} known
 * @param {readonly GateCommand[]} incoming
 * @returns {GateCommand[]}
 */
export function mergeCommands(known, incoming) {
  const knownIds = new Set(known.map((command) => command.id));
  return [...known, ...incoming.filter((command) => !knownIds.has(command.id))];
}

/**
 * A refused or unreachable poll keeps what is shown; the next poll tries again.
 * @param {CommandApi} api
 * @param {string} deviceKey
 * @param {readonly GateCommand[]} known
 * @returns {Promise<readonly GateCommand[]>}
 */
export async function pollCommands(api, deviceKey, known) {
  if (!DEVICE_KEY_SHAPE.test(deviceKey)) {
    return known;
  }
  const response = await api.fetchCommands(deviceKey, cursorOf(known));
  if (response.status !== OK || !Array.isArray(response.body)) {
    return known;
  }
  return mergeCommands(known, /** @type {GateCommand[]} */ (response.body));
}
