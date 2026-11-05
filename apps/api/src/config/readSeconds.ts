import { readPositiveWholeNumber } from './readPositiveWholeNumber.ts';

export function readSeconds(name: string, variables: NodeJS.ProcessEnv, defaultSeconds: number): number {
  const rawSeconds = variables[name];
  if (rawSeconds === undefined || rawSeconds === '') {
    return defaultSeconds;
  }
  const seconds = readPositiveWholeNumber(rawSeconds);
  if (seconds === null) {
    throw new Error(`${name} must be a positive whole number of seconds, got "${rawSeconds}".`);
  }
  return seconds;
}
