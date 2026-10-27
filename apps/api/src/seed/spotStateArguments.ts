import { parseArgs } from 'node:util';
import { spotState, type SpotState } from '../infrastructure/postgres/schema.ts';

export interface SpotStateChange {
  readonly lotName: string;
  readonly spotNumber: string;
  readonly state: SpotState;
}

const USAGE = 'Usage: npm run seed:spot-state -- --lot "Parking Démo" --spot A-1 --state OUT_OF_SERVICE';

export function parseSpotStateArguments(argumentList: readonly string[]): SpotStateChange {
  const { values } = parseArgs({
    args: [...argumentList],
    options: { lot: { type: 'string' }, spot: { type: 'string' }, state: { type: 'string' } },
  });
  if (values.lot === undefined || values.spot === undefined || values.state === undefined) {
    throw new Error(USAGE);
  }
  return { lotName: values.lot, spotNumber: values.spot, state: parseSpotState(values.state) };
}

function parseSpotState(rawState: string): SpotState {
  const state = spotState.enumValues.find((candidate) => candidate === rawState);
  if (state === undefined) {
    throw new Error(`Unknown state "${rawState}". Expected one of: ${spotState.enumValues.join(', ')}.`);
  }
  return state;
}
