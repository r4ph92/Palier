import { isLoopEnabled } from './loopPress.js';

/** @typedef {import('@palier/shared-types').GateIdentity} GateIdentity */
/** @typedef {{ deviceKey: string, armedAt: Date }} Arming */

/**
 * The instant a vehicle first reached a gate's arming loop, held until the loop closes. One gate at a time: the device key names it.
 * @returns {{ arm: (deviceKey: string, instant: Date) => void, take: (deviceKey: string) => Date | null, clear: () => void }}
 */
export function createPresenceArming() {
  /** @type {Arming | null} */
  let armed = null;
  return {
    arm: (deviceKey, instant) => {
      armed = { deviceKey, armedAt: instant };
    },
    take: (deviceKey) => {
      const found = armed;
      armed = null;
      return found !== null && found.deviceKey === deviceKey ? found.armedAt : null;
    },
    clear: () => {
      armed = null;
    },
  };
}

/**
 * The entry gate arms with its own button; the exit gate arms with « Véhicule à la sortie ». Offline passages carry no arming time.
 * @param {{ deviceKey: string, identity: GateIdentity | null, isOffline: boolean }} state
 * @returns {boolean}
 */
export function isArmingEnabled(state) {
  return !state.isOffline && isLoopEnabled('ENTRY', state);
}
