import { describe, expect, it } from 'vitest';
import { isValidSpotRange, parseSpotRange, spotNumbersOf } from '@palier/shared-types/spotDraft';

function numbersAddedFrom(text: string): string[] {
  const range = parseSpotRange(text);
  return range !== null && isValidSpotRange(range) ? spotNumbersOf(range) : [];
}

describe('spot ranges under attack, round 2 (QA #66)', () => {
  it.each([
    ['B-51 à B-52', ['B-51', 'B-52']],
    ['B-13 À B-14', ['B-13', 'B-14']],
    ['B-15 TO B-16', ['B-15', 'B-16']],
    ['  B-53 au B-54  ', ['B-53', 'B-54']],
  ])('reads « %s » with a no-break space, a capital separator or outer spaces as its range', (text, numbers) => {
    expect(numbersAddedFrom(text)).toEqual(numbers);
  });

  it('keeps the leading zeros of one number « B-050 »', () => {
    expect(numbersAddedFrom('B-050')).toEqual(['B-050']);
  });

  it.each(['B-20 à B-22 à B-24', 'B-20 jusqu’à B-22', 'à B-22', 'B-20 à', '- 1', '1-7'])('reads « %s » as no spot at all', (text) => {
    expect(numbersAddedFrom(text)).toEqual([]);
  });

  // Live: « B 30 à B 31 » adds B 30 and B 31, but « B 32 » alone is refused as unreadable.
  it('reads one number written like the ends of a range it accepts, « B 32 » after « B 30 à B 31 »', () => {
    expect(numbersAddedFrom('B 30 à B 31')).toEqual(['B 30', 'B 31']);

    expect(numbersAddedFrom('B 32')).toEqual(['B 32']);
  });
});
