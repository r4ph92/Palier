import { pollCommands } from './commandFeed.js';
import { renderCommands, renderMessage } from './consoleRender.js';
import { isMessageKey } from './consoleText.js';

/**
 * An answer for a key the field no longer holds is dropped, so one gate's commands never show under another.
 * @param {import('./consoleRender.js').ConsoleState & { isPolling: boolean }} state
 * @param {import('./commandFeed.js').CommandApi} api
 * @returns {() => Promise<void>}
 */
export function createCommandRefresh(state, api) {
  return async function refreshCommands() {
    if (state.isPolling || state.connection.kind !== 'online') {
      return;
    }
    state.isPolling = true;
    const deviceKey = state.deviceKey;
    try {
      const poll = await pollCommands(api, deviceKey, state.commands);
      if (deviceKey === state.deviceKey) {
        applyPoll(state, poll);
      }
    } finally {
      state.isPolling = false;
    }
  };
}

/**
 * @param {import('./consoleRender.js').ConsoleState} state
 * @param {import('./commandFeed.js').PollResult} poll
 */
function applyPoll(state, poll) {
  if (poll.isKeyRefused && !isMessageKey(state.message, 'keyRefused')) {
    state.message = { key: 'keyRefused', isError: true };
    renderMessage(state);
  }
  if (poll.commands !== state.commands) {
    state.commands = poll.commands;
    renderCommands(state);
  }
}
