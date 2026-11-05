import { Text } from 'react-native';
import { StateMark } from '../components/StateMark';
import { useAnnouncement } from '../components/useAnnouncement';
import { i18n } from '../i18n/i18n';
import type { SpotHoldFailure } from '../spotHolds/useSpotHold';
import { useColors } from '../theme/useColors';
import { typography } from '../theme/typography';

interface SpotHoldProblemProps {
  readonly failure: SpotHoldFailure;
}

// Announced when it appears: the driver's focus stays on the button they tapped.
export function SpotHoldProblem({ failure }: SpotHoldProblemProps) {
  const colors = useColors();
  const message = failureMessage(failure);
  useAnnouncement(message);
  return (
    <StateMark color={colors.danger}>
      <Text accessibilityRole="alert" style={[typography.bodyStrong, { color: colors.ink }]}>
        {message}
      </Text>
    </StateMark>
  );
}

function failureMessage(failure: SpotHoldFailure): string {
  switch (failure.kind) {
    case 'refused':
      return i18n.t(`spotHold.refusals.${failure.refusal}`);
    case 'notResponding':
      return i18n.t('scan.notResponding');
    case 'unreachable':
      return i18n.t('home.unreachable');
  }
}
