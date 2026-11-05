import { StyleSheet, Text, View } from 'react-native';
import { StateMark } from '../components/StateMark';
import { formatClockTime } from '../i18n/formatClockTime';
import { formatCountdown, SECONDS_PER_MINUTE } from '../i18n/formatCountdown';
import { currentLanguage, i18n } from '../i18n/i18n';
import type { HeldSpot } from '../spotHolds/heldSpot';
import { useFreshHoldFocus } from '../spotHolds/useFreshHoldFocus';
import { useExpiryAnnouncement } from '../spotHolds/useExpiryAnnouncement';
import { useColors } from '../theme/useColors';
import { spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

interface SpotHoldBannerProps {
  readonly held: HeldSpot;
  readonly seconds: number;
  readonly isExpired: boolean;
  readonly onFreshHoldShown: () => void;
}

// VoiceOver reads the banner as one sentence in whole minutes; the ticking digits stay out of its way.
export function SpotHoldBanner({ held, seconds, isExpired, onFreshHoldShown }: SpotHoldBannerProps) {
  const expiredMessage = i18n.t('spotHold.expired');
  useExpiryAnnouncement(isExpired, expiredMessage);
  const focusRef = useFreshHoldFocus(held.isFresh, onFreshHoldShown);
  const time = formatClockTime(new Date(held.spotHold.expiresAt), currentLanguage());
  return (
    <View
      ref={focusRef}
      accessible
      accessibilityLabel={isExpired ? expiredLabel(held.spotHold.lotName) : countdownLabel(time, held.spotHold.lotName, seconds)}
      testID="spot-hold-banner"
      style={styles.banner}
    >
      {isExpired ? <ExpiredLines lotName={held.spotHold.lotName} message={expiredMessage} /> : <CountdownLines time={time} lotName={held.spotHold.lotName} seconds={seconds} />}
    </View>
  );
}

interface CountdownLinesProps {
  readonly time: string;
  readonly lotName: string;
  readonly seconds: number;
}

function CountdownLines({ time, lotName, seconds }: CountdownLinesProps) {
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

interface ExpiredLinesProps {
  readonly lotName: string;
  readonly message: string;
}

// The message takes the countdown's place; the mark fades to muted because the hold guarantees nothing any more.
function ExpiredLines({ lotName, message }: ExpiredLinesProps) {
  const colors = useColors();
  return (
    <>
      <StateMark color={colors.muted}>
        <Text testID="spot-hold-expired" style={[typography.bodyStrong, { color: colors.ink }]}>
          {message}
        </Text>
      </StateMark>
      <Text style={[typography.body, { color: colors.muted }]}>{lotName}</Text>
    </>
  );
}

function expiredLabel(lotName: string): string {
  return i18n.t('spotHold.expiredAccessibilityLabel', { expired: i18n.t('spotHold.expired'), lotName });
}

function countdownLabel(time: string, lotName: string, seconds: number): string {
  const guaranteedUntil = i18n.t('spotHold.guaranteedUntil', { time });
  const minutesLeft = i18n.t('spotHold.minutesLeft', { count: Math.ceil(seconds / SECONDS_PER_MINUTE) });
  return i18n.t('spotHold.bannerAccessibilityLabel', { guaranteedUntil, lotName, minutesLeft });
}

const styles = StyleSheet.create({
  banner: { gap: spacing.extraSmall },
});
