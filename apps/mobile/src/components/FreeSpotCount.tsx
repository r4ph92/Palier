import { StyleSheet, Text, View } from 'react-native';
import { i18n } from '../i18n/i18n';
import { useColors } from '../theme/useColors';
import { spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

const INDICATOR_SIZE = 8;

interface FreeSpotCountProps {
  readonly count: number;
}

export function FreeSpotCount({ count }: FreeSpotCountProps) {
  const colors = useColors();
  const indicatorColor = count > 0 ? colors.free : colors.danger;
  return (
    <View style={styles.row}>
      <View style={[styles.indicator, { backgroundColor: indicatorColor }]} />
      <Text style={styles.count}>
        <Text style={[typography.countNumber, { color: colors.ink }]}>{count}</Text>
        <Text style={[typography.countLabel, { color: colors.muted }]}> {i18n.t('home.freeSpotsLabel', { count })}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.small, flexShrink: 0 },
  indicator: { width: INDICATOR_SIZE, height: INDICATOR_SIZE },
  count: { textAlign: 'right' },
});
