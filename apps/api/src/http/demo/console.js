import { COMMAND_POLL_MILLISECONDS } from './commandFeed.js';
import { debounced } from './debounce.js';
import { createCommandRefresh } from './commandPolling.js';
import { createGateApi } from './gateApi.js';
import { createHeartbeat, scheduleHeartbeat } from './gateHeartbeat.js';
import {
  armingButton,
  clearQueueButton,
  deviceKeyInput,
  languageButtons,
  loopButtons,
  offlineToggle,
  plateInput,
  presenceButton,
  readerButton,
  render,
  testPassageButton,
  focusAfterQueueAction,
  focusEnabledLoopAfterPress,
} from './consoleRender.js';
import { pressLoop } from './loopPress.js';
import { isMessageKey } from './consoleText.js';
import { applyPressOutcome, patchIfKeyUnchanged } from './pressOutcome.js';
import { clearQueue, hasPendingPassages, isToggleAvailable, pressLoopWhileOffline, statusMessageOf, toggleOffline } from './offlineControls.js';
import { restoredLanguage, saveLanguage } from './languageStorage.js';
import { restoredConnection, saveConnection } from './queueStorage.js';
import { readingMessage, sendReading } from './readerRead.js';
import { sendTestPassage, testPassageMessage } from './testPassage.js';
import { createPresenceArming } from './presenceArming.js';
import { presenceMessage, sendPresence } from './vehiclePresence.js';

/** @typedef {import('./consoleText.js').Language} Language */
/** @typedef {import('./consoleText.js').TextKey} TextKey */
/** @typedef {import('@palier/shared-types').GateIdentity} GateIdentity */
/** @typedef {import('@palier/shared-types').GateKind} GateKind */
/** @typedef {import('@palier/shared-types').GatePassageResponse} GatePassageResponse */
/** @typedef {import('@palier/shared-types').GateCommand} GateCommand */

const KEY_TYPING_PAUSE_MILLISECONDS = 400;
const BUSY_MESSAGE = { key: /** @type {TextKey} */ ('sending'), isError: false, tone: /** @type {const} */ ('muted') };

const api = createGateApi(window.fetch.bind(window));

const initialConnection = restoredConnection(window.sessionStorage);

const state = {
  /** @type {Language} */ language: restoredLanguage(window.localStorage),
  deviceKey: '',
  /** @type {GateIdentity | null} */ identity: null,
  /** @type {GatePassageResponse[]} */ passages: [],
  /** @type {readonly GateCommand[]} */ commands: [],
  isPolling: false,
  /** @type {import('./consoleText.js').ConsoleMessage | null} */ message: statusMessageOf(initialConnection),
  /** @type {import('./offlineControls.js').Connection} */ connection: initialConnection,
  isSending: false,
  isToggling: false,
  renderedCommandLines: '',
};

const presenceArming = createPresenceArming();
const heartbeat = createHeartbeat(state, api, () => render(state));

/**
 * @param {string} sentKey
 * @param {import('./pressOutcome.js').OutcomePatch} patch
 */
function applyIfKeyUnchanged(sentKey, patch) {
  Object.assign(state, patchIfKeyUnchanged(state, sentKey, patch));
}

/** @param {import('./offlineControls.js').ConsolePatch} patch */
function applyPatch(patch) {
  Object.assign(state, patch);
  saveConnection(state.connection, window.sessionStorage);
}

/**
 * One request at a time: the controls are disabled and the message region says it is sending until it ends.
 * @param {() => Promise<void>} work
 * @param {import('./consoleText.js').ConsoleMessage} [busyMessage]
 */
async function whileSending(work, busyMessage = BUSY_MESSAGE) {
  if (state.isSending) {
    return;
  }
  state.isSending = true;
  state.message = busyMessage;
  render(state);
  try {
    await work();
  } finally {
    state.isSending = false;
    clearBusyMessage();
    render(state);
  }
}

function clearBusyMessage() {
  if (isMessageKey(state.message, 'sending') || isMessageKey(state.message, 'replaying')) {
    state.message = null;
  }
}

