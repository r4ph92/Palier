import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const TYPED_RULES = ['@typescript-eslint/no-floating-promises', '@typescript-eslint/switch-exhaustiveness-check'];

const FLOATING_PROMISE_AND_PARTIAL_SWITCH = `type Kind = 'a' | 'b';
export function describeKind(kind: Kind): number {
  switch (kind) {
    case 'a':
      return 1;
  }
  return 0;
}
async function work(): Promise<void> {
  await Promise.resolve();
}
export function start(): void {
  work();
}
`;

// The snippet is linted as if it were the content of a real file, so each workspace's own tsconfig types it.
const FILE_PER_WORKSPACE = [
  'apps/api/src/domain/exits/identifyAtExit.ts',
  'apps/api/test/unit/seedGuard.test.ts',
  'apps/mobile/src/screens/HomeScreen.tsx',
  'apps/mobile/test/HomeScreen.test.tsx',
  'apps/dashboard/src/App.tsx',
  'packages/shared-types/src/privacy.ts',
];

const eslint = new ESLint({ cwd: REPOSITORY_ROOT });

async function typedRuleHits(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).flatMap(({ ruleId, fatal, message }) => (fatal === true ? [`fatal: ${message}`] : TYPED_RULES.filter((rule) => rule === ruleId)));
}

describe('the type-checked lint rules', () => {
  it.each(FILE_PER_WORKSPACE)('fail a floating promise and a non-exhaustive switch in %s', async (file) => {
    const hits = await typedRuleHits(FLOATING_PROMISE_AND_PARTIAL_SWITCH, file);

    expect(hits.sort()).toEqual([...TYPED_RULES].sort());
  }, 60_000);

  it('fail a floating promise in a demo console script', async () => {
    const hits = await typedRuleHits('async function work() { await Promise.resolve(); }\nexport function start() { work(); }\n', 'apps/api/src/http/demo/console.js');

    expect(hits).toEqual(['@typescript-eslint/no-floating-promises']);
  }, 60_000);
});
