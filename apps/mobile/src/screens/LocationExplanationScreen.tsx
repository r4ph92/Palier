import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../components/PrimaryButton';
import { BODY_TEXT_MAX_FONT_SCALE, ScreenHeader } from '../components/ScreenHeader';
import { TextButton } from '../components/TextButton';
import { useAccessibilityFocusOnMount } from '../components/useAccessibilityFocusOnMount';
import { i18n } from '../i18n/i18n';
import { useColors } from '../theme/useColors';
import { spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

interface LocationExplanationScreenProps {
  readonly isPrompting: boolean;
  readonly onContinue: () => void;
  readonly onContinueWithout: () => void;
}

// Shown once per device before the scanner, ahead of the iOS « Always » prompt that the driver cannot read the reason of in full.
export function LocationExplanationScreen({ isPrompting, onContinue, onContinueWithout }: LocationExplanationScreenProps) {
  const colors = useColors();
  const focusRef = useAccessibilityFocusOnMount();
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.screen, { backgroundColor: colors.canvas }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View ref={focusRef} accessible accessibilityRole="header">
          <ScreenHeader eyebrow={i18n.t('locationExplanation.eyebrow')} title={i18n.t('locationExplanation.title')} />
        </View>
        <ExplanationText />
        <Actions isPrompting={isPrompting} onContinue={onContinue} onContinueWithout={onContinueWithout} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Actions({ isPrompting, onContinue, onContinueWithout }: LocationExplanationScreenProps) {
  return (
    <>
      <PrimaryButton label={i18n.t('locationExplanation.continue')} onPress={onContinue} busy={isPrompting} />
      <View style={styles.without}>
        <TextButton
          label={i18n.t('locationExplanation.continueWithout')}
          onPress={onContinueWithout}
          isBusy={isPrompting}
          align="start"
        />
      </View>
    </>
  );
}

function ExplanationText() {
  const colors = useColors();
  return (
    <>
      {(['awake', 'indicator', 'refusal'] as const).map((paragraph) => (
        <Text key={paragraph} maxFontSizeMultiplier={BODY_TEXT_MAX_FONT_SCALE} style={[typography.body, { color: colors.ink }]}>
          {i18n.t(`locationExplanation.${paragraph}`)}
        </Text>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, gap: spacing.medium, paddingHorizontal: spacing.medium, paddingBottom: spacing.large },
  without: { alignItems: 'flex-start' },
});
