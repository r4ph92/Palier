import { formatPassageTime, translate, vehiclesInside } from './consoleText.js';
import { isLoopEnabled } from './loopPress.js';

/** @typedef {import('./consoleText.js').TextKey} TextKey */
/** @typedef {import('@palier/shared-types').GateKind} GateKind */
/** @typedef {import('./consoleText.js').Language} Language */
/** @typedef {import('@palier/shared-types').GateIdentity} GateIdentity */
/** @typedef {import('@palier/shared-types').GatePassageResponse} GatePassageResponse */
/** @typedef {import('@palier/shared-types').GateCommand} GateCommand */
/**
 * @typedef {object} ConsoleState
 * @property {Language} language
 * @property {string} deviceKey
 * @property {GateIdentity | null} identity
 * @property {GatePassageResponse[]} passages
 * @property {readonly GateCommand[]} commands
 * @property {{ key: TextKey, isError: boolean } | null} message
 * @property {string} renderedCommandLines
 */

/**
 * @param {string} id
 * @returns {HTMLElement}
 */
export function elementById(id) {
  const element = document.getElementById(id);
  if (element === null) {
    throw new Error(`The console page has no #${id}.`);
  }
  return element;
}

export const deviceKeyInput = /** @type {HTMLInputElement} */ (elementById('device-key'));
export const loopButtons = /** @type {HTMLButtonElement[]} */ ([...document.querySelectorAll('[data-loop]')]);
export const languageButtons = /** @type {HTMLButtonElement[]} */ ([...document.querySelectorAll('[data-language]')]);

/** @param {ConsoleState} state */
export function render(state) {
  document.documentElement.lang = state.language;
  document.title = translate(state.language, 'pageTitle');
  renderStaticTexts(state);
  renderIdentity(state);
  renderLoops(state);
  renderMessage(state);
  renderCommands(state);
  renderPassages(state);
}

/** @param {ConsoleState} state */
function renderStaticTexts(state) {
  for (const element of document.querySelectorAll('[data-text]')) {
    element.textContent = translate(state.language, /** @type {TextKey} */ (element.getAttribute('data-text')));
  }
  for (const button of languageButtons) {
    button.setAttribute('aria-pressed', String(button.dataset['language'] === state.language));
  }
}

/** @param {ConsoleState} state */
function renderIdentity(state) {
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

/** @param {ConsoleState} state */
function renderLoops(state) {
  for (const button of loopButtons) {
    button.disabled = !isLoopEnabled(/** @type {GateKind} */ (button.dataset['loop']), state);
  }
}

/** @param {ConsoleState} state */
export function renderMessage(state) {
  const message = elementById('message');
  message.textContent = state.message === null ? '' : translate(state.language, state.message.key);
  message.classList.toggle('message-error', state.message?.isError === true);
}

/** @param {ConsoleState} state */
function renderPassages(state) {
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

// The list is a live region: rebuilding it with the same lines would make a screen reader read them all again.
/** @param {ConsoleState} state */
export function renderCommands(state) {
  elementById('no-command').hidden = state.commands.length > 0;
  const lines = [...state.commands].reverse().map((command) =>
    translate(state.language, 'commandLine', {
      command: translate(state.language, 'commandOPEN'),
      time: formatPassageTime(new Date(command.issuedAt), state.language),
    }),
  );
  if (lines.join('\n') === state.renderedCommandLines) {
    return;
  }
  state.renderedCommandLines = lines.join('\n');
  elementById('commands').replaceChildren(...lines.map(commandItem));
}

/** @param {string} line */
function commandItem(line) {
  const item = document.createElement('li');
  item.textContent = line;
  return item;
}
