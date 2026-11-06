import type { LocationExplanationStore } from '../src/deviceLocation/LocationExplanationStore';

type StoreMode = 'working' | 'failing' | 'pending';

export class MemoryLocationExplanationStore implements LocationExplanationStore {
  answered: boolean;
  readMode: StoreMode = 'working';
  writeMode: StoreMode = 'working';
  #finishRead: () => void = () => undefined;

  constructor(answered = true) {
    this.answered = answered;
  }

  wasAnswered(): Promise<boolean> {
    if (this.readMode === 'failing') {
      return Promise.reject(new Error('fake read failure'));
    }
    if (this.readMode === 'pending') {
      return new Promise((resolve) => {
        this.#finishRead = () => resolve(this.answered);
      });
    }
    return Promise.resolve(this.answered);
  }

  // Lets a 'pending' read finish, as the disk would after a while.
  finishRead(): void {
    this.#finishRead();
  }

  markAnswered(): Promise<void> {
    if (this.writeMode === 'failing') {
      return Promise.reject(new Error('fake write failure'));
    }
    this.answered = true;
    return Promise.resolve();
  }
}
