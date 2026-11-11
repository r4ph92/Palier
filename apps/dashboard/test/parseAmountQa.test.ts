import { describe, expect, it } from 'vitest';
import { parseAmount } from '../src/lotSetup/parseNumbers.ts';

const INVALID = { ok: false, reason: 'invalid' };

describe('reading an amount with stray spaces or signs (QA #64)', () => {
  it.each([
    ['"1 2,00", a space inside the dollars that is no thousands mark', '1 2,00'],
    ['"1 8", digits split by a space', '1 8'],
    ['"$18$", a dollar sign on both sides', '$18$'],
  ])('refuses %s instead of reading another amount', (_case, text) => {
    expect(parseAmount(text)).toEqual(INVALID);
  });

  it('still reads "1 000,00" with its thousands space', () => {
    expect(parseAmount('1 000,00')).toEqual({ ok: true, value: 100_000 });
  });
});
