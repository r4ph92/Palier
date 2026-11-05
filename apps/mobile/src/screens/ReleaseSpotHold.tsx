import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { TextButton } from '../components/TextButton';
import { useAccessibilityFocusOnMount } from '../components/useAccessibilityFocusOnMount';
import { i18n } from '../i18n/i18n';
import type { SpotHoldController } from '../spotHolds/useSpotHold';
import { useColors } from '../theme/useColors';
import { spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

interface ReleaseSpotHoldProps {
  readonly lotName: string;
  readonly spotHold: SpotHoldController;
  readonly onReleased: () => void;
}

// Giving the spot back cannot be undone, so « Libérer » asks once, in place: an Alert would hide the banner and cannot be tested.
export function ReleaseSpotHold({ lotName, spotHold, onReleased }: ReleaseSpotHoldProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const confirm = () => {
    setIsConfirming(false);
    spotHold.release(onReleased);
  };
  if (isConfirming) {
    return <ReleaseConfirmation onConfirm={confirm} onCancel={() => setIsConfirming(false)} />;
  }
  return <ReleaseButton lotName={lotName} isReleasing={spotHold.isReleasing} onPress={() => setIsConfirming(true)} />;
}

interface ReleaseButtonProps {
  readonly lotName: string;
  readonly isReleasing: boolean;
  readonly onPress: () => void;
}

function ReleaseButton({ lotName, isReleasing, onPress }: ReleaseButtonProps) {
  const labelKey = isReleasing ? 'spotHold.releasingAccessibilityLabel' : 'spotHold.releaseAccessibilityLabel';
  return (
    <TextButton
      label={i18n.t('spotHold.release')}
      busyLabel={i18n.t('spotHold.releasing')}
      isBusy={isReleasing}
      accessibilityLabel={i18n.t(labelKey, { lotName })}
      align="start"
      onPress={onPress}
    />
  );
}

interface ReleaseConfirmationProps {
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

// The prompt replaces the button the driver tapped, so VoiceOver follows it.
function ReleaseConfirmation({ onConfirm, onCancel }: ReleaseConfirmationProps) {
  const colors = useColors();
  const focusRef = useAccessibilityFocusOnMount();
  return (
    <View>
      <Text ref={focusRef} accessible style={[typography.bodyStrong, { color: colors.ink }]}>
        {i18n.t('spotHold.releasePrompt')}
      </Text>
      <View style={styles.choices}>
        <TextButton label={i18n.t('spotHold.releaseConfirm')} align="start" onPress={onConfirm} />
        <TextButton label={i18n.t('spotHold.releaseCancel')} align="start" onPress={onCancel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  choices: { flexDirection: 'row', gap: spacing.large },
});
