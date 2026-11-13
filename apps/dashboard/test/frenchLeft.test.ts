import { describe, expect, it } from 'vitest';
import { frenchLeftOnEnglishPage } from './frenchLeft.ts';

function showPage(text: string): void {
  const paragraph = document.createElement('p');
  paragraph.textContent = text;
  document.body.replaceChildren(paragraph);
}

describe('finding French left on an English page', () => {
  it('does not read the French "par" inside the English "parking"', () => {
    showPage('Free parking for 20 min');

    expect(frenchLeftOnEnglishPage()).toEqual([]);
  });

  it('catches the French "par" standing as a word', () => {
    showPage('$1.00 par 20 min');

    expect(frenchLeftOnEnglishPage()).toContain('par');
  });

  it('catches a fragment that starts with punctuation right after a placeholder number', () => {
    showPage('From 5 to 60. Chaque incrément commencé est facturé.');

    expect(frenchLeftOnEnglishPage()).toContain('. Chaque incrément commencé est facturé.');
  });

  it('catches a French sentence hard-coded on the page', () => {
    showPage('Corrigez les champs indiqués.');

    expect(frenchLeftOnEnglishPage()).toContain('Corrigez les champs indiqués.');
  });
});
