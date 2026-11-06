import type { CurrentParkingSession, PlanAisle } from '@palier/shared-types';
import { StyleSheet, Text, View } from 'react-native';
import { useAnnouncement } from '../components/useAnnouncement';
import { guidanceSentence } from '../parkingSessions/parkingGuidance';
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
  const sentence = guidanceSentence(session.spot, currentAisle);
  useAnnouncement(currentAisle === null ? null : sentence, currentAisle?.beaconMinor);
  const geometry = planGeometryOf(session.levelPlan?.aisles ?? []);
  return (
    <View style={styles.group}>
      <Text style={[typography.bodyStrong, { color: colors.ink }]}>{sentence}</Text>
      {geometry === null ? null : <LevelPlanDrawing geometry={geometry} spot={session.spot} currentAisle={currentAisle} />}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.medium },
});
