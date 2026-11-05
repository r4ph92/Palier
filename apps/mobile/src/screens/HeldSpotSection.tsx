import { StyleSheet, View } from 'react-native';
import type { ReleaseCallbacks } from '../spotHolds/spotHoldRequests';
import type { SpotHoldController } from '../spotHolds/useSpotHold';
import { useColors } from '../theme/useColors';
import { spacing } from '../theme/tokens';
import { ReleaseSpotHold } from './ReleaseSpotHold';
import { SpotHoldBanner } from './SpotHoldBanner';
import { SpotHoldProblem } from './SpotHoldProblem';

interface HeldSpotSectionProps {
  readonly spotHold: SpotHoldController;
  readonly onRelease: ReleaseCallbacks;
}

// The banner is one accessible group, so the release button and its problem sit beside it, not inside it.
export function HeldSpotSection({ spotHold, onRelease }: HeldSpotSectionProps) {
  const colors = useColors();
  const { held, failure } = spotHold;
  if (held === null) {
    return null;
  }
  const bannerFailure = failure?.target.kind === 'heldSpot' ? failure : null;
  return (
    <View style={[styles.section, { borderColor: colors.line }]}>
      <SpotHoldBanner held={held} onFreshHoldShown={spotHold.acknowledgeFreshHold} />
      <ReleaseSpotHold lotName={held.spotHold.lotName} isReleasing={spotHold.isReleasing} onConfirm={() => spotHold.release(onRelease)} />
      {bannerFailure === null ? null : <SpotHoldProblem failure={bannerFailure} onAnnounced={spotHold.acknowledgeFreshFailure} />}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.small, paddingVertical: spacing.medium, borderBottomWidth: StyleSheet.hairlineWidth },
});
