import { StyleSheet, View } from 'react-native';
import { useColors } from '../theme/useColors';
import { spacing } from '../theme/tokens';

const PLACEHOLDER_ROWS = [0, 1, 2];

interface LoadingStateProps {
  readonly label: string;
}

export function LoadingState({ label }: LoadingStateProps) {
  const colors = useColors();
  return (
    <View accessible accessibilityLabel={label} accessibilityState={{ busy: true }}>
      {PLACEHOLDER_ROWS.map((row) => (
        <View key={row} style={[styles.row, { borderBottomColor: colors.line }]}>
          <View style={[styles.name, { backgroundColor: colors.sunken }]} />
          <View style={[styles.count, { backgroundColor: colors.sunken }]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.medium,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  name: { width: '45%', height: 20 },
  count: { width: '35%', height: 32 },
});
