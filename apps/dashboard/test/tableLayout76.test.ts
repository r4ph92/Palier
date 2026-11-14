// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function cssOf(file: string): string {
  return readFileSync(new URL(`../src/theme/${file}`, import.meta.url), 'utf8');
}

// The declarations of the rule whose selector list is exactly this one, as written in the file.
function ruleOf(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) {
    throw new Error(`No rule for ${selector}`);
  }
  return css.slice(start, css.indexOf('}', start));
}

const mapCss = cssOf('map.css');

describe('the tables of the beacons and the gates at 375 and 1440 px (#76 round 1)', () => {
  it('never breaks a header or a cell inside a word, only a row name that cannot fit', () => {
    expect(ruleOf(mapCss, '.data-table th,\n.data-table td')).not.toContain('overflow-wrap: anywhere');
    expect(ruleOf(mapCss, '.data-table tbody th')).toContain('overflow-wrap: anywhere');
  });

  it('keeps the headers and figures of the beacons table on one line, so the table scrolls whole instead of crushing its columns', () => {
    const scrolledCells = ruleOf(mapCss, '.wide-table-scroll .data-table th,\n.wide-table-scroll .data-table td');

    expect(scrolledCells).toContain('white-space: nowrap');
    expect(scrolledCells).toContain('overflow-wrap: normal');
    expect(ruleOf(mapCss, '.wide-table-scroll .data-table tbody th,\n.wide-table-scroll .data-table .wrapping-cell')).toContain('white-space: normal');
  });

  it('scrolls the hidden labels of the row forms inside the box, so the 375 px page itself never scrolls sideways', () => {
    expect(ruleOf(mapCss, '.wide-table-scroll')).toContain('position: relative');
  });

  it('spaces the columns and lets the reading field take only the width it needs', () => {
    expect(ruleOf(mapCss, '.data-table th,\n.data-table td')).toContain('padding: var(--space-small) var(--space-medium) var(--space-small) 0');
    expect(ruleOf(mapCss, '.row-form .field')).not.toContain('flex:');
    expect(ruleOf(mapCss, '.row-form .field')).toContain('width: auto');
    expect(ruleOf(mapCss, '.row-form-controls')).not.toContain('flex-wrap');
  });

  it('keeps the Save button next to the input and puts a field error on its own row, and keeps the focus ring of the last column and the row names whole', () => {
    expect(ruleOf(mapCss, '.row-form-controls')).toContain('grid-template-columns: max-content max-content');
    expect(ruleOf(mapCss, '.row-form .field')).toContain('display: contents');
    expect(ruleOf(mapCss, '.row-form .field .error-notice')).toContain('grid-column: 1 / -1');
    expect(ruleOf(mapCss, '.wide-table-scroll .data-table th:last-child,\n.wide-table-scroll .data-table td:last-child')).toContain('padding-right: var(--space-small)');
    expect(ruleOf(mapCss, '.wide-table-scroll .data-table tbody th')).toContain('min-width: 12ch');
  });

  it('spaces a lead that follows a table, keeps an inline link on the sentence line and the banner in its own weight', () => {
    expect(ruleOf(cssOf('layout.css'), '.lead-after-content')).toContain('margin-top: var(--space-large)');
    expect(ruleOf(cssOf('layout.css'), '.lead .text-link')).toContain('display: inline');
    expect(ruleOf(cssOf('lists.css'), '.silent-gates-line .state-mark')).toContain('font-weight: inherit');
  });
});
