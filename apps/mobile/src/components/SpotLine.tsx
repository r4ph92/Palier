import type { AssignedSpot } from '@palier/shared-types';
import { Text } from 'react-native';
import { i18n } from '../i18n/i18n';
import { useColors } from '../theme/useColors';
import { typography } from '../theme/typography';

// After the hyphen of a spot number, so « A-1 » never splits across two lines; it is invisible and not spoken.
const WORD_JOINER = '⁠';

export function spotLabel(spot: AssignedSpot, lead = ''): string {
  return `${lead}${spot.number}${spotPlace(spot)}`;
}

function spotPlace(spot: AssignedSpot): string {
  return i18n.t('scan.spotPlace', { level: spot.levelCode, aisle: spot.aisleCode });
}

interface SpotLineProps {
  readonly spot: AssignedSpot;
  readonly lead?: string;
}

// The spot number is the largest thing on the screen, in mono like every figure (docs/design.md, gesture 3).
export function SpotLine({ spot, lead = '' }: SpotLineProps) {
  const colors = useColors();
  return (
    <Text style={[typography.spotLine, { color: colors.ink }]}>
      {lead}
      <Text style={typography.spotNumber}>{spot.number.replaceAll('-', `-${WORD_JOINER}`)}</Text>
      {spotPlace(spot)}
    </Text>
  );
}
