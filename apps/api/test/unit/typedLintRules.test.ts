import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const FILE_PER_WORKSPACE = [
  'apps/api/src/domain/exits/identifyAtExit.ts',
  'apps/api/src/http/demo/console.js',
  'apps/mobile/src/screens/HomeScreen.tsx',
  'apps/dashboard/src/App.tsx',
  'packages/shared-types/src/privacy.ts',
];

describe('the lint configuration', () => {
  it.each(FILE_PER_WORKSPACE)('runs the type-checked rules on %s', async (file) => {
    const config = await new ESLint({ cwd: REPOSITORY_ROOT }).calculateConfigForFile(file);

    expect(config.rules?.['@typescript-eslint/no-floating-promises']?.[0]).toBe(2);
    expect(config.rules?.['@typescript-eslint/switch-exhaustiveness-check']?.[0]).toBe(2);
    expect(config.languageOptions?.parserOptions?.projectService).toBeTruthy();
  });
});
