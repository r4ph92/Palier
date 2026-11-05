import { StyleSheet, View } from 'react-native';
import { i18n } from '../i18n/i18n';
import { useColors } from '../theme/useColors';
import { spacing } from '../theme/tokens';

const PLACEHOLDER_ROWS = [0, 1, 2];

// Same shape as a LotRow (name and count, distance, categories), so nothing shifts when the lots arrive.
export function LotListLoading() {
  const colors = useColors();
  const bar = { backgroundColor: colors.sunken };
  return (
    <View accessible accessibilityLabel={i18n.t('home.loading')} accessibilityState={{ busy: true }}>
      {PLACEHOLDER_ROWS.map((row) => (
        <View key={row} testID="lot-placeholder" style={[styles.row, { borderBottomColor: colors.line }]}>
          <View style={styles.summary}>
            <View style={[styles.name, bar]} />
            <View style={[styles.count, bar]} />
          </View>
          <View style={[styles.distance, bar]} />
          <View style={[styles.categories, bar]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.small, paddingVertical: spacing.medium, borderBottomWidth: StyleSheet.hairlineWidth },
  summary: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  name: { width: '45%', height: 20 },
  count: { width: '35%', height: 32 },
  distance: { width: '20%', height: 16 },
  categories: { width: '100%', height: 14 },
});
