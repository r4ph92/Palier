import { StyleSheet, Text, View } from 'react-native';
import { StateMark } from '../components/StateMark';
import { formatClockTime } from '../i18n/formatClockTime';
import { formatCountdown, SECONDS_PER_MINUTE } from '../i18n/formatCountdown';
import { currentLanguage, i18n } from '../i18n/i18n';
import type { HeldSpot, HoldCountdown } from '../spotHolds/heldSpot';
import { useFreshHoldFocus } from '../spotHolds/useFreshHoldFocus';
import { useExpiryNotice } from '../spotHolds/useExpiryNotice';
import { useColors } from '../theme/useColors';
import { spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

interface SpotHoldBannerProps {
  readonly held: HeldSpot;
  readonly countdown: HoldCountdown;
  // True when the driver was in the middle of releasing, so the controls that held VoiceOver's focus vanish at expiry.
  readonly takesFocusOnExpiry: boolean;
  readonly onFreshHoldShown: () => void;
}

// VoiceOver reads the banner as one sentence in whole minutes; the ticking digits stay out of its way.
export function SpotHoldBanner({ held, countdown, takesFocusOnExpiry, onFreshHoldShown }: SpotHoldBannerProps) {
  const expiredMessage = i18n.t('spotHold.expired');
  const expiryRef = useExpiryNotice(countdown.kind === 'expired', expiredMessage, takesFocusOnExpiry);
  const freshHoldRef = useFreshHoldFocus(held.isFresh, onFreshHoldShown);
  const { lotName, expiresAt } = held.spotHold;
  const time = formatClockTime(new Date(expiresAt), currentLanguage());
  return (
    <View ref={freshHoldRef ?? expiryRef} accessible accessibilityLabel={bannerLabel(countdown, { time, lotName, expiredMessage })} testID="spot-hold-banner" style={styles.banner}>
      {countdown.kind === 'expired' ? <ExpiredLines lotName={lotName} message={expiredMessage} /> : <CountdownLines time={time} lotName={lotName} seconds={countdown.secondsLeft} />}
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

interface BannerWords {
  readonly time: string;
  readonly lotName: string;
  readonly expiredMessage: string;
}

function bannerLabel(countdown: HoldCountdown, { time, lotName, expiredMessage }: BannerWords): string {
  if (countdown.kind === 'expired') {
    return i18n.t('spotHold.expiredAccessibilityLabel', { expired: expiredMessage, lotName });
  }
  const guaranteedUntil = i18n.t('spotHold.guaranteedUntil', { time });
  const minutesLeft = i18n.t('spotHold.minutesLeft', { count: Math.ceil(countdown.secondsLeft / SECONDS_PER_MINUTE) });
  return i18n.t('spotHold.bannerAccessibilityLabel', { guaranteedUntil, lotName, minutesLeft });
}

const styles = StyleSheet.create({
  banner: { gap: spacing.extraSmall },
});
