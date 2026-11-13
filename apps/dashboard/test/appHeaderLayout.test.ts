// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const layoutCss = readFileSync(new URL('../src/theme/layout.css', import.meta.url), 'utf8');

function ruleOf(selector: string): string {
  const start = layoutCss.indexOf(`${selector} {`);
  return start === -1 ? '' : layoutCss.slice(start, layoutCss.indexOf('}', start));
}

describe('the app header layout', () => {
  it('shares the page width, centering and side padding', () => {
    const rule = ruleOf('.app-header,\n.page');
    expect(rule).toContain('max-width: 720px');
    expect(rule).toContain('margin: 0 auto');
    expect(rule).toContain('padding: 0 var(--space-medium)');
  });

  it('keeps the actions row flex rule out of the header', () => {
    expect(ruleOf('.actions-row')).toContain('display: flex');
    expect(layoutCss).not.toMatch(/\.app-header,\s*\.actions-row/);
  });
});
