import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '../theme/useColors';
import { MINIMUM_TOUCH_TARGET, spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

// Past twice the size, a long word like « Se déconnecter » breaks in the middle on a phone.
const BUTTON_LABEL_MAX_FONT_SCALE = 2;

interface PrimaryButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly busy?: boolean;
  // Shown while busy, like « Envoi… »; the button keeps the width of the longer label.
  readonly busyLabel?: string;
  readonly disabled?: boolean;
}

const PRESSED_OPACITY = 0.8;
const DISABLED_OPACITY = 0.4;

export function PrimaryButton({ label, onPress, busy = false, busyLabel = label, disabled = false }: PrimaryButtonProps) {
  const colors = useColors();
  const isInactive = busy || disabled;
  const shownLabel = busy ? busyLabel : label;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={shownLabel}
      accessibilityState={{ busy, disabled: isInactive }}
      disabled={isInactive}
      onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: colors.ink, opacity: buttonOpacity(pressed, disabled) }]}
    >
      <ButtonLabel shown={shownLabel} longest={busyLabel.length > label.length ? busyLabel : label} />
    </Pressable>
  );
}

function ButtonLabel({ shown, longest }: { readonly shown: string; readonly longest: string }) {
  const colors = useColors();
  return (
    <View>
      <Text
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        maxFontSizeMultiplier={BUTTON_LABEL_MAX_FONT_SCALE}
        style={[typography.button, styles.widthKeeper]}
      >
        {longest}
      </Text>
      <Text maxFontSizeMultiplier={BUTTON_LABEL_MAX_FONT_SCALE} style={[typography.button, styles.shownLabel, { color: colors.onInk }]}>
        {shown}
      </Text>
    </View>
  );
}

function buttonOpacity(isPressed: boolean, isDisabled: boolean): number {
  if (isDisabled) {
    return DISABLED_OPACITY;
  }
  return isPressed ? PRESSED_OPACITY : 1;
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    minHeight: MINIMUM_TOUCH_TARGET,
    marginTop: spacing.small,
    paddingHorizontal: spacing.large,
  },
  widthKeeper: { opacity: 0 },
  shownLabel: { position: 'absolute', left: 0 },
});
