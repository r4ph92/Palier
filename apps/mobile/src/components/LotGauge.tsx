import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '../theme/useColors';
import { spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

// Under a quarter of the lot free, the fill turns to `low`: the driver may not find a spot by the time they arrive.
export const LOW_SHARE = 0.25;

const GAUGE_HEIGHT = 8;

interface LotGaugeProps {
  readonly freeSpots: number;
  readonly capacity: number;
}

// The share of the lot still free, at a glance; the row's own label speaks it, so the gauge adds nothing for VoiceOver.
export function LotGauge({ freeSpots, capacity }: LotGaugeProps) {
  const colors = useColors();
  const share = freeShare(freeSpots, capacity);
  return (
    <View style={styles.gauge}>
      <View testID="lot-gauge" style={[styles.track, { backgroundColor: colors.sunken }]}>
        <View testID="lot-gauge-fill" style={{ width: `${share * 100}%`, backgroundColor: share >= LOW_SHARE ? colors.free : colors.low }} />
      </View>
      <Text style={[typography.countLabel, styles.ratio, { color: colors.muted }]}>
        {Math.max(0, freeSpots)} / {capacity}
      </Text>
    </View>
  );
}

// A lot with no spot at all, or a count past the capacity, still draws a gauge between empty and full.
export function freeShare(freeSpots: number, capacity: number): number {
  if (capacity <= 0) {
    return 0;
  }
  return Math.min(1, Math.max(0, freeSpots / capacity));
}

const styles = StyleSheet.create({
  // The ratio goes under a full-width track, so every row's gauge has the same length and large text never squeezes it.
  gauge: { gap: spacing.extraSmall },
  track: { alignSelf: 'stretch', height: GAUGE_HEIGHT, flexDirection: 'row' },
  ratio: { alignSelf: 'flex-end', fontVariant: ['tabular-nums'] },
});
