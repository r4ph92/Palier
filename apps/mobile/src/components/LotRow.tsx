import type { LotSummary } from '@palier/shared-types';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '../theme/useColors';
import { useIsLargeText } from '../theme/useIsLargeText';
import { spacing } from '../theme/tokens';
import { typography } from '../theme/typography';
import { FreeSpotCount } from './FreeSpotCount';

interface LotRowProps {
  readonly lot: LotSummary;
}

export function LotRow({ lot }: LotRowProps) {
  const colors = useColors();
  const layout = useIsLargeText() ? stackedStyles : sideBySideStyles;
  return (
    <View accessible testID={`lot-row-${lot.id}`} style={[styles.row, layout.row, { borderBottomColor: colors.line }]}>
      <Text style={[typography.lotName, layout.name, { color: colors.ink }]}>{lot.name}</Text>
      <FreeSpotCount count={lot.freeSpots} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: spacing.medium, borderBottomWidth: StyleSheet.hairlineWidth },
});

const sideBySideStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.medium },
  name: { flex: 1, minWidth: '40%' },
});

const stackedStyles = StyleSheet.create({
  row: { flexDirection: 'column', alignItems: 'flex-start', gap: spacing.extraSmall },
  name: {},
});
