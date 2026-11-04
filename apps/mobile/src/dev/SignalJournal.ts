export interface LogEntry {
  readonly id: number;
  readonly at: Date;
  readonly text: string;
}

const CAPACITY = 100;

export class SignalJournal {
  private readonly now: () => Date;
  private readonly listeners = new Set<() => void>();
  private newestFirst: readonly LogEntry[] = [];
  private nextId = 0;

  constructor(now: () => Date) {
    this.now = now;
  }

  append(text: string): void {
    const entry: LogEntry = { id: this.nextId++, at: this.now(), text };
    this.newestFirst = [entry, ...this.newestFirst].slice(0, CAPACITY);
    this.listeners.forEach((listener) => listener());
  }

  snapshot = (): readonly LogEntry[] => this.newestFirst;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
}
