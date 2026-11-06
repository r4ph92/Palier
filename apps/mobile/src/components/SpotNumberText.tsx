import type { AssignedSpot } from '@palier/shared-types';
import type { ReactNode } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { unbrokenSpotNumber } from '../spots/spotNumber';

interface SpotNumberTextProps {
  readonly spot: AssignedSpot;
  readonly lead: ReactNode;
  readonly style: StyleProp<TextStyle>;
  readonly numberStyle: StyleProp<TextStyle>;
  readonly trail?: ReactNode;
}

// The spot number is a figure inside a sentence, in mono (docs/design.md, gesture 3).
export function SpotNumberText({ spot, lead, style, numberStyle, trail = null }: SpotNumberTextProps) {
  return (
    <Text style={style}>
      {lead}
      <Text style={numberStyle}>{unbrokenSpotNumber(spot)}</Text>
      {trail}
    </Text>
  );
}
