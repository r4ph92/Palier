// A task still running when the next period comes is skipped, never stacked.
export class SingleRun {
  #running: Promise<void> | null = null;

  start(task: () => Promise<void>): Promise<void> {
    if (this.#running !== null) {
      return Promise.resolve();
    }
    const running = task().finally(() => {
      this.#running = null;
    });
    this.#running = running;
    return running;
  }

  finished(): Promise<void> {
    return this.#running ?? Promise.resolve();
  }
}
