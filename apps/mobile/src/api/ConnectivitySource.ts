export type Connectivity = 'online' | 'offline';

// Whether the device can reach the network. Only the developer panel knows today, so a release build is always online
// and a lost network shows as a failed send instead (decision 024).
export interface ConnectivitySource {
  current(): Connectivity;
  subscribe(listener: (connectivity: Connectivity) => void): () => void;
}

export const alwaysOnline: ConnectivitySource = {
  current: () => 'online',
  subscribe: () => () => undefined,
};
