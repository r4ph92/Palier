import { useEffect } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { LotsClient } from '../api/LotsClient';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { LotListLoading } from '../components/LotListLoading';
import { LotRow } from '../components/LotRow';
import { ScreenHeader } from '../components/ScreenHeader';
import { SpotHoldButton } from '../components/SpotHoldButton';
import { TextButton } from '../components/TextButton';
import { formatClockTime } from '../i18n/formatClockTime';
import { formatDistance } from '../i18n/formatDistance';
import { currentLanguage, i18n } from '../i18n/i18n';
import type { DeviceLocationClient } from '../deviceLocation/DeviceLocationClient';
import type { DriverLocation } from '../deviceLocation/locateDriver';
import { NEARBY_RADIUS_METRES, type NearbyLot } from '../lots/nearbyLots';
import { useLots, type LotsController, type LotsState } from '../lots/useLots';
import type { SpotHoldController } from '../spotHolds/useSpotHold';
import { useColors } from '../theme/useColors';
import { spacing } from '../theme/tokens';
import { typography } from '../theme/typography';
import { LocationNotice } from './LocationNotice';
import { SpotHoldBanner } from './SpotHoldBanner';
import { SpotHoldProblem } from './SpotHoldProblem';

const NO_LOTS: readonly NearbyLot[] = [];

interface HomeScreenProps {
  readonly firstName: string;
  readonly lotsClient: LotsClient;
  readonly locationClient: DeviceLocationClient;
  readonly spotHold: SpotHoldController;
}

interface HomeHeaderProps {
  readonly controller: LotsController;
  readonly firstName: string;
  readonly spotHold: SpotHoldController;
}

// A new hold refreshes the list, so the lot's count shows the held spot gone.
export function HomeScreen({ firstName, lotsClient, locationClient, spotHold }: HomeScreenProps) {
  const controller = useLots(lotsClient, locationClient);
  useHoldReadOnEveryLotsRead(controller.state, spotHold.refreshHold);
  const colors = useColors();
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.screen, { backgroundColor: colors.canvas }]}>
      <FlatList
        data={controller.state.status === 'loaded' ? controller.state.lots : NO_LOTS}
        keyExtractor={({ lot }) => lot.id}
        renderItem={({ item }) => <LotRow nearbyLot={item} action={<SpotHoldButton lot={item.lot} spotHold={spotHold} onHeld={controller.refresh} />} />}
        ListHeaderComponent={<HomeHeader controller={controller} firstName={firstName} spotHold={spotHold} />}
        ListEmptyComponent={<HomeStateMessage controller={controller} />}
        refreshControl={<RefreshControl refreshing={controller.isRefreshing} onRefresh={controller.refresh} />}
        contentContainerStyle={styles.content}
        testID="lot-list"
      />
    </SafeAreaView>
  );
}

function HomeHeader({ controller, firstName, spotHold }: HomeHeaderProps) {
  const colors = useColors();
  return (
    <View>
      <Text style={[typography.bodyStrong, styles.greeting, { color: colors.ink }]}>{i18n.t('home.greeting', { firstName })}</Text>
      <ScreenHeader
        eyebrow={freshnessStamp(controller.state)}
        title={i18n.t('home.title')}
        action={<TextButton label={i18n.t('home.refresh')} onPress={controller.refresh} />}
      />
      {spotHold.held === null ? null : <SpotHoldBanner held={spotHold.held} onFreshHoldShown={spotHold.acknowledgeFreshHold} />}
      {spotHold.failure === null ? null : <SpotHoldProblem failure={spotHold.failure} onAnnounced={spotHold.acknowledgeFreshFailure} />}
      {controller.state.status === 'loaded' ? <LocationNotice location={controller.state.location} /> : null}
    </View>
  );
}

// Each new list also reads the hold again and clears a problem left from an earlier tap.
function useHoldReadOnEveryLotsRead(state: LotsState, refreshHold: () => void): void {
  useEffect(() => {
    if (state.status === 'loaded') {
      refreshHold();
    }
  }, [state, refreshHold]);
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
      return <LotListLoading />;
    case 'error':
      return <ErrorState onRetry={controller.retry} />;
    case 'loaded':
      return <EmptyState message={emptyMessage(controller.state.location)} />;
  }
}

function emptyMessage(location: DriverLocation): string {
  if (location.status !== 'located') {
    return i18n.t('home.empty');
  }
  return i18n.t('home.emptyNearby', { radius: formatDistance(NEARBY_RADIUS_METRES, currentLanguage()) });
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: spacing.medium },
  greeting: { paddingTop: spacing.small },
});
