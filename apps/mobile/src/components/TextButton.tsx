import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '../theme/useColors';
import { MINIMUM_TOUCH_TARGET } from '../theme/tokens';
import { typography } from '../theme/typography';

interface TextButtonProps {
  readonly label: string;
  readonly busyLabel?: string;
  readonly onPress: () => void;
  readonly isBusy?: boolean;
  // Names the button for VoiceOver when the shown word alone is ambiguous, like « Modifier » in a list.
  readonly accessibilityLabel?: string;
  // 'start' when the button begins a line, so a short label lines up with the text above it.
  readonly align?: 'start' | 'end';
}

const BUSY_OPACITY = 0.6;

export function TextButton({ label, busyLabel = label, onPress, isBusy = false, accessibilityLabel, align = 'end' }: TextButtonProps) {
  const shownLabel = isBusy ? busyLabel : label;
  const longerLabel = busyLabel.length > label.length ? busyLabel : label;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? shownLabel}
      accessibilityState={{ busy: isBusy }}
      disabled={isBusy}
      onPress={onPress}
      style={({ pressed }) => [styles.button, align === 'start' && styles.start, { opacity: isBusy || pressed ? BUSY_OPACITY : 1 }]}
    >
      <ButtonLabel shown={shownLabel} longest={longerLabel} align={align} />
    </Pressable>
  );
}

function ButtonLabel({ shown, longest, align }: { readonly shown: string; readonly longest: string; readonly align: 'start' | 'end' }) {
  const colors = useColors();
  return (
    <View>
      <Text accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[typography.textButton, styles.widthKeeper]}>
        {longest}
      </Text>
      <Text style={[typography.textButton, styles.shownLabel, align === 'start' ? styles.labelStart : styles.labelEnd, { color: colors.ink }]}>{shown}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    minHeight: MINIMUM_TOUCH_TARGET,
    minWidth: MINIMUM_TOUCH_TARGET,
  },
  widthKeeper: { opacity: 0 },
  start: { alignItems: 'flex-start' },
  shownLabel: { position: 'absolute' },
  labelStart: { left: 0 },
  labelEnd: { right: 0 },
});
