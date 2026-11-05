import { StyleSheet, View } from 'react-native';
import type { HeldSpot } from '../spotHolds/heldSpot';
import type { ReleaseCallbacks } from '../spotHolds/spotHoldRequests';
import { useExpiredHoldReread } from '../spotHolds/useExpiredHoldReread';
import { useSecondsLeft } from '../spotHolds/useSecondsLeft';
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

export function HeldSpotSection({ spotHold, onRelease }: HeldSpotSectionProps) {
  return spotHold.held === null ? null : <HoldBanner held={spotHold.held} spotHold={spotHold} onRelease={onRelease} />;
}

interface HoldBannerProps extends HeldSpotSectionProps {
  readonly held: HeldSpot;
}

// The banner is one accessible group, so the release button and its problem sit beside it, not inside it.
// An expired hold has nothing left to release: the button goes and the hold is read again until the server has ended it.
function HoldBanner({ held, spotHold, onRelease }: HoldBannerProps) {
  const colors = useColors();
  const seconds = useSecondsLeft(held);
  const isExpired = seconds === 0;
  useExpiredHoldReread(isExpired, spotHold.refreshHold);
  const bannerFailure = spotHold.failure?.target.kind === 'heldSpot' ? spotHold.failure : null;
  return (
    <View style={[styles.section, { borderColor: colors.line }]}>
      <SpotHoldBanner held={held} seconds={seconds} isExpired={isExpired} onFreshHoldShown={spotHold.acknowledgeFreshHold} />
      {isExpired ? null : <ReleaseSpotHold lotName={held.spotHold.lotName} isReleasing={spotHold.isReleasing} onConfirm={() => spotHold.release(onRelease)} />}
      {bannerFailure === null ? null : <SpotHoldProblem failure={bannerFailure} onAnnounced={spotHold.acknowledgeFreshFailure} />}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.small, paddingVertical: spacing.medium, borderBottomWidth: StyleSheet.hairlineWidth },
});
