export const SPOT_STATES = ['AVAILABLE', 'HELD', 'ASSIGNED', 'OCCUPIED', 'OCCUPIED_UNKNOWN', 'OUT_OF_SERVICE'] as const;

export type SpotState = (typeof SPOT_STATES)[number];
