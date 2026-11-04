import { Pressable, StyleSheet, Text } from 'react-native';
import { useColors } from '../theme/useColors';
import { MINIMUM_TOUCH_TARGET, spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

// Past twice the size, a long word like « Se déconnecter » breaks in the middle on a phone.
const BUTTON_LABEL_MAX_FONT_SCALE = 2;

interface PrimaryButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly busy?: boolean;
  readonly disabled?: boolean;
}

const PRESSED_OPACITY = 0.8;
const DISABLED_OPACITY = 0.4;

export function PrimaryButton({ label, onPress, busy = false, disabled = false }: PrimaryButtonProps) {
  const colors = useColors();
  const isInactive = busy || disabled;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy, disabled: isInactive }}
      disabled={isInactive}
      onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: colors.ink, opacity: buttonOpacity(pressed, disabled) }]}
    >
      <Text maxFontSizeMultiplier={BUTTON_LABEL_MAX_FONT_SCALE} style={[typography.button, { color: colors.onInk }]}>
        {label}
      </Text>
    </Pressable>
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
});
