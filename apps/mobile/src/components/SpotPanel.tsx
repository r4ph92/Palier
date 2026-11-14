import type { AssignedSpot } from '@palier/shared-types';
import type { ReactNode, Ref } from 'react';
import { StyleSheet, Text, View, type HostInstance } from 'react-native';
import { i18n } from '../i18n/i18n';
import { unbrokenSpotNumber } from '../spots/spotNumber';
import { useColors } from '../theme/useColors';
import { fontFamilies, spacing } from '../theme/tokens';
import { typography } from '../theme/typography';
import { spotLabel } from './SpotLine';
import { StateMark } from './StateMark';

// The number is already the largest thing on the screen: past this, « A-12 » would no longer fit a phone's width.
const PANEL_NUMBER_MAX_FONT_SCALE = 1.3;
const PANEL_BORDER_WIDTH = 3;

interface SpotPanelProps {
  readonly spot: AssignedSpot;
  readonly statusLabel: string;
  readonly statusContent?: ReactNode;
  readonly markColor: string;
  readonly ref?: Ref<HostInstance>;
}

// The session's spot as a signage panel (docs/design.md); spot and state stay one stop for VoiceOver, as on the scan screen.
export function SpotPanel({ spot, statusLabel, statusContent, markColor, ref }: SpotPanelProps) {
  const colors = useColors();
  return (
    <View ref={ref} accessible accessibilityLabel={`${spotLabel(spot)}. ${statusLabel}`} style={styles.group}>
      <View testID="spot-panel" style={[styles.panel, { backgroundColor: colors.accent, borderColor: colors.onAccent }]}>
        <View style={styles.eyebrowRow}>
          <Text style={[typography.eyebrow, styles.eyebrow, { color: colors.onAccent }]}>{i18n.t('session.spotPanelEyebrow')}</Text>
          <Text testID="spot-panel-level" style={[typography.eyebrow, styles.level, { color: colors.onAccent, borderColor: colors.onAccent }]}>
            {spot.levelCode}
          </Text>
        </View>
        <Text maxFontSizeMultiplier={PANEL_NUMBER_MAX_FONT_SCALE} style={[typography.spotPanelNumber, { color: colors.onAccent }]}>
          {unbrokenSpotNumber(spot)}
        </Text>
        <Text style={[typography.bodyStrong, { color: colors.onAccent }]}>
          {i18n.t('session.spotPanelPlace', { level: spot.levelCode, aisle: spot.aisleCode })}
        </Text>
      </View>
      <StateMark color={markColor}>
        {statusContent ?? <Text style={[typography.bodyStrong, { color: colors.ink }]}>{statusLabel}</Text>}
      </StateMark>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.small },
  panel: { borderWidth: PANEL_BORDER_WIDTH, paddingHorizontal: spacing.medium, paddingVertical: spacing.medium, gap: spacing.extraSmall },
  eyebrowRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.small },
  eyebrow: { fontFamily: fontFamilies.monoSemiBold, flexShrink: 1 },
  level: { borderWidth: 2, paddingHorizontal: spacing.small, paddingVertical: 2 },
});
