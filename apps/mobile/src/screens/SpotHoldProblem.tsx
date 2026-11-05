import { useEffect } from 'react';
import { Text } from 'react-native';
import { StateMark } from '../components/StateMark';
import { useAnnouncement } from '../components/useAnnouncement';
import { i18n } from '../i18n/i18n';
import type { SpotHoldFailure, SpotHoldFailureReason } from '../spotHolds/spotHoldFailure';
import { useColors } from '../theme/useColors';
import { typography } from '../theme/typography';

interface SpotHoldProblemProps {
  readonly failure: SpotHoldFailure;
  readonly onAnnounced: () => void;
}

// Announced once, when the driver's tap fails: their focus stays on the button they tapped, and a tab return stays quiet.
export function SpotHoldProblem({ failure, onAnnounced }: SpotHoldProblemProps) {
  const colors = useColors();
  const message = failureMessage(failure.reason);
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

function failureMessage(reason: SpotHoldFailureReason): string {
  switch (reason.kind) {
    case 'refused':
      return i18n.t(`spotHold.refusals.${reason.refusal}`);
    case 'notResponding':
      return i18n.t('scan.notResponding');
    case 'unreachable':
      return i18n.t('home.unreachable');
  }
}
