import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '../theme/useColors';
import { useIsLargeText } from '../theme/useIsLargeText';
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
  const layout = useIsLargeText() ? stackedStyles : sideBySideStyles;
  return (
    <View style={[styles.header, { borderBottomColor: colors.ink }]}>
      <View testID="header-eyebrow-row" style={layout.eyebrowRow}>
        <Text style={[typography.eyebrow, layout.eyebrow, { color: colors.muted }]}>{eyebrow}</Text>
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

const sideBySideStyles = StyleSheet.create({
  eyebrowRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.medium },
  eyebrow: { flexGrow: 1, flexBasis: '60%' },
});

const stackedStyles = StyleSheet.create({
  eyebrowRow: { flexDirection: 'column', alignItems: 'flex-start' },
  eyebrow: {},
});

const styles = StyleSheet.create({
  header: {
    gap: spacing.small,
    paddingTop: spacing.small,
    paddingBottom: spacing.medium,
    borderBottomWidth: 2,
  },
});
