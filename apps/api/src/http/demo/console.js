import { formatPassageTime, translate, vehiclesInside } from './consoleText.js';
import { COMMAND_POLL_MILLISECONDS, pollCommands } from './commandFeed.js';
import { createGateApi } from './gateApi.js';
import { isLoopEnabled, pressLoop } from './loopPress.js';

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
};

/**
 * @param {string} id
 * @returns {HTMLElement}
 */
function elementById(id) {
  const element = document.getElementById(id);
  if (element === null) {
    throw new Error(`The console page has no #${id}.`);
  }
  return element;
}

const deviceKeyInput = /** @type {HTMLInputElement} */ (elementById('device-key'));
const loopButtons = /** @type {HTMLButtonElement[]} */ ([...document.querySelectorAll('[data-loop]')]);
const languageButtons = /** @type {HTMLButtonElement[]} */ ([...document.querySelectorAll('[data-language]')]);

function render() {
  document.documentElement.lang = state.language;
  document.title = translate(state.language, 'pageTitle');
  renderStaticTexts();
  renderIdentity();
  renderLoops();
  renderMessage();
  renderCommands();
  renderPassages();
}

function renderStaticTexts() {
  for (const element of document.querySelectorAll('[data-text]')) {
    element.textContent = translate(state.language, /** @type {TextKey} */ (element.getAttribute('data-text')));
  }
  for (const button of languageButtons) {
    button.setAttribute('aria-pressed', String(button.dataset['language'] === state.language));
  }
}

function renderIdentity() {
  const identity = state.identity;
  elementById('gate-identity').textContent =
    identity === null
      ? translate(state.language, 'gateUnidentified')
      : translate(state.language, 'gateIdentity', {
          name: identity.name,
          kind: translate(state.language, identity.kind),
          lot: identity.lotName,
        });
}

function renderLoops() {
  for (const button of loopButtons) {
    button.disabled = !isLoopEnabled(/** @type {GateKind} */ (button.dataset['loop']), state);
  }
}

function renderMessage() {
  const message = elementById('message');
  message.textContent = state.message === null ? '' : translate(state.language, state.message.key);
  message.classList.toggle('message-error', state.message?.isError === true);
}

function renderPassages() {
  elementById('no-passage').hidden = state.passages.length > 0;
  const items = state.passages.map((passage) => {
    const item = document.createElement('li');
    item.textContent = translate(state.language, 'passageLine', {
      time: formatPassageTime(new Date(passage.closedAt), state.language),
      loop: translate(state.language, passage.kind === 'ENTRY' ? 'loopENTRY' : 'loopEXIT'),
      vehicles: vehiclesInside(passage.vehicleCount, state.language),
    });
    return item;
  });
  elementById('passages').replaceChildren(...items);
}

function renderCommands() {
  elementById('no-command').hidden = state.commands.length > 0;
  const items = [...state.commands].reverse().map((command) => {
    const item = document.createElement('li');
    item.textContent = translate(state.language, 'commandLine', {
      command: translate(state.language, 'commandOPEN'),
      time: formatPassageTime(new Date(command.issuedAt), state.language),
    });
    return item;
  });
  elementById('commands').replaceChildren(...items);
}

// An answer for a key the field no longer holds is dropped, so one gate's commands never show under another.
async function refreshCommands() {
  if (state.isPolling) {
    return;
  }
  state.isPolling = true;
  const deviceKey = state.deviceKey;
  try {
    const commands = await pollCommands(api, deviceKey, state.commands);
    if (deviceKey === state.deviceKey && commands !== state.commands) {
      state.commands = commands;
      renderCommands();
    }
  } finally {
    state.isPolling = false;
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
    render();
  }
}

deviceKeyInput.addEventListener('input', () => {
  state.deviceKey = deviceKeyInput.value.trim();
  state.identity = null;
  state.message = null;
  state.commands = [];
  render();
});

for (const button of loopButtons) {
  button.addEventListener('click', () => void onLoopPressed(/** @type {GateKind} */ (button.dataset['loop'])));
}

for (const button of languageButtons) {
  button.addEventListener('click', () => {
    state.language = button.dataset['language'] === 'en' ? 'en' : 'fr';
    render();
  });
}

render();
setInterval(() => void refreshCommands(), COMMAND_POLL_MILLISECONDS);
