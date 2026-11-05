import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ReleaseCallbacks } from '../spotHolds/spotHoldRequests';
import { useExpiredHold } from '../spotHolds/useExpiredHold';
import { useHoldCountdown, type RunningHold } from '../spotHolds/useHoldCountdown';
import type { SpotHoldFailure } from '../spotHolds/spotHoldFailure';
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
  const running = useHoldCountdown(spotHold.held);
  useExpiredHold(running?.countdown ?? null, { refreshHold: spotHold.refreshHold, onEnded: onRelease.onGone });
  return running === null ? null : <HeldSpotContent spotHold={spotHold} running={running} onRelease={onRelease} />;
}

interface HeldSpotContentProps {
  readonly spotHold: SpotHoldController;
  readonly running: RunningHold;
  readonly onRelease: ReleaseCallbacks;
}

// The banner is one accessible group, so the release button and its problem sit beside it, not inside it.
// An expired hold has nothing left to release, and the refusal that says so would repeat the banner.
function HeldSpotContent({ spotHold, running: { held, countdown }, onRelease }: HeldSpotContentProps) {
  const colors = useColors();
  const [holdsFocus, setHoldsFocus] = useState(false);
  const isExpired = countdown.kind === 'expired';
  const failure = bannerFailureOf(spotHold.failure, isExpired);
  return (
    <View style={[styles.section, { borderColor: colors.line }]}>
      <SpotHoldBanner
        held={held}
        countdown={countdown}
        takesFocusOnExpiry={holdsFocus}
        onFreshHoldShown={spotHold.acknowledgeFreshHold}
      />
      {isExpired ? null : <ReleaseControl spotHold={spotHold} lotName={held.spotHold.lotName} onRelease={onRelease} onHoldsFocusChange={setHoldsFocus} />}
      {failure === null ? null : <SpotHoldProblem failure={failure} onAnnounced={spotHold.acknowledgeFreshFailure} />}
    </View>
  );
}

interface ReleaseControlProps {
  readonly spotHold: SpotHoldController;
  readonly lotName: string;
  readonly onRelease: ReleaseCallbacks;
  readonly onHoldsFocusChange: (holdsFocus: boolean) => void;
}

function ReleaseControl({ spotHold, lotName, onRelease, onHoldsFocusChange }: ReleaseControlProps) {
  return (
    <ReleaseSpotHold
      lotName={lotName}
      isReleasing={spotHold.isReleasing}
      onConfirm={() => spotHold.release(onRelease)}
      onHoldsFocusChange={onHoldsFocusChange}
    />
  );
}

function bannerFailureOf(failure: SpotHoldFailure | null, isExpired: boolean): SpotHoldFailure | null {
  if (failure?.target.kind !== 'heldSpot') {
    return null;
  }
  const repeatsBanner = isExpired && failure.reason.kind === 'refused' && failure.reason.refusal === 'HOLD_EXPIRED';
  return repeatsBanner ? null : failure;
}

const styles = StyleSheet.create({
  section: { gap: spacing.small, paddingVertical: spacing.medium, borderBottomWidth: StyleSheet.hairlineWidth },
});
