import { formatPassageTime, messageText, pendingPassages, translate, vehiclesInside } from './consoleText.js';
import { focusTargetAfterQueueAction, isLoopAvailable, isToggleAvailable, queueOf } from './offlineControls.js';
import { isReaderEnabled } from './readerRead.js';
import { isPresenceEnabled } from './vehiclePresence.js';

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
 * @property {import('./consoleText.js').ConsoleMessage | null} message
 * @property {import('./offlineControls.js').Connection} connection
 * @property {boolean} isSending
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
export const offlineToggle = /** @type {HTMLButtonElement} */ (elementById('offline-toggle'));
export const clearQueueButton = /** @type {HTMLButtonElement} */ (elementById('clear-queue'));
export const plateInput = /** @type {HTMLInputElement} */ (elementById('plate-read'));
export const readerButton = /** @type {HTMLButtonElement} */ (elementById('reader-send'));
export const presenceButton = /** @type {HTMLButtonElement} */ (elementById('presence-send'));
export const languageButtons = /** @type {HTMLButtonElement[]} */ ([...document.querySelectorAll('[data-language]')]);

/** @param {ConsoleState} state */
export function render(state) {
  document.documentElement.lang = state.language;
  document.title = translate(state.language, 'pageTitle');
  renderStaticTexts(state);
  renderIdentity(state);
  renderOffline(state);
  renderLoops(state);
  const controls = { ...state, isOffline: state.connection.kind !== 'online' };
  readerButton.disabled = !isReaderEnabled(controls);
  presenceButton.disabled = !isPresenceEnabled(controls);
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
function renderOffline(state) {
  const { connection } = state;
  offlineToggle.setAttribute('aria-pressed', String(connection.kind !== 'online'));
  offlineToggle.setAttribute('aria-disabled', String(!isToggleAvailable(state)));
  deviceKeyInput.disabled = state.isSending || (connection.kind !== 'online' && state.identity !== null);
  renderPending(state);
  clearQueueButton.hidden = connection.kind !== 'blocked';
  clearQueueButton.disabled = state.isSending;
}

// The line stays in the page, only emptied, so a screen reader announces the count when it appears.
/** @param {ConsoleState} state */
function renderPending(state) {
  const { connection } = state;
  const isShown = connection.kind !== 'online' || connection.hasReplayed;
  const queue = queueOf(connection);
  const pending = pendingPassages(queue?.items.length ?? 0, state.language);
  const gate = queue?.gateName ?? '';
  const line = gate === '' ? pending : translate(state.language, 'pendingForGate', { pending, gate });
  elementById('pending').textContent = isShown ? line : '';
}

/** @param {ConsoleState} state */
export function focusAfterQueueAction(state) {
  (focusTargetAfterQueueAction(state) === 'offlineToggle' ? offlineToggle : deviceKeyInput).focus();
}

/** @param {ConsoleState} state */
function renderLoops(state) {
  for (const button of loopButtons) {
    button.disabled = !isLoopAvailable(/** @type {GateKind} */ (button.dataset['loop']), state);
    button.setAttribute('aria-disabled', String(state.isSending));
  }
}

/** @param {ConsoleState} state */
export function renderMessage(state) {
  const message = elementById('message');
  message.textContent = state.message === null ? '' : messageText(state.language, state.message);
  message.classList.toggle('message-error', state.message?.isError === true);
  const tone = state.message !== null && 'tone' in state.message ? state.message.tone : undefined;
  message.classList.toggle('message-degraded', tone !== undefined);
  message.classList.toggle('message-muted', tone === 'muted');
  message.setAttribute('aria-busy', String(state.isSending));
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
