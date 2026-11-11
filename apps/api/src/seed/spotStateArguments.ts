import { parseArgs } from 'node:util';
import { spotState, type SpotState } from '../infrastructure/postgres/schema.ts';

export interface SpotStateChange {
  readonly lotName: string;
  readonly spotNumber: string;
  readonly state: SpotState;
  readonly forceActiveSession: boolean;
}

const USAGE = 'Usage: npm run seed:spot-state -- --lot "Parking Démo" --spot A-1 --state OUT_OF_SERVICE [--force-active-session]';

export function parseSpotStateArguments(argumentList: readonly string[]): SpotStateChange {
  const { values } = parseArgs({
    args: [...argumentList],
    options: { lot: { type: 'string' }, spot: { type: 'string' }, state: { type: 'string' }, 'force-active-session': { type: 'boolean' } },
  });
  if (values.lot === undefined || values.spot === undefined || values.state === undefined) {
    throw new Error(USAGE);
  }
  return {
    lotName: values.lot,
    spotNumber: values.spot,
    state: parseSpotState(values.state),
    forceActiveSession: values['force-active-session'] === true,
  };
}

// Only a spot hold sets HELD: a spot moved there by hand would have no hold to release it.
const SETTABLE_STATES = spotState.enumValues.filter((state) => state !== 'HELD');

function parseSpotState(rawState: string): SpotState {
  const state = SETTABLE_STATES.find((candidate) => candidate === rawState);
  if (state === undefined) {
    throw new Error(`Unknown state "${rawState}". Expected one of: ${SETTABLE_STATES.join(', ')}.`);
  }
  return state;
}
