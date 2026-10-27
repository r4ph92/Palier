import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '../theme/useColors';
import { spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

const TITLE_MAX_FONT_SCALE = 1.4;

interface ScreenHeaderProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly action?: ReactNode;
}

export function ScreenHeader({ eyebrow, title, action }: ScreenHeaderProps) {
  const colors = useColors();
  return (
    <View style={[styles.header, { borderBottomColor: colors.ink }]}>
      <View style={styles.eyebrowRow}>
        <Text style={[typography.eyebrow, styles.eyebrow, { color: colors.muted }]}>{eyebrow}</Text>
        {action}
      </View>
      <Text
        accessibilityRole="header"
        maxFontSizeMultiplier={TITLE_MAX_FONT_SCALE}
        style={[typography.title, { color: colors.ink }]}
      >
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.medium },
  eyebrow: { flex: 1 },
  header: {
    gap: spacing.small,
    paddingTop: spacing.small,
    paddingBottom: spacing.medium,
    borderBottomWidth: 2,
  },
});
