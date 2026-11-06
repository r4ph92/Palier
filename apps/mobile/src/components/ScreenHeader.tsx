import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '../theme/useColors';
import { useIsLargeText } from '../theme/useIsLargeText';
import { spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

export const TITLE_MAX_FONT_SCALE = 1.4;

// Past twice the size, long words like « renseignements » break in the middle on a phone, so body text stops there.
export const BODY_TEXT_MAX_FONT_SCALE = 2;

interface ScreenHeaderProps {
  readonly eyebrow?: string;
  readonly title: string;
  readonly action?: ReactNode;
}

export function ScreenHeader({ eyebrow, title, action }: ScreenHeaderProps) {
  const colors = useColors();
  return (
    <View style={[styles.header, { borderBottomColor: colors.ink }]}>
      {eyebrow === undefined && action === undefined ? null : <EyebrowRow eyebrow={eyebrow} action={action} />}
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

function EyebrowRow({ eyebrow, action }: { readonly eyebrow: string | undefined; readonly action: ReactNode }) {
  const colors = useColors();
  const layout = useIsLargeText() ? stackedStyles : sideBySideStyles;
  return (
    <View testID="header-eyebrow-row" style={layout.eyebrowRow}>
      {eyebrow === undefined ? null : <Text style={[typography.eyebrow, layout.eyebrow, { color: colors.muted }]}>{eyebrow}</Text>}
      {action}
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
