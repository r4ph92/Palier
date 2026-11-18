import { isLoopAvailable } from './offlineControls.js';

/** @typedef {import('@palier/shared-types').GateIdentity} GateIdentity */
/** @typedef {import('@palier/shared-types').GateKind} GateKind */
/** @typedef {import('@palier/shared-types').GatePassageResponse} GatePassageResponse */
/** @typedef {import('./consoleText.js').ConsoleMessage} ConsoleMessage */
/** @typedef {import('./loopPress.js').PressOutcome} PressOutcome */
/** @typedef {{ identity?: GateIdentity | null, passages?: GatePassageResponse[], message?: ConsoleMessage | null }} OutcomePatch */

/**
 * @param {PressOutcome} outcome
 * @returns {ConsoleMessage}
 */
function messageOfPress(outcome) {
  if (outcome.kind === 'recorded') {
    return { recorded: { closedAt: new Date(outcome.passage.closedAt), vehicleCount: outcome.passage.vehicleCount }, isError: false };
  }
  if (outcome.kind === 'wrongLoop') {
    return { key: outcome.identity.kind === 'ENTRY' ? 'wrongLoopENTRY' : 'wrongLoopEXIT', isError: true };
  }
  return { key: outcome.messageKey, isError: true };
}

/**
 * An answer for a key the field no longer holds says nothing about the gate now shown.
 * A passage the server counted stays in the list: its line names its own loop, and the list must match the counter.
 * @param {{ deviceKey: string, passages: GatePassageResponse[] }} state
 * @param {string} sentKey
 * @param {PressOutcome} outcome
 * @returns {OutcomePatch}
 */
export function applyPressOutcome(state, sentKey, outcome) {
  const passages = outcome.kind === 'recorded' ? [outcome.passage, ...state.passages] : state.passages;
  if (sentKey !== state.deviceKey) {
    return { passages };
  }
  return { identity: outcome.identity, passages, message: messageOfPress(outcome) };
}

/**
 * @param {{ deviceKey: string }} state
 * @param {string} sentKey
 * @param {OutcomePatch} patch
 * @returns {OutcomePatch}
 */
export function patchIfKeyUnchanged(state, sentKey, patch) {
  return sentKey === state.deviceKey ? patch : {};
}

/**
 * The key field stays editable while a press is in flight, so a pasted key is not blocked by a slow answer.
 * It is locked while an offline toggle runs and while a queue waits for its gate's key.
 * @param {{ isToggling: boolean, connection: { kind: string }, identity: GateIdentity | null }} state
 * @returns {boolean}
 */
export function isKeyInputLocked(state) {
  return state.isToggling || (state.connection.kind !== 'online' && state.identity !== null);
}

/**
 * After a press disabled the focused loop button, the enabled one takes the focus.
 * @param {GateKind} pressedLoop
 * @param {Parameters<typeof isLoopAvailable>[1]} state
 * @returns {GateKind | null}
 */
export function loopToFocusAfterPress(pressedLoop, state) {
  if (isLoopAvailable(pressedLoop, state)) {
    return null;
  }
  const otherLoop = pressedLoop === 'ENTRY' ? 'EXIT' : 'ENTRY';
  return isLoopAvailable(otherLoop, state) ? otherLoop : null;
}
