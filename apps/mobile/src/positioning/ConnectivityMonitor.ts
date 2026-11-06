import type { Connectivity } from './Connectivity';

type ConnectivityListener = (connectivity: Connectivity) => void;

// Whether the garage network is up. Only the signal panel changes it for now; the bridge contract carries no connectivity.
export class ConnectivityMonitor {
  #current: Connectivity = 'online';
  readonly #listeners = new Set<ConnectivityListener>();

  get current(): Connectivity {
    return this.#current;
  }

  set(connectivity: Connectivity): void {
    if (connectivity === this.#current) {
      return;
    }
    this.#current = connectivity;
    for (const listener of this.#listeners) {
      listener(connectivity);
    }
  }

  subscribe(listener: ConnectivityListener): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }
}
