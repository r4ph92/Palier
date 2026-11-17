/**
 * Runs the action once, after the calls have paused for the given time.
 * @param {() => void} action
 * @param {number} milliseconds
 * @returns {() => void}
 */
export function debounced(action, milliseconds) {
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(action, milliseconds);
  };
}
