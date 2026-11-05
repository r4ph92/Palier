import { StyleSheet, Text, View } from 'react-native';
import { StateMark } from '../components/StateMark';
import { formatClockTime } from '../i18n/formatClockTime';
import { formatCountdown } from '../i18n/formatCountdown';
import { currentLanguage, i18n } from '../i18n/i18n';
import type { HeldSpot } from '../spotHolds/heldSpot';
import { useFreshHoldFocus } from '../spotHolds/useFreshHoldFocus';
import { useSecondsLeft } from '../spotHolds/useSecondsLeft';
import { useColors } from '../theme/useColors';
import { spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

const SECONDS_PER_MINUTE = 60;

interface SpotHoldBannerProps {
  readonly held: HeldSpot;
  readonly onFreshHoldShown: () => void;
}

// VoiceOver reads the banner as one sentence in whole minutes; the ticking digits stay out of its way.
export function SpotHoldBanner({ held, onFreshHoldShown }: SpotHoldBannerProps) {
  const colors = useColors();
  const seconds = useSecondsLeft(held);
  const focusRef = useFreshHoldFocus(held.isFresh, onFreshHoldShown);
  const guaranteedUntil = guaranteedUntilOf(held);
  return (
    <View
      ref={focusRef}
      accessible
      accessibilityLabel={bannerLabel(guaranteedUntil, held.spotHold.lotName, seconds)}
      testID="spot-hold-banner"
      style={[styles.banner, { borderColor: colors.line }]}
    >
      <BannerLines guaranteedUntil={guaranteedUntil} lotName={held.spotHold.lotName} seconds={seconds} />
    </View>
  );
}

interface BannerLinesProps {
  readonly guaranteedUntil: string;
  readonly lotName: string;
  readonly seconds: number;
}

function BannerLines({ guaranteedUntil, lotName, seconds }: BannerLinesProps) {
  const colors = useColors();
  return (
    <>
      <StateMark color={colors.free}>
        <Text style={[typography.bodyStrong, { color: colors.ink }]}>{guaranteedUntil}</Text>
      </StateMark>
      <Text style={[typography.body, { color: colors.muted }]}>{lotName}</Text>
      <Text testID="spot-hold-countdown" style={[typography.countNumber, { color: colors.ink }]}>
        {formatCountdown(seconds)}
      </Text>
    </>
  );
}

function guaranteedUntilOf(held: HeldSpot): string {
  return i18n.t('spotHold.guaranteedUntil', { time: formatClockTime(new Date(held.spotHold.expiresAt), currentLanguage()) });
}

function bannerLabel(guaranteedUntil: string, lotName: string, seconds: number): string {
  const minutesLeft = i18n.t('spotHold.minutesLeft', { count: Math.ceil(seconds / SECONDS_PER_MINUTE) });
  return i18n.t('spotHold.bannerAccessibilityLabel', { guaranteedUntil, lotName, minutesLeft });
}

const styles = StyleSheet.create({
  banner: { gap: spacing.extraSmall, paddingVertical: spacing.medium, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
});
