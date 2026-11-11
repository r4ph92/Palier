// Runs a task every period while it is needed, and never again once stopped.
export class RetryTimer {
  readonly #task: () => void;
  readonly #periodMilliseconds: number;
  #interval: ReturnType<typeof setInterval> | null = null;
  #isStopped = false;

  constructor(task: () => void, periodMilliseconds: number) {
    this.#task = task;
    this.#periodMilliseconds = periodMilliseconds;
  }

  runWhile(isNeeded: boolean): void {
    if (!isNeeded || this.#isStopped) {
      this.#clear();
      return;
    }
    this.#interval ??= setInterval(this.#task, this.#periodMilliseconds);
  }

  stop(): void {
    this.#isStopped = true;
    this.#clear();
  }

  #clear(): void {
    if (this.#interval !== null) {
      clearInterval(this.#interval);
      this.#interval = null;
    }
  }
}
