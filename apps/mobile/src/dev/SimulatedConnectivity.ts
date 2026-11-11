import type { Connectivity, ConnectivitySource } from '../api/ConnectivitySource';

// « Réseau coupé » and « Réseau rétabli » of the panel, read by the app as the device's network.
export class SimulatedConnectivity implements ConnectivitySource {
  readonly #listeners = new Set<(connectivity: Connectivity) => void>();
  #connectivity: Connectivity = 'online';

  current(): Connectivity {
    return this.#connectivity;
  }

  set(connectivity: Connectivity): void {
    this.#connectivity = connectivity;
    this.#listeners.forEach((listener) => listener(connectivity));
  }

  subscribe(listener: (connectivity: Connectivity) => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }
}
