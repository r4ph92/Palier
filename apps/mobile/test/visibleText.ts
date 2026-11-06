import { getDefaultNormalizer } from '@testing-library/react-native';
import { WORD_JOINER } from '../src/spots/spotNumber';
import { NARROW_NO_BREAK_SPACE, NO_BREAK_SPACE } from '../src/i18n/spaces';

const NO_BREAK_SPACES = new RegExp(`[${NO_BREAK_SPACE}${NARROW_NO_BREAK_SPACE}]`, 'g');

// What a sighted driver reads: no-break spaces look like spaces and the word joiner inside « A-1 » is invisible.
export function asSeen(text: string): string {
  return text.replaceAll(WORD_JOINER, '').replace(NO_BREAK_SPACES, ' ');
}

// Query option for screen.getByText and friends, matching text as the driver sees it.
export const visibleText = { normalizer: (text: string) => getDefaultNormalizer()(asSeen(text)) };
