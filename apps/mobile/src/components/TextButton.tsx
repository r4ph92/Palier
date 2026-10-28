import { Pressable, StyleSheet, Text } from 'react-native';
import { useColors } from '../theme/useColors';
import { MINIMUM_TOUCH_TARGET } from '../theme/tokens';
import { typography } from '../theme/typography';

interface TextButtonProps {
  readonly label: string;
  readonly onPress: () => void;
}

export function TextButton({ label, onPress }: TextButtonProps) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Text style={[typography.textButton, { color: colors.ink }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    minHeight: MINIMUM_TOUCH_TARGET,
    minWidth: MINIMUM_TOUCH_TARGET,
  },
});
