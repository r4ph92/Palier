import { DEVICE_KEY_SHAPE, knownGateIdentity } from './gateIdentity.js';

/** @typedef {import('@palier/shared-types').GateIdentity} GateIdentity */
/** @typedef {Pick<import('./gateApi.js').GateApi, 'fetchIdentity' | 'postHeartbeat'>} HeartbeatApi */
/** @typedef {{ deviceKey: string, identity: GateIdentity | null, connection: { kind: string } }} HeartbeatState */
/** @typedef {{ identity: GateIdentity | null, isKeyRefused: boolean }} HeartbeatOutcome */

// Four beats inside the 2 minutes after which Palier calls a gate silent (decision 035), so one lost beat changes nothing.
export const HEARTBEAT_MILLISECONDS = 30_000;

const REFUSED_STATUSES = new Set([401, 403]);
const KEY_REFUSALS = new Set(['keyRefused', 'gateForbidden']);

/**
 * Tells Palier the gate is alive. A key Palier refuses stops the beats until the key field changes.
 * @param {{ deviceKey: string, identity: GateIdentity | null }} request
 * @param {HeartbeatApi} api
 * @returns {Promise<HeartbeatOutcome>}
 */
export async function sendHeartbeat(request, api) {
  const identityOrRefusal = await knownGateIdentity(request, api);
  if ('messageKey' in identityOrRefusal) {
    return { identity: null, isKeyRefused: KEY_REFUSALS.has(identityOrRefusal.messageKey) };
  }
  const response = await api.postHeartbeat(request.deviceKey, identityOrRefusal.id);
  return { identity: identityOrRefusal, isKeyRefused: REFUSED_STATUSES.has(response.status) };
}

/** @typedef {{ state: HeartbeatState, api: HeartbeatApi, onIdentified: () => void }} Heart */
/** @typedef {{ isStopped: boolean, beatingKey: string | null }} Pulse */

/**
 * One beat at a time per key, only online and with a key that can be sent.
 * @param {HeartbeatState} state
 * @param {HeartbeatApi} api
 * @param {() => void} onIdentified called when a beat names the gate the console did not know yet
 * @returns {{ beat: () => Promise<void>, restart: () => Promise<void> }}
 */
export function createHeartbeat(state, api, onIdentified) {
  /** @type {Pulse} */
  const pulse = { isStopped: false, beatingKey: null };
  const beat = () => beatOnce({ state, api, onIdentified }, pulse);
  const restart = () => {
    pulse.isStopped = false;
    return beat();
  };
  return { beat, restart };
}

/**
 * @param {HeartbeatState} state
 * @param {Pulse} pulse
 * @returns {boolean}
 */
function canBeat(state, pulse) {
  return !pulse.isStopped && pulse.beatingKey !== state.deviceKey && state.connection.kind === 'online' && DEVICE_KEY_SHAPE.test(state.deviceKey);
}

/**
 * An answer for a key the field no longer holds is dropped: it neither stops the beats nor names the gate.
 * @param {Heart} heart
 * @param {Pulse} pulse
 */
async function beatOnce({ state, api, onIdentified }, pulse) {
  const deviceKey = state.deviceKey;
  if (!canBeat(state, pulse)) {
    return;
  }
  pulse.beatingKey = deviceKey;
  try {
    const outcome = await sendHeartbeat({ deviceKey, identity: state.identity }, api);
    if (deviceKey === state.deviceKey) {
      pulse.isStopped = outcome.isKeyRefused;
      adoptIdentity(state, outcome.identity, onIdentified);
    }
  } finally {
    pulse.beatingKey = pulse.beatingKey === deviceKey ? null : pulse.beatingKey;
  }
}

/**
 * @param {HeartbeatState} state
 * @param {GateIdentity | null} identity
 * @param {() => void} onIdentified
 */
function adoptIdentity(state, identity, onIdentified) {
  if (state.identity !== null || identity === null) {
    return;
  }
  state.identity = identity;
  onIdentified();
}

/**
 * @param {{ beat: () => Promise<void> }} heartbeat
 * @returns {ReturnType<typeof setInterval>}
 */
export function scheduleHeartbeat(heartbeat) {
  return setInterval(() => void heartbeat.beat(), HEARTBEAT_MILLISECONDS);
}
