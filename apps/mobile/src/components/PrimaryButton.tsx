import { Pressable, StyleSheet, Text } from 'react-native';
import { useColors } from '../theme/useColors';
import { MINIMUM_TOUCH_TARGET, spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

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
      <Text style={[typography.button, { color: colors.onInk }]}>{label}</Text>
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
