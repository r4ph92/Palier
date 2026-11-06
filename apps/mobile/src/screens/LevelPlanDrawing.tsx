import type { AssignedSpot, PlanAisle } from '@palier/shared-types';
import { StyleSheet, Text, View } from 'react-native';
import { StateMark } from '../components/StateMark';
import { i18n } from '../i18n/i18n';
import { LIST_SEPARATOR } from '../i18n/spaces';
import { planImageLabel, unbrokenSpotNumber } from '../parkingSessions/parkingGuidance';
import type { AisleFrame, PlanGeometry } from '../parkingSessions/planGeometry';
import { useColors } from '../theme/useColors';
import { useIsLargeText } from '../theme/useIsLargeText';
import { spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

const ASSIGNED_BORDER_WIDTH = 3;
const AISLE_BORDER_WIDTH = 1;

interface PlanMarking {
  readonly spot: AssignedSpot;
  readonly currentAisle: PlanAisle | null;
}

interface LevelPlanDrawingProps extends PlanMarking {
  readonly geometry: PlanGeometry;
}

// One image for VoiceOver; the aisles inside are drawn for the eye. With large text the markers move under the
// drawing, where they can wrap, and only the aisle names stay inside the rectangles.
export function LevelPlanDrawing({ geometry, spot, currentAisle }: LevelPlanDrawingProps) {
  const isLargeText = useIsLargeText();
  const marking = { spot, currentAisle };
  return (
    <View style={styles.group}>
      <View accessible accessibilityRole="image" accessibilityLabel={planImageLabel(spot, currentAisle)} style={[styles.drawing, { aspectRatio: geometry.aspectRatio }]}>
        {geometry.frames.map((frame) => (
          <AisleRectangleView key={frame.aisle.code} frame={frame} marking={marking} showsMarkers={!isLargeText} />
        ))}
      </View>
      {isLargeText ? <PlanLegend {...marking} /> : null}
    </View>
  );
}

interface AisleRectangleViewProps {
  readonly frame: AisleFrame;
  readonly marking: PlanMarking;
  readonly showsMarkers: boolean;
}

// The assigned aisle stands out by its thick ink border, its fill and its spot label, never by color alone.
function AisleRectangleView({ frame, marking, showsMarkers }: AisleRectangleViewProps) {
  const colors = useColors();
  const { aisle, ...position } = frame;
  const isAssigned = aisle.code === marking.spot.aisleCode;
  const outline = isAssigned
    ? { borderWidth: ASSIGNED_BORDER_WIDTH, borderColor: colors.ink, backgroundColor: colors.sunken }
    : { borderWidth: AISLE_BORDER_WIDTH, borderColor: colors.muted };
  return (
    <View testID={`PlanAisle-${aisle.code}`} style={[styles.aisle, position, outline]}>
      <Text style={[typography.countLabel, { color: colors.ink }]}>{aisleName(aisle.code)}</Text>
      {showsMarkers && isAssigned ? <SpotName spot={marking.spot} /> : null}
      {showsMarkers && aisle.code === marking.currentAisle?.code ? <YouAreHere /> : null}
    </View>
  );
}

// « Place » in text, the number in mono (docs/design.md, gesture 3).
function SpotName({ spot, lead = '' }: { readonly spot: AssignedSpot; readonly lead?: string }) {
  const colors = useColors();
  return (
    <Text style={[typography.body, { color: colors.ink }]}>
      {lead}
      {i18n.t('session.plan.spotLead')}
      <Text style={typography.figure}>{unbrokenSpotNumber(spot)}</Text>
    </Text>
  );
}

function YouAreHere() {
  const colors = useColors();
  return (
    <StateMark color={colors.ink}>
      <Text style={[typography.bodyStrong, { color: colors.ink }]}>{i18n.t('session.plan.youAreHere')}</Text>
    </StateMark>
  );
}

// Already in the image label and the sentence, so VoiceOver skips it.
function PlanLegend({ spot, currentAisle }: PlanMarking) {
  const colors = useColors();
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <SpotName spot={spot} lead={`${aisleName(spot.aisleCode)}${LIST_SEPARATOR}`} />
      {currentAisle === null ? null : (
        <Text style={[typography.body, { color: colors.ink }]}>{`${aisleName(currentAisle.code)}${LIST_SEPARATOR}${i18n.t('session.plan.youAreHere')}`}</Text>
      )}
    </View>
  );
}

function aisleName(code: string): string {
  return i18n.t('session.plan.aisle', { aisle: code });
}

const styles = StyleSheet.create({
  group: { gap: spacing.small },
  drawing: { width: '100%' },
  aisle: { position: 'absolute', padding: spacing.small, gap: spacing.extraSmall },
});
