import type { DeveloperToolkit } from './DeveloperToolkit';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro folds the __DEV__ ternary, which a guard clause would not, so the release bundle never sees this require
export const developerTools: DeveloperToolkit | null = __DEV__ ? (require('./simulatedToolkit') as typeof import('./simulatedToolkit')).simulatedToolkit : null;
