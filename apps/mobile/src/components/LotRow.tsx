import type { ReactNode } from 'react';
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
  // Rendered under the categories, outside the row VoiceOver reads as one, so it stays a button of its own.
  readonly action?: ReactNode;
}

interface LotSummaryLineProps {
  readonly nearbyLot: NearbyLot;
}

// The categories run full width under the name and the count, so they wrap on one or two lines, not four.
// A full lot shows « Complet » alone: its categories would all read 0.
export function LotRow({ nearbyLot, action = null }: LotRowProps) {
  const colors = useColors();
  const { lot } = nearbyLot;
  return (
    <View style={[styles.row, { borderBottomColor: colors.line }]}>
      <View accessible accessibilityLabel={lotAccessibilityLabel(nearbyLot)} testID={`lot-row-${lot.id}`} style={styles.details}>
        <LotSummaryLine nearbyLot={nearbyLot} />
        {lot.freeSpots > 0 ? <LotCategories counts={lot.freeSpotsByCategory} /> : null}
      </View>
      {action}
    </View>
  );
}

function LotSummaryLine({ nearbyLot: { lot, distanceMetres } }: LotSummaryLineProps) {
  const colors = useColors();
  const layout = useIsLargeText() ? stackedStyles : sideBySideStyles;
  return (
    <View testID={`lot-summary-${lot.id}`} style={[styles.summary, layout.summary]}>
      <View style={[styles.identity, layout.identity]}>
        <Text style={[typography.lotName, { color: colors.ink }]}>{lot.name}</Text>
        {distanceMetres === null ? null : (
          <Text style={[typography.figure, { color: colors.ink }]}>{formatDistance(distanceMetres, currentLanguage())}</Text>
        )}
      </View>
      <FreeSpotCount count={lot.freeSpots} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.extraSmall, paddingVertical: spacing.medium, borderBottomWidth: StyleSheet.hairlineWidth },
  details: { gap: spacing.small },
  summary: { gap: spacing.medium },
  identity: { gap: spacing.extraSmall },
});

const sideBySideStyles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'flex-start' },
  identity: { flex: 1, minWidth: '40%' },
});

const stackedStyles = StyleSheet.create({
  summary: { flexDirection: 'column', alignItems: 'flex-start', gap: spacing.extraSmall },
  identity: {},
});
