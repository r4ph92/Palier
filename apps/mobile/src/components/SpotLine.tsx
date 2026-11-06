import type { AssignedSpot } from '@palier/shared-types';
import type { Ref } from 'react';
import { StyleSheet, Text, View, type HostInstance } from 'react-native';
import { i18n } from '../i18n/i18n';
import { unbrokenSpotNumber } from '../spots/spotNumber';
import { useColors } from '../theme/useColors';
import { spacing } from '../theme/tokens';
import { typography } from '../theme/typography';
import { StateMark } from './StateMark';

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
      <Text style={typography.spotNumber}>{unbrokenSpotNumber(spot)}</Text>
      {spotPlace(spot)}
    </Text>
  );
}

interface SpotWithStateProps extends SpotLineProps {
  readonly status: string;
  readonly markColor: string;
  readonly ref?: Ref<HostInstance>;
}

// Spot and its state are one stop for VoiceOver, on the scan screen and on the session screen alike.
export function SpotWithState({ spot, lead = '', status, markColor, ref }: SpotWithStateProps) {
  const colors = useColors();
  return (
    <View ref={ref} accessible accessibilityLabel={`${spotLabel(spot, lead)}. ${status}`} style={styles.group}>
      <SpotLine spot={spot} lead={lead} />
      <StateMark color={markColor}>
        <Text style={[typography.bodyStrong, { color: colors.ink }]}>{status}</Text>
      </StateMark>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.small },
});
