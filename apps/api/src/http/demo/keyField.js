import { isMessageKey } from './consoleText.js';

const HINT_ID = 'device-key-hint';
const MESSAGE_ID = 'message';

/**
 * A refused key marks the field invalid and points it at the message that says why; both clear when the field is edited.
 * @param {{ message: import('./consoleText.js').ConsoleMessage | null }} state
 * @returns {{ isInvalid: boolean, describedBy: string }}
 */
export function keyFieldAttributes(state) {
  const isInvalid = isMessageKey(state.message, 'keyRefused');
  return { isInvalid, describedBy: isInvalid ? `${HINT_ID} ${MESSAGE_ID}` : HINT_ID };
}
