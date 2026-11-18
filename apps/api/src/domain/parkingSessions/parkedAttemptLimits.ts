// Counted before the lot lock is taken, so a script cannot keep the lock busy or read every spot's state.
export const PARKED_ANSWER_LIMIT = 10;
// Higher than the answers: the app may resend a walk signal (repeated signal, offline replay).
export const PARKED_SIGNAL_LIMIT = 20;
export const PARKED_ATTEMPT_WINDOW_MILLISECONDS = 10 * 60 * 1000;
