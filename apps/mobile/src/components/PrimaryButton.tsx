import { Pressable, StyleSheet, Text } from 'react-native';
import { useColors } from '../theme/useColors';
import { MINIMUM_TOUCH_TARGET, spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

// Past twice the size, a long word like « Se déconnecter » breaks in the middle on a phone.
const BUTTON_LABEL_MAX_FONT_SCALE = 2;

interface PrimaryButtonProps {
  readonly label: string;
  readonly onPress: () => void;
}

export function PrimaryButton({ label, onPress }: PrimaryButtonProps) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: colors.ink, opacity: pressed ? 0.8 : 1 }]}
    >
      <Text maxFontSizeMultiplier={BUTTON_LABEL_MAX_FONT_SCALE} style={[typography.button, { color: colors.onInk }]}>
        {label}
      </Text>
    </Pressable>
  );
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
