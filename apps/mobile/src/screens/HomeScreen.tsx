import type { LotSummary } from '@palier/shared-types';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLotsClient } from '../api/LotsClientContext';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { LoadingState } from '../components/LoadingState';
import { LotRow } from '../components/LotRow';
import { ScreenHeader } from '../components/ScreenHeader';
import { TextButton } from '../components/TextButton';
import { formatClockTime } from '../i18n/formatClockTime';
import { currentLanguage, i18n } from '../i18n/i18n';
import { useLots, type LotsController, type LotsState } from '../lots/useLots';
import { useColors } from '../theme/useColors';
import { spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

const NO_LOTS: readonly LotSummary[] = [];

interface HomeScreenProps {
  readonly firstName: string;
}

export function HomeScreen({ firstName }: HomeScreenProps) {
  const controller = useLots(useLotsClient());
  const colors = useColors();
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.screen, { backgroundColor: colors.canvas }]}>
      <FlatList
        data={controller.state.status === 'loaded' ? controller.state.lots : NO_LOTS}
        keyExtractor={(lot) => lot.id}
        renderItem={({ item }) => <LotRow lot={item} />}
        ListHeaderComponent={<HomeHeader controller={controller} firstName={firstName} />}
        ListEmptyComponent={<HomeStateMessage controller={controller} />}
        refreshControl={<RefreshControl refreshing={controller.isRefreshing} onRefresh={controller.refresh} />}
        contentContainerStyle={styles.content}
        testID="lot-list"
      />
    </SafeAreaView>
  );
}

function HomeHeader({ controller, firstName }: { readonly controller: LotsController; readonly firstName: string }) {
  const colors = useColors();
  return (
    <View>
      <Text style={[typography.bodyStrong, styles.greeting, { color: colors.ink }]}>{i18n.t('home.greeting', { firstName })}</Text>
      <ScreenHeader
        eyebrow={freshnessStamp(controller.state)}
        title={i18n.t('home.title')}
        action={<TextButton label={i18n.t('home.refresh')} onPress={controller.refresh} />}
      />
    </View>
  );
}

function freshnessStamp(state: LotsState): string {
  if (state.status !== 'loaded') {
    return '';
  }
  return i18n.t('home.updatedAt', { time: formatClockTime(state.updatedAt, currentLanguage()) });
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
  greeting: { paddingTop: spacing.small },
});
