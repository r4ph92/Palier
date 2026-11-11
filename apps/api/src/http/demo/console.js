import { COMMAND_POLL_MILLISECONDS, pollCommands } from './commandFeed.js';
import { isMessageKey } from './consoleText.js';
import { createGateApi } from './gateApi.js';
import {
  clearQueueButton,
  deviceKeyInput,
  languageButtons,
  loopButtons,
  offlineToggle,
  plateInput,
  presenceButton,
  readerButton,
  render,
  renderCommands,
  renderMessage,
} from './consoleRender.js';
import { pressLoop } from './loopPress.js';
import { clearQueue, hasPendingPassages, pressLoopWhileOffline, statusMessageOf, toggleOffline } from './offlineControls.js';
import { restoredConnection, saveConnection } from './queueStorage.js';
import { readingMessage, sendReading } from './readerRead.js';
import { presenceMessage, sendPresence } from './vehiclePresence.js';

/** @typedef {import('./consoleText.js').Language} Language */
/** @typedef {import('./consoleText.js').TextKey} TextKey */
/** @typedef {import('./loopPress.js').PressOutcome} PressOutcome */
/** @typedef {import('@palier/shared-types').GateIdentity} GateIdentity */
/** @typedef {import('@palier/shared-types').GateKind} GateKind */
/** @typedef {import('@palier/shared-types').GatePassageResponse} GatePassageResponse */
/** @typedef {import('@palier/shared-types').GateCommand} GateCommand */

const api = createGateApi(window.fetch.bind(window));

const initialConnection = restoredConnection(window.sessionStorage);

const state = {
  /** @type {Language} */ language: 'fr',
  deviceKey: '',
  /** @type {GateIdentity | null} */ identity: null,
  /** @type {GatePassageResponse[]} */ passages: [],
  /** @type {readonly GateCommand[]} */ commands: [],
  isPolling: false,
  /** @type {import('./consoleText.js').ConsoleMessage | null} */ message: statusMessageOf(initialConnection),
  /** @type {import('./offlineControls.js').Connection} */ connection: initialConnection,
  isSending: false,
  renderedCommandLines: '',
};

// An answer for a key the field no longer holds is dropped, so one gate's commands never show under another.
async function refreshCommands() {
  if (state.isPolling || state.connection.kind !== 'online') {
    return;
  }
  state.isPolling = true;
  const deviceKey = state.deviceKey;
  try {
    const poll = await pollCommands(api, deviceKey, state.commands);
    if (deviceKey === state.deviceKey) {
      applyPoll(poll);
    }
  } finally {
    state.isPolling = false;
  }
}

/** @param {import('./commandFeed.js').PollResult} poll */
function applyPoll(poll) {
  if (poll.isKeyRefused && !isMessageKey(state.message, 'keyRefused')) {
    state.message = { key: 'keyRefused', isError: true };
    renderMessage(state);
  }
  if (poll.commands !== state.commands) {
    state.commands = poll.commands;
    renderCommands(state);
  }
}

/** @param {PressOutcome} outcome */
function applyOutcome(outcome) {
  state.identity = outcome.identity;
  if (outcome.kind === 'recorded') {
    state.passages = [outcome.passage, ...state.passages];
    state.message = { key: 'passageRecorded', isError: false };
    return;
  }
  state.message = { key: outcome.kind === 'wrongLoop' ? 'wrongLoop' : outcome.messageKey, isError: true };
}

/** @param {import('./offlineControls.js').ConsolePatch} patch */
function applyPatch(patch) {
  Object.assign(state, patch);
  saveConnection(state.connection, window.sessionStorage);
}

/**
 * One request at a time: the controls are disabled and the message region is busy until it ends.
 * @param {() => Promise<void>} work
 * @param {import('./consoleText.js').ConsoleMessage | null} [busyMessage]
 */
async function whileSending(work, busyMessage = null) {
  if (state.isSending) {
    return;
  }
  state.isSending = true;
  state.message = busyMessage ?? state.message;
  render(state);
  try {
    await work();
  } finally {
    state.isSending = false;
    render(state);
  }
}

/** @param {GateKind} loop */
function onLoopPressed(loop) {
  return whileSending(async () => {
    if (state.connection.kind !== 'online') {
      applyPatch(pressLoopWhileOffline(state.connection, loop, new Date()));
      return;
    }
    const press = { loop, deviceKey: state.deviceKey, identity: state.identity, pressedAt: new Date() };
    applyOutcome(await pressLoop(press, api));
  });
}

function onOfflineToggled() {
  const busyMessage = state.connection.kind === 'online' ? null : { key: /** @type {TextKey} */ ('replaying'), isError: false };
  const toggled = whileSending(async () => {
    const request = { connection: state.connection, deviceKey: state.deviceKey, identity: state.identity };
    applyPatch(await toggleOffline(request, api));
  }, busyMessage);
  return toggled.then(() => offlineToggle.focus());
}

function onQueueCleared() {
  if (state.isSending) {
    return;
  }
  applyPatch(clearQueue());
  render(state);
  offlineToggle.focus();
}

function onReadingSent() {
  return whileSending(async () => {
    const outcome = await sendReading({ deviceKey: state.deviceKey, identity: state.identity, identifier: plateInput.value }, api);
    state.identity = outcome.identity;
    state.message = readingMessage(outcome);
  });
}

function onPresenceSent() {
  return whileSending(async () => {
    const outcome = await sendPresence({ deviceKey: state.deviceKey, identity: state.identity }, api);
    state.identity = outcome.identity;
    state.message = presenceMessage(outcome);
  });
}

readerButton.addEventListener('click', () => void onReadingSent());
presenceButton.addEventListener('click', () => void onPresenceSent());
offlineToggle.addEventListener('click', () => void onOfflineToggled());
clearQueueButton.addEventListener('click', onQueueCleared);
window.addEventListener('beforeunload', (event) => {
  if (hasPendingPassages(state.connection)) {
    event.preventDefault();
  }
});

deviceKeyInput.addEventListener('input', () => {
  state.deviceKey = deviceKeyInput.value.trim();
  state.identity = null;
  state.message = statusMessageOf(state.connection);
  state.commands = [];
  render(state);
});

for (const button of loopButtons) {
  button.addEventListener('click', () => void onLoopPressed(/** @type {GateKind} */ (button.dataset['loop'])));
}

for (const button of languageButtons) {
  button.addEventListener('click', () => {
    state.language = button.dataset['language'] === 'en' ? 'en' : 'fr';
    render(state);
  });
}

render(state);
setInterval(() => void refreshCommands(), COMMAND_POLL_MILLISECONDS);
