import type { ComponentRef, ReactNode, RefObject } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors } from '../theme/useColors';
import { spacing } from '../theme/tokens';

interface ScreenFrameProps {
  readonly children: ReactNode;
  readonly scrollRef?: RefObject<ComponentRef<typeof ScrollView> | null>;
}

// The scrolling frame shared by the screens that can outgrow a phone at large text sizes.
export function ScreenFrame({ children, scrollRef }: ScreenFrameProps) {
  const colors = useColors();
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.canvas }]}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, gap: spacing.medium, paddingHorizontal: spacing.medium },
});
