import type { LotSummary } from '@palier/shared-types';
import { FlatList, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLotsClient } from '../api/LotsClientContext';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { LoadingState } from '../components/LoadingState';
import { LotRow } from '../components/LotRow';
import { ScreenHeader } from '../components/ScreenHeader';
import { TextButton } from '../components/TextButton';
import { i18n } from '../i18n/i18n';
import { useLots, type LotsController } from '../lots/useLots';
import { useColors } from '../theme/useColors';
import { spacing } from '../theme/tokens';

const NO_LOTS: readonly LotSummary[] = [];

export function HomeScreen() {
  const controller = useLots(useLotsClient());
  const colors = useColors();
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.canvas }]}>
      <FlatList
        data={controller.state.status === 'loaded' ? controller.state.lots : NO_LOTS}
        keyExtractor={(lot) => lot.id}
        renderItem={({ item }) => <LotRow lot={item} />}
        ListHeaderComponent={<HomeHeader controller={controller} />}
        ListEmptyComponent={<HomeStateMessage controller={controller} />}
        refreshControl={<RefreshControl refreshing={controller.isRefreshing} onRefresh={controller.refresh} />}
        contentContainerStyle={styles.content}
        testID="lot-list"
      />
    </SafeAreaView>
  );
}

function HomeHeader({ controller }: { readonly controller: LotsController }) {
  return (
    <ScreenHeader
      eyebrow={i18n.t('home.eyebrow')}
      title={i18n.t('home.title')}
      action={<TextButton label={i18n.t('home.refresh')} onPress={controller.refresh} />}
    />
  );
}

function HomeStateMessage({ controller }: { readonly controller: LotsController }) {
  switch (controller.state.status) {
    case 'loading':
      return <LoadingState />;
    case 'error':
      return <ErrorState onRetry={controller.retry} />;
    case 'loaded':
      return <EmptyState />;
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: spacing.medium },
});
