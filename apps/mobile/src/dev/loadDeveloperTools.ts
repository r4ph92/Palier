import type { DeveloperTools } from './DeveloperToolkit';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro folds the __DEV__ ternary, which a guard clause would not, so the release bundle never sees this require
export const developerTools: DeveloperTools | null = __DEV__ ? (require('./simulatedTools') as typeof import('./simulatedTools')).developerTools : null;
