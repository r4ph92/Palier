import { useEffect } from 'react';
import { Text } from 'react-native';
import { StateMark } from '../components/StateMark';
import { useAnnouncement } from '../components/useAnnouncement';
import { i18n } from '../i18n/i18n';
import type { SpotHoldRefusalCode } from '@palier/shared-types';
import type { SpotHoldFailure, SpotHoldFailureTarget } from '../spotHolds/spotHoldFailure';
import { useColors } from '../theme/useColors';
import { typography } from '../theme/typography';

interface SpotHoldProblemProps {
  readonly failure: SpotHoldFailure;
  readonly onAnnounced: () => void;
}

// Announced once, when the driver's tap fails: their focus stays on the button they tapped, and a tab return stays quiet.
export function SpotHoldProblem({ failure, onAnnounced }: SpotHoldProblemProps) {
  const colors = useColors();
  const message = failureMessage(failure);
  useAnnouncement(failure.isFresh ? message : null);
  useEffect(() => {
    if (failure.isFresh) {
      onAnnounced();
    }
  }, [failure.isFresh, onAnnounced]);
  return (
    <StateMark color={colors.danger}>
      <Text accessibilityRole="alert" style={[typography.bodyStrong, { color: colors.ink }]}>
        {message}
      </Text>
    </StateMark>
  );
}

function failureMessage({ reason, target }: SpotHoldFailure): string {
  switch (reason.kind) {
    case 'refused':
      return refusalMessage(reason.refusal, target);
    case 'notResponding':
      return i18n.t('spotHold.notResponding');
    case 'unreachable':
      return i18n.t('home.unreachable');
  }
}

const RELEASE_MESSAGE_KEYS: Partial<Record<SpotHoldRefusalCode, string>> = {
  HOLD_UNAVAILABLE: 'spotHold.releaseUnavailable',
  HOLD_NOT_FOUND: 'spotHold.releaseNotFound',
};

// A refusal is worded for the action that met it: a release is not a hold request.
function refusalMessage(refusal: SpotHoldRefusalCode, target: SpotHoldFailureTarget): string {
  const releaseKey = target.kind === 'heldSpot' ? RELEASE_MESSAGE_KEYS[refusal] : undefined;
  return i18n.t(releaseKey ?? `spotHold.refusals.${refusal}`);
}
