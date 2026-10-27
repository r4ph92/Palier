import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type AccessibilityRole } from 'react-native';
import { useColors } from '../theme/useColors';
import { spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

interface MessageStateProps {
  readonly message: string;
  readonly hint: string;
  readonly action?: ReactNode;
  readonly messageRole?: AccessibilityRole;
}

export function MessageState({ message, hint, action, messageRole = 'text' }: MessageStateProps) {
  const colors = useColors();
  return (
    <View style={styles.container}>
      <Text accessibilityRole={messageRole} style={[typography.bodyStrong, { color: colors.ink }]}>
        {message}
      </Text>
      <Text style={[typography.body, { color: colors.muted }]}>{hint}</Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.small, paddingVertical: spacing.extraLarge },
});
