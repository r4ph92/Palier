import type { AssignedSpot, CurrentParkingSession, PlanAisle } from '@palier/shared-types';
import { StyleSheet, Text, View } from 'react-native';
import { SpotNumberText } from '../components/SpotNumberText';
import { useAnnouncement } from '../components/useAnnouncement';
import { i18n } from '../i18n/i18n';
import { aisleSentence } from '../parkingSessions/parkingGuidance';
import { planGeometryOf } from '../parkingSessions/planGeometry';
import { useColors } from '../theme/useColors';
import { spacing } from '../theme/tokens';
import { typography } from '../theme/typography';
import { LevelPlanDrawing } from './LevelPlanDrawing';

interface ParkingGuidanceProps {
  readonly session: CurrentParkingSession;
  readonly currentAisle: PlanAisle | null;
}

// The sentence guides without the drawing, so it shows even for a level the operator has not drawn.
export function ParkingGuidance({ session, currentAisle }: ParkingGuidanceProps) {
  const colors = useColors();
  const sentence = currentAisle === null ? null : aisleSentence(session.spot, currentAisle);
  useAnnouncement(sentence);
  const geometry = planGeometryOf(session.levelPlan?.aisles ?? []);
  return (
    <View style={styles.group}>
      {sentence === null ? <GoToSpot spot={session.spot} /> : <Text style={[typography.bodyStrong, { color: colors.ink }]}>{sentence}</Text>}
      {geometry === null ? null : <LevelPlanDrawing geometry={geometry} spot={session.spot} currentAisle={currentAisle} />}
    </View>
  );
}

// The spot number is a figure inside the sentence, in mono (docs/design.md, gesture 3).
function GoToSpot({ spot }: { readonly spot: AssignedSpot }) {
  const colors = useColors();
  return (
    <SpotNumberText
      spot={spot}
      lead={i18n.t('session.plan.goToLead', { aisle: spot.aisleCode })}
      style={[typography.bodyStrong, { color: colors.ink }]}
      numberStyle={typography.figureStrong}
    />
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.medium },
});
