import { StyleSheet, Text, View } from 'react-native';
import { formatDistance } from '../i18n/formatDistance';
import { currentLanguage } from '../i18n/i18n';
import type { NearbyLot } from '../lots/nearbyLots';
import { lotAccessibilityLabel } from '../lots/lotText';
import { useColors } from '../theme/useColors';
import { useIsLargeText } from '../theme/useIsLargeText';
import { spacing } from '../theme/tokens';
import { typography } from '../theme/typography';
import { FreeSpotCount } from './FreeSpotCount';
import { LotCategories } from './LotCategories';

interface LotRowProps {
  readonly nearbyLot: NearbyLot;
}

export function LotRow({ nearbyLot }: LotRowProps) {
  const colors = useColors();
  const layout = useIsLargeText() ? stackedStyles : sideBySideStyles;
  const { lot } = nearbyLot;
  return (
    <View
      accessible
      accessibilityLabel={lotAccessibilityLabel(nearbyLot, currentLanguage())}
      testID={`lot-row-${lot.id}`}
      style={[styles.row, layout.row, { borderBottomColor: colors.line }]}
    >
      <LotDetails nearbyLot={nearbyLot} />
      <FreeSpotCount count={lot.freeSpots} />
    </View>
  );
}

// A full lot shows « Complet » alone: its categories would all read 0.
function LotDetails({ nearbyLot: { lot, distanceMetres } }: LotRowProps) {
  const colors = useColors();
  const layout = useIsLargeText() ? stackedStyles : sideBySideStyles;
  return (
    <View style={[styles.details, layout.details]}>
      <Text style={[typography.lotName, { color: colors.ink }]}>{lot.name}</Text>
      {distanceMetres === null ? null : (
        <Text style={[typography.figure, { color: colors.ink }]}>{formatDistance(distanceMetres, currentLanguage())}</Text>
      )}
      {lot.freeSpots > 0 ? <LotCategories counts={lot.freeSpotsByCategory} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: spacing.medium, borderBottomWidth: StyleSheet.hairlineWidth },
  details: { gap: spacing.extraSmall },
});

const sideBySideStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.medium },
  details: { flex: 1, minWidth: '40%' },
});

const stackedStyles = StyleSheet.create({
  row: { flexDirection: 'column', alignItems: 'flex-start', gap: spacing.extraSmall },
  details: {},
});
