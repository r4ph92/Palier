import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '../theme/useColors';
import { spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

interface MessageStateProps {
  readonly message: string;
  readonly hint: string;
  readonly action?: ReactNode;
}

export function MessageState({ message, hint, action }: MessageStateProps) {
  const colors = useColors();
  return (
    <View style={styles.container}>
      <Text accessibilityRole="alert" style={[typography.bodyStrong, { color: colors.ink }]}>
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
