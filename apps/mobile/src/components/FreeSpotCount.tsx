import { StyleSheet, Text, View } from 'react-native';
import { i18n } from '../i18n/i18n';
import { useColors } from '../theme/useColors';
import { useIsLargeText } from '../theme/useIsLargeText';
import { spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

const INDICATOR_SIZE = 8;
const NO_BREAK_SPACE = '\u00A0';

interface FreeSpotCountProps {
  readonly count: number;
}

export function FreeSpotCount({ count }: FreeSpotCountProps) {
  const colors = useColors();
  const indicatorColor = count > 0 ? colors.free : colors.danger;
  const layout = useIsLargeText() ? stackedStyles : sideBySideStyles;
  return (
    <View style={[styles.row, layout.row]}>
      <View style={[styles.indicator, { backgroundColor: indicatorColor }]} />
      <Text style={layout.count}>
        <Text style={[typography.countNumber, { color: colors.ink }]}>{count}</Text>
        <Text style={[typography.countLabel, { color: colors.muted }]}>
          {NO_BREAK_SPACE}
          {i18n.t('home.freeSpotsLabel', { count })}
        </Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.small },
  indicator: { width: INDICATOR_SIZE, height: INDICATOR_SIZE },
});

const sideBySideStyles = StyleSheet.create({
  row: { flexShrink: 1 },
  count: { flexShrink: 1, textAlign: 'right' },
});

const stackedStyles = StyleSheet.create({
  row: { alignSelf: 'stretch' },
  count: { flexShrink: 1, textAlign: 'left' },
});
