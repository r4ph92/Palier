import type { LotSummary } from '@palier/shared-types';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '../theme/useColors';
import { spacing } from '../theme/tokens';
import { typography } from '../theme/typography';
import { FreeSpotCount } from './FreeSpotCount';

interface LotRowProps {
  readonly lot: LotSummary;
}

export function LotRow({ lot }: LotRowProps) {
  const colors = useColors();
  return (
    <View accessible style={[styles.row, { borderBottomColor: colors.line }]}>
      <Text style={[typography.lotName, styles.name, { color: colors.ink }]}>{lot.name}</Text>
      <FreeSpotCount count={lot.freeSpots} />
    </View>
  );
}

const styles = StyleSheet.create({
  name: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.medium,
    paddingVertical: spacing.medium,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
