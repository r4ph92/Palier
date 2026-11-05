import { StyleSheet, Text, View } from 'react-native';
import { StateMark } from '../components/StateMark';
import { formatClockTime } from '../i18n/formatClockTime';
import { formatCountdown, SECONDS_PER_MINUTE } from '../i18n/formatCountdown';
import { currentLanguage, i18n } from '../i18n/i18n';
import type { HeldSpot } from '../spotHolds/heldSpot';
import { useFreshHoldFocus } from '../spotHolds/useFreshHoldFocus';
import { useSecondsLeft } from '../spotHolds/useSecondsLeft';
import { useColors } from '../theme/useColors';
import { spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

interface SpotHoldBannerProps {
  readonly held: HeldSpot;
  readonly onFreshHoldShown: () => void;
}

// VoiceOver reads the banner as one sentence in whole minutes; the ticking digits stay out of its way.
export function SpotHoldBanner({ held, onFreshHoldShown }: SpotHoldBannerProps) {
  const colors = useColors();
  const seconds = useSecondsLeft(held);
  const focusRef = useFreshHoldFocus(held.isFresh, onFreshHoldShown);
  const time = formatClockTime(new Date(held.spotHold.expiresAt), currentLanguage());
  return (
    <View
      ref={focusRef}
      accessible
      accessibilityLabel={bannerLabel(time, held.spotHold.lotName, seconds)}
      testID="spot-hold-banner"
      style={[styles.banner, { borderColor: colors.line }]}
    >
      <BannerLines time={time} lotName={held.spotHold.lotName} seconds={seconds} />
    </View>
  );
}

interface BannerLinesProps {
  readonly time: string;
  readonly lotName: string;
  readonly seconds: number;
}

function BannerLines({ time, lotName, seconds }: BannerLinesProps) {
  const colors = useColors();
  return (
    <>
      <StateMark color={colors.free}>
        <Text style={[typography.bodyStrong, { color: colors.ink }]}>
          {`${i18n.t('spotHold.guaranteedUntilLead')} `}
          <Text style={typography.figure}>{time}</Text>
        </Text>
      </StateMark>
      <Text style={[typography.body, { color: colors.muted }]}>{lotName}</Text>
      <Text testID="spot-hold-countdown" style={[typography.countNumber, { color: colors.ink }]}>
        {formatCountdown(seconds)}
      </Text>
    </>
  );
}

function bannerLabel(time: string, lotName: string, seconds: number): string {
  const guaranteedUntil = i18n.t('spotHold.guaranteedUntil', { time });
  const minutesLeft = i18n.t('spotHold.minutesLeft', { count: Math.ceil(seconds / SECONDS_PER_MINUTE) });
  return i18n.t('spotHold.bannerAccessibilityLabel', { guaranteedUntil, lotName, minutesLeft });
}

const styles = StyleSheet.create({
  banner: { gap: spacing.extraSmall, paddingVertical: spacing.medium, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
});
