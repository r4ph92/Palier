import { StyleSheet, View } from 'react-native';
import { i18n } from '../i18n/i18n';
import { useColors } from '../theme/useColors';
import { spacing } from '../theme/tokens';
import { typography } from '../theme/typography';
import { COUNT_BAR, NAME_BAR, PLACEHOLDER_ROWS } from './placeholderBars';

export function LotListLoading() {
  return (
    <View accessible accessibilityLabel={i18n.t('home.loading')} accessibilityState={{ busy: true }}>
      {PLACEHOLDER_ROWS.map((row) => (
        <PlaceholderRow key={row} />
      ))}
    </View>
  );
}

function PlaceholderRow() {
  const colors = useColors();
  const bar = { backgroundColor: colors.sunken };
  return (
    <View testID="lot-placeholder" style={[styles.row, { borderBottomColor: colors.line }]}>
      <View style={styles.summary}>
        <View style={styles.identity}>
          <View style={[styles.name, bar]} />
          <View style={[styles.distance, bar]} />
        </View>
        <View style={[styles.count, bar]} />
      </View>
      <View style={[styles.category, styles.fullCategory, bar]} />
      <View style={[styles.category, styles.shortCategory, bar]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.small, paddingVertical: spacing.medium, borderBottomWidth: StyleSheet.hairlineWidth },
  summary: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  identity: { width: NAME_BAR.width, gap: spacing.extraSmall },
  name: { width: '100%', height: NAME_BAR.height },
  distance: { width: '45%', height: typography.figure.lineHeight },
  count: COUNT_BAR,
  category: { height: typography.countLabel.lineHeight },
  fullCategory: { width: '100%' },
  shortCategory: { width: '70%' },
});
