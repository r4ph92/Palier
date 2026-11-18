import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(new URL('../../../../.github/workflows/ci.yml', import.meta.url), 'utf8');
const triggers = workflow.slice(workflow.indexOf('\non:'), workflow.indexOf('\njobs:'));

describe('the CI triggers', () => {
  it('runs on a push to main only, so a story branch with a pull request runs once', () => {
    expect(triggers).toMatch(/\n {2}push:\n {4}branches: \[main\]\n/);
  });

  it('runs on every pull request whatever its base, so stacked pull requests are checked too', () => {
    expect(triggers).toMatch(/\n {2}pull_request:\s*$/);
  });
});
