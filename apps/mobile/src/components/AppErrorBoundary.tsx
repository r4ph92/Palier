import { Component, type ErrorInfo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { i18n } from '../i18n/i18n';
import { useColors } from '../theme/useColors';
import { spacing } from '../theme/tokens';
import { MessageState } from './MessageState';

interface AppErrorBoundaryProps {
  readonly children: ReactNode;
}

interface AppErrorBoundaryState {
  readonly hasCrashed: boolean;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  override state: AppErrorBoundaryState = { hasCrashed: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasCrashed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Palier crashed', error, info.componentStack);
  }

  override render(): ReactNode {
    return this.state.hasCrashed ? <CrashedScreen /> : this.props.children;
  }
}

function CrashedScreen() {
  const colors = useColors();
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.canvas }]}>
      <View style={styles.content}>
        <MessageState message={i18n.t('app.crashed')} hint={i18n.t('app.crashedHint')} messageRole="alert" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: spacing.medium },
});
