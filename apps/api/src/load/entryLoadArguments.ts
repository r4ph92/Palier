import { parseArgs } from 'node:util';
import { LOCAL_HOST_NAMES, LOCAL_HOSTS } from '../config/localHosts.ts';
import { readPositiveWholeNumber } from '../config/readPositiveWholeNumber.ts';
import { LOAD_DRIVER_COUNT } from '../seed/fixtures/loadDrivers.ts';

export interface EntryLoadArguments {
  readonly apiUrl: URL;
  readonly drivers: number;
  readonly gateName: string;
  // Null leaves latency unchecked: only the three-driver run (AC2) promises an answer within 3 s.
  readonly maxLatencyMilliseconds: number | null;
}

const USAGE = 'Usage: npm run load:entries -- [--api http://127.0.0.1:3000] [--drivers 20] [--gate "Entrée Démo"] [--max-latency-ms 3000]';
const DEFAULT_GATE_NAME = 'Entrée Démo';
const DEFAULT_PORT = '3000';

export function parseEntryLoadArguments(argumentList: readonly string[], variables: NodeJS.ProcessEnv): EntryLoadArguments {
  const { values } = parseArgs({
    args: [...argumentList],
    options: { api: { type: 'string' }, drivers: { type: 'string' }, gate: { type: 'string' }, 'max-latency-ms': { type: 'string' } },
  });
  return {
    apiUrl: localApiUrl(values.api ?? `http://127.0.0.1:${variables['PORT'] ?? DEFAULT_PORT}`),
    drivers: values.drivers === undefined ? LOAD_DRIVER_COUNT : boundedWholeNumber('--drivers', values.drivers, LOAD_DRIVER_COUNT),
    gateName: values.gate ?? DEFAULT_GATE_NAME,
    maxLatencyMilliseconds: values['max-latency-ms'] === undefined ? null : boundedWholeNumber('--max-latency-ms', values['max-latency-ms'], Infinity),
  };
}

function localApiUrl(rawUrl: string): URL {
  const url = URL.canParse(rawUrl) ? new URL(rawUrl) : null;
  if (url === null || (url.protocol !== 'http:' && url.protocol !== 'https:')) {
    throw new Error(`--api must be an http(s) address, got "${rawUrl}". ${USAGE}`);
  }
  // The script fires card holds at an API: only a local one, never a shared or hosted server.
  if (!LOCAL_HOSTS.has(url.hostname)) {
    throw new Error(`--api must point at this machine (${LOCAL_HOST_NAMES}), got "${url.hostname}".`);
  }
  return url;
}

function boundedWholeNumber(name: string, rawValue: string, maximum: number): number {
  const value = readPositiveWholeNumber(rawValue);
  if (value === null || value > maximum) {
    const range = maximum === Infinity ? 'a positive whole number' : `a whole number from 1 to ${maximum}`;
    throw new Error(`${name} must be ${range}, got "${rawValue}". ${USAGE}`);
  }
  return value;
}