/** @param {GateKind} loop */
async function onLoopPressed(loop) {
  await whileSending(async () => {
    const armedAt = presenceArming.take(state.deviceKey);
    if (state.connection.kind !== 'online') {
      applyPatch(pressLoopWhileOffline(state.connection, loop, new Date()));
      return;
    }
    const press = { loop, deviceKey: state.deviceKey, identity: state.identity, pressedAt: new Date(), armedAt };
    Object.assign(state, applyPressOutcome(state, press.deviceKey, await pressLoop(press, api)));
  });
  focusEnabledLoopAfterPress(loop, state);
}

function onOfflineToggled() {
  if (!isToggleAvailable(state)) {
    return Promise.resolve();
  }
  const busyMessage = state.connection.kind === 'online' ? BUSY_MESSAGE : { key: /** @type {TextKey} */ ('replaying'), isError: false, tone: /** @type {const} */ ('muted') };
  const toggled = whileSending(async () => {
    state.isToggling = true;
    render(state);
    try {
      const request = { connection: state.connection, deviceKey: state.deviceKey, identity: state.identity };
      applyPatch(await toggleOffline(request, api));
    } finally {
      state.isToggling = false;
    }
  }, busyMessage);
  return toggled.then(() => {
    focusAfterQueueAction(state);
    void heartbeat.beat();
  });
}

function onQueueCleared() {
  if (state.isSending) {
    return;
  }
  applyPatch(clearQueue());
  render(state);
  focusAfterQueueAction(state);
}

function onReadingSent() {
  return whileSending(async () => {
    const sentKey = state.deviceKey;
    const outcome = await sendReading({ deviceKey: sentKey, identity: state.identity, identifier: plateInput.value }, api);
    applyIfKeyUnchanged(sentKey, { identity: outcome.identity, message: readingMessage(outcome) });
  });
}

function onArmingPressed() {
  const armedAt = new Date();
  presenceArming.arm(state.deviceKey, armedAt);
  state.message = { armedAt, isError: false };
  render(state);
}

function onPresenceSent() {
  return whileSending(async () => {
    presenceArming.arm(state.deviceKey, new Date());
    const sentKey = state.deviceKey;
    const outcome = await sendPresence({ deviceKey: sentKey, identity: state.identity }, api);
    applyIfKeyUnchanged(sentKey, { identity: outcome.identity, message: presenceMessage(outcome) });
  });
}

function onTestPassageSent() {
  return whileSending(async () => {
    const sentKey = state.deviceKey;
    const outcome = await sendTestPassage({ deviceKey: sentKey, identity: state.identity }, api);
    applyIfKeyUnchanged(sentKey, { identity: outcome.identity, message: testPassageMessage(outcome) });
  });
}

readerButton.addEventListener('click', () => void onReadingSent());
testPassageButton.addEventListener('click', () => void onTestPassageSent());
presenceButton.addEventListener('click', () => void onPresenceSent());
armingButton.addEventListener('click', onArmingPressed);
offlineToggle.addEventListener('click', () => void onOfflineToggled());
clearQueueButton.addEventListener('click', onQueueCleared);
window.addEventListener('beforeunload', (event) => {
  if (hasPendingPassages(state.connection)) {
    event.preventDefault();
  }
});

const identifyAfterTyping = debounced(() => void heartbeat.restart(), KEY_TYPING_PAUSE_MILLISECONDS);

deviceKeyInput.addEventListener('input', () => {
  state.deviceKey = deviceKeyInput.value.trim();
  presenceArming.clear();
  state.identity = null;
  state.message = statusMessageOf(state.connection);
  state.commands = [];
  render(state);
  identifyAfterTyping();
});

for (const button of loopButtons) {
  button.addEventListener('click', () => void onLoopPressed(/** @type {GateKind} */ (button.dataset['loop'])));
}

for (const button of languageButtons) {
  button.addEventListener('click', () => {
    state.language = button.dataset['language'] === 'en' ? 'en' : 'fr';
    saveLanguage(state.language, window.localStorage);
    render(state);
  });
}

render(state);
const refreshCommands = createCommandRefresh(state, api);
setInterval(() => void refreshCommands(), COMMAND_POLL_MILLISECONDS);
scheduleHeartbeat(heartbeat);
