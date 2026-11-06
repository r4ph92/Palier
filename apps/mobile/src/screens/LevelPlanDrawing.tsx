import type { AssignedSpot, PlanAisle } from '@palier/shared-types';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SpotNumberText } from '../components/SpotNumberText';
import { StateMark } from '../components/StateMark';
import { i18n } from '../i18n/i18n';
import { LIST_SEPARATOR } from '../i18n/spaces';
import { planImageLabel } from '../parkingSessions/parkingGuidance';
import type { AisleFrame, PlanGeometry } from '../parkingSessions/planGeometry';
import { useColors } from '../theme/useColors';
import { useIsLargeText } from '../theme/useIsLargeText';
import { spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

// A level drawn tall and narrow must not push the amount several screens down.
export const MAXIMUM_SCREEN_SHARE = 0.6;
// Below this width an aisle name would wrap letter by letter, so the markers move under the drawing.
const MINIMUM_DRAWING_WIDTH = 120;
const ASSIGNED_BORDER_WIDTH = 3;
const AISLE_BORDER_WIDTH = 1;

interface PlanMarking {
  readonly spot: AssignedSpot;
  readonly currentAisle: PlanAisle | null;
}

interface LevelPlanDrawingProps extends PlanMarking {
  readonly geometry: PlanGeometry;
}

// One image for VoiceOver; the aisles inside are drawn for the eye. With large text or a drawing too narrow for them the markers move under the
// drawing, where they can wrap, and only the aisle names stay inside the rectangles.
export function LevelPlanDrawing({ geometry, spot, currentAisle }: LevelPlanDrawingProps) {
  const frame: DrawingFrame = useDrawingFrame(geometry.aspectRatio);
  const showsMarkers = !useIsLargeText() && frame.width >= MINIMUM_DRAWING_WIDTH;
  const marking = { spot, currentAisle };
  const label = planImageLabel(spot, currentAisle, geometry.frames.map(({ aisle }) => aisle.code));
  return (
    <View style={styles.group}>
      <View accessible accessibilityRole="image" accessibilityLabel={label} style={[styles.drawing, { aspectRatio: frame.aspectRatio, maxWidth: frame.width }]}>
        {geometry.frames.map((frame) => (
          <AisleRectangleView key={frame.aisle.code} frame={frame} marking={marking} showsMarkers={showsMarkers} />
        ))}
      </View>
      {showsMarkers ? null : <PlanLegend {...marking} />}
    </View>
  );
}

interface DrawingFrame {
  readonly aspectRatio: number;
  readonly width: number;
}

// Full width, unless that would make the drawing taller than its share of the screen: then narrower, same proportions.
function useDrawingFrame(aspectRatio: number): DrawingFrame {
  const { width, height } = useWindowDimensions();
  return { aspectRatio, width: Math.min(width, height * MAXIMUM_SCREEN_SHARE * aspectRatio) };
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
    <SpotNumberText
      spot={spot}
      lead={`${lead}${i18n.t('session.plan.spotLead')}`}
      style={[typography.body, { color: colors.ink }]}
      numberStyle={typography.figure}
    />
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
  drawing: { width: '100%', alignSelf: 'center' },
  aisle: { position: 'absolute', padding: spacing.small, gap: spacing.extraSmall },
});
