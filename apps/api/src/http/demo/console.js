import { COMMAND_POLL_MILLISECONDS, pollCommands } from './commandFeed.js';
import { createGateApi } from './gateApi.js';
import { deviceKeyInput, languageButtons, loopButtons, plateInput, readerButton, render, renderCommands, renderMessage } from './consoleRender.js';
import { pressLoop } from './loopPress.js';
import { sendReading } from './readerRead.js';

/** @typedef {import('./consoleText.js').Language} Language */
/** @typedef {import('./consoleText.js').TextKey} TextKey */
/** @typedef {import('./loopPress.js').PressOutcome} PressOutcome */
/** @typedef {import('@palier/shared-types').GateIdentity} GateIdentity */
/** @typedef {import('@palier/shared-types').GateKind} GateKind */
/** @typedef {import('@palier/shared-types').GatePassageResponse} GatePassageResponse */
/** @typedef {import('@palier/shared-types').GateCommand} GateCommand */

const api = createGateApi(window.fetch.bind(window));

const state = {
  /** @type {Language} */ language: 'fr',
  deviceKey: '',
  /** @type {GateIdentity | null} */ identity: null,
  /** @type {GatePassageResponse[]} */ passages: [],
  /** @type {readonly GateCommand[]} */ commands: [],
  isPolling: false,
  /** @type {{ key: TextKey, isError: boolean } | null} */ message: null,
  isSending: false,
  renderedCommandLines: '',
};

// An answer for a key the field no longer holds is dropped, so one gate's commands never show under another.
async function refreshCommands() {
  if (state.isPolling) {
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
  if (poll.isKeyRefused && state.message?.key !== 'keyRefused') {
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

/** @param {GateKind} loop */
async function onLoopPressed(loop) {
  if (state.isSending) {
    return;
  }
  state.isSending = true;
  try {
    const press = { loop, deviceKey: state.deviceKey, identity: state.identity, pressedAt: new Date() };
    applyOutcome(await pressLoop(press, api));
  } finally {
    state.isSending = false;
    render(state);
  }
}

async function onReadingSent() {
  if (state.isSending) {
    return;
  }
  state.isSending = true;
  try {
    const outcome = await sendReading({ deviceKey: state.deviceKey, identity: state.identity, identifier: plateInput.value }, api);
    state.identity = outcome.identity;
    state.message = readingMessage(outcome);
  } finally {
    state.isSending = false;
    render(state);
  }
}

/**
 * @param {import('./readerRead.js').ReadOutcome} outcome
 * @returns {{ key: TextKey, isError: boolean }}
 */
function readingMessage(outcome) {
  if (outcome.kind === 'refused') {
    return { key: outcome.messageKey, isError: true };
  }
  return outcome.kind === 'opened' ? { key: 'readerOpened', isError: false } : { key: 'readerFallback', isError: true };
}

readerButton.addEventListener('click', () => void onReadingSent());

deviceKeyInput.addEventListener('input', () => {
  state.deviceKey = deviceKeyInput.value.trim();
  state.identity = null;
  state.message = null;
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
