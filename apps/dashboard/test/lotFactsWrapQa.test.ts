// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const listsCss = readFileSync(new URL('../src/theme/lists.css', import.meta.url), 'utf8');

function ruleOf(selector: string): string {
  const start = listsCss.indexOf(`${selector} {`);
  return start === -1 ? '' : listsCss.slice(start, listsCss.indexOf('}', start));
}

describe('the facts of a lot under a long unbroken address (QA #64)', () => {
  // Fails today: a 200-character address with no space (the API accepts it) pushed the 375 px lot page to 1 588 px wide.
  it('lets a fact value break anywhere, like the lot name and the row names, so the page never scrolls sideways', () => {
    expect(ruleOf('.row-name')).toContain('overflow-wrap: anywhere');
    expect(ruleOf('.fact-value')).toContain('overflow-wrap: anywhere');
  });
});
