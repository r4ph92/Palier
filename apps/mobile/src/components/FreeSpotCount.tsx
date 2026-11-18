import { StyleSheet, Text, useWindowDimensions, View, type TextStyle } from 'react-native';
import { i18n } from '../i18n/i18n';
import { NO_BREAK_SPACE } from '../i18n/spaces';
import { useColors } from '../theme/useColors';
import { useIsLargeText } from '../theme/useIsLargeText';
import { spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

const INDICATOR_SIZE = 8;

interface FreeSpotCountProps {
  readonly count: number;
}

interface CountTextProps {
  readonly count: number;
  readonly isStacked: boolean;
  readonly style: TextStyle;
}

interface FullTextProps {
  readonly style: TextStyle;
}

export function FreeSpotCount({ count }: FreeSpotCountProps) {
  const colors = useColors();
  const indicatorColor = count > 0 ? colors.free : colors.danger;
  const isLargeText = useIsLargeText();
  const layout = isLargeText ? stackedStyles : sideBySideStyles;
  const indicatorOffset = useIndicatorOffset(count > 0 ? typography.countNumber.lineHeight : typography.countState.lineHeight);
  return (
    <View testID="free-spot-count" style={[styles.row, layout.row]}>
      <View testID="free-spot-indicator" style={[styles.indicator, { backgroundColor: indicatorColor, marginTop: indicatorOffset }]} />
      {count > 0 ? <CountText count={count} isStacked={isLargeText} style={layout.count} /> : <FullText style={layout.count} />}
    </View>
  );
}

// Centres the square on the first line of the count, whose height grows with the text size.
function useIndicatorOffset(firstLineHeight: number): number {
  const { fontScale } = useWindowDimensions();
  return (firstLineHeight * fontScale - INDICATOR_SIZE) / 2;
}

function CountText({ count, isStacked, style }: CountTextProps) {
  const colors = useColors();
  if (isStacked) {
    return <StackedCountText count={count} style={style} />;
  }
  return (
    <Text style={style}>
      <Text style={[typography.countNumber, { color: colors.ink }]}>{count}</Text>
      <Text style={[typography.countLabel, { color: colors.muted }]}>
        {NO_BREAK_SPACE}
        {i18n.t('home.freeSpotsLabel', { count })}
      </Text>
    </Text>
  );
}

// The label is its own Text so a wrapped second line keeps the label's line height, not the number's.
function StackedCountText({ count, style }: Omit<CountTextProps, 'isStacked'>) {
  const colors = useColors();
  return (
    <View style={styles.stackedCount}>
      <Text style={[typography.countNumber, { color: colors.ink }]}>{count}</Text>
      <Text style={[style, typography.countLabel, { color: colors.muted }]}>{i18n.t('home.freeSpotsLabel', { count })}</Text>
    </View>
  );
}

function FullText({ style }: FullTextProps) {
  const colors = useColors();
  return (
    <Text style={[style, typography.countState, { color: colors.ink }]} accessibilityLabel={i18n.t('home.fullAccessibilityLabel')}>
      {i18n.t('home.full')}
    </Text>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.small },
  stackedCount: { flexShrink: 1, flexDirection: 'row', alignItems: 'baseline', gap: spacing.extraSmall },
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
