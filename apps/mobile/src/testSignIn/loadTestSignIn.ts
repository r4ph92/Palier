import type { TestSignIn, TestSignInModule } from './TestSignIn';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro folds the __DEV__ ternary, which a guard clause would not, so the release bundle never sees this require
export const loadedTestSignIn: TestSignInModule | null = __DEV__ ? (require('./testSignInModule') as typeof import('./testSignInModule')).testSignInModule : null;

const FLAG_ON = 'true';

export function offeredTestSignIn(loaded: TestSignInModule | null, flag: string | undefined, baseUrl: string): TestSignIn | null {
  if (loaded === null || flag !== FLAG_ON) {
    return null;
  }
  return loaded.createTestSignIn(baseUrl);
}
