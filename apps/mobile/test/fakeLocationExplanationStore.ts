import type { LocationExplanationStore } from '../src/deviceLocation/LocationExplanationStore';

export class MemoryLocationExplanationStore implements LocationExplanationStore {
  answered: boolean;

  constructor(answered = true) {
    this.answered = answered;
  }

  wasAnswered(): Promise<boolean> {
    return Promise.resolve(this.answered);
  }

  markAnswered(): Promise<void> {
    this.answered = true;
    return Promise.resolve();
  }
}
