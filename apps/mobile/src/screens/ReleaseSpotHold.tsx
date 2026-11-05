import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { TextButton } from '../components/TextButton';
import { useAccessibilityFocusOnMount } from '../components/useAccessibilityFocusOnMount';
import { i18n } from '../i18n/i18n';
import { useColors } from '../theme/useColors';
import { spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

interface ReleaseSpotHoldProps {
  readonly lotName: string;
  readonly isReleasing: boolean;
  readonly onConfirm: () => void;
  readonly onConfirmingChange: (isConfirming: boolean) => void;
}

// idle: the button as the banner shows it; confirming: the question; answered: the button again, which takes VoiceOver back.
type ReleaseStep = 'idle' | 'confirming' | 'answered';

// Giving the spot back cannot be undone, so « Libérer » asks once, in place: an Alert would hide the banner and cannot be tested.
export function ReleaseSpotHold({ lotName, isReleasing, onConfirm, onConfirmingChange }: ReleaseSpotHoldProps) {
  const [step, setStep] = useState<ReleaseStep>('idle');
  useEffect(() => onConfirmingChange(step === 'confirming'), [step, onConfirmingChange]);
  if (step === 'confirming') {
    return (
      <ReleaseConfirmation
        lotName={lotName}
        onConfirm={() => {
          setStep('answered');
          onConfirm();
        }}
        onCancel={() => setStep('answered')}
      />
    );
  }
  return <ReleaseButton lotName={lotName} isReleasing={isReleasing} takesFocus={step === 'answered'} onPress={() => setStep('confirming')} />;
}

interface ReleaseButtonProps {
  readonly lotName: string;
  readonly isReleasing: boolean;
  readonly takesFocus: boolean;
  readonly onPress: () => void;
}

function ReleaseButton({ lotName, isReleasing, takesFocus, onPress }: ReleaseButtonProps) {
  const focusRef = useAccessibilityFocusOnMount();
  const labelKey = isReleasing ? 'spotHold.releasingAccessibilityLabel' : 'spotHold.releaseAccessibilityLabel';
  return (
    <TextButton
      label={i18n.t('spotHold.release')}
      busyLabel={i18n.t('spotHold.releasing')}
      isBusy={isReleasing}
      accessibilityLabel={i18n.t(labelKey, { lotName })}
      align="start"
      focusRef={takesFocus ? focusRef : undefined}
      onPress={onPress}
    />
  );
}

interface ReleaseConfirmationProps {
  readonly lotName: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

// The prompt replaces the button the driver tapped, so VoiceOver follows it.
function ReleaseConfirmation({ lotName, onConfirm, onCancel }: ReleaseConfirmationProps) {
  const colors = useColors();
  const focusRef = useAccessibilityFocusOnMount();
  return (
    <View testID="release-confirmation" onAccessibilityEscape={onCancel}>
      <Text ref={focusRef} accessible style={[typography.bodyStrong, { color: colors.ink }]}>
        {i18n.t('spotHold.releasePrompt')}
      </Text>
      <View style={styles.choices}>
        <TextButton
          label={i18n.t('spotHold.releaseConfirm')}
          accessibilityLabel={i18n.t('spotHold.releaseConfirmAccessibilityLabel', { lotName })}
          align="start"
          onPress={onConfirm}
        />
        <TextButton label={i18n.t('spotHold.releaseCancel')} align="start" onPress={onCancel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  choices: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.large },
});
