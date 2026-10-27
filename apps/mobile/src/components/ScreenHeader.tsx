import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '../theme/useColors';
import { spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

interface ScreenHeaderProps {
  readonly eyebrow: string;
  readonly title: string;
}

export function ScreenHeader({ eyebrow, title }: ScreenHeaderProps) {
  const colors = useColors();
  return (
    <View style={[styles.header, { borderBottomColor: colors.ink }]}>
      <Text style={[typography.eyebrow, { color: colors.muted }]}>{eyebrow}</Text>
      <Text accessibilityRole="header" style={[typography.title, { color: colors.ink }]}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.small,
    paddingTop: spacing.large,
    paddingBottom: spacing.medium,
    borderBottomWidth: 2,
  },
});
