import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { HeldSpot, HoldCountdown } from '../spotHolds/heldSpot';
import type { ReleaseCallbacks } from '../spotHolds/spotHoldRequests';
import { useExpiredHold } from '../spotHolds/useExpiredHold';
import { useHoldCountdown } from '../spotHolds/useHoldCountdown';
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

type HoldingController = SpotHoldController & { readonly held: HeldSpot };

function isHolding(spotHold: SpotHoldController): spotHold is HoldingController {
  return spotHold.held !== null;
}

export function HeldSpotSection({ spotHold, onRelease }: HeldSpotSectionProps) {
  const countdown = useHoldCountdown(spotHold.held);
  useExpiredHold(countdown, { refreshHold: spotHold.refreshHold, onEnded: onRelease.onGone });
  if (!isHolding(spotHold) || countdown === null) {
    return null;
  }
  return <HeldSpotContent spotHold={spotHold} countdown={countdown} onRelease={onRelease} />;
}

interface HeldSpotContentProps {
  readonly spotHold: HoldingController;
  readonly countdown: HoldCountdown;
  readonly onRelease: ReleaseCallbacks;
}

// The banner is one accessible group, so the release button and its problem sit beside it, not inside it.
// An expired hold has nothing left to release, and the refusal that says so would repeat the banner.
function HeldSpotContent({ spotHold, countdown, onRelease }: HeldSpotContentProps) {
  const colors = useColors();
  const [holdsFocus, setHoldsFocus] = useState(false);
  const isExpired = countdown.kind === 'expired';
  const failure = bannerFailureOf(spotHold.failure, isExpired);
  return (
    <View style={[styles.section, { borderColor: colors.line }]}>
      <SpotHoldBanner
        held={spotHold.held}
        countdown={countdown}
        takesFocusOnExpiry={holdsFocus}
        onFreshHoldShown={spotHold.acknowledgeFreshHold}
      />
      {isExpired ? null : <ReleaseControl spotHold={spotHold} onRelease={onRelease} onHoldsFocusChange={setHoldsFocus} />}
      {failure === null ? null : <SpotHoldProblem failure={failure} onAnnounced={spotHold.acknowledgeFreshFailure} />}
    </View>
  );
}

interface ReleaseControlProps {
  readonly spotHold: HoldingController;
  readonly onRelease: ReleaseCallbacks;
  readonly onHoldsFocusChange: (holdsFocus: boolean) => void;
}

function ReleaseControl({ spotHold, onRelease, onHoldsFocusChange }: ReleaseControlProps) {
  return (
    <ReleaseSpotHold
      lotName={spotHold.held.spotHold.lotName}
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
