import { useCallback, useEffect } from 'react';
import { AccessibilityInfo, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { LotsClient } from '../api/LotsClient';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { LotListLoading } from '../components/LotListLoading';
import { LotRow } from '../components/LotRow';
import { ScreenHeader } from '../components/ScreenHeader';
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
import { HeldSpotSection } from './HeldSpotSection';
import { LotSpotHold } from './LotSpotHold';

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
  readonly onRefresh: () => void;
  readonly onReleased: () => void;
}

// A new hold or a release refreshes the list, so the lot's count shows the spot gone or back.
export function HomeScreen({ firstName, lotsClient, locationClient, spotHold }: HomeScreenProps) {
  const controller = useLots(lotsClient, locationClient);
  const refreshByDriver = useHomeRefresh(controller, spotHold);
  const onReleased = useReleasedHold(controller.refresh);
  const colors = useColors();
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.screen, { backgroundColor: colors.canvas }]}>
      <FlatList
        data={controller.state.status === 'loaded' ? controller.state.lots : NO_LOTS}
        keyExtractor={({ lot }) => lot.id}
        renderItem={({ item }) => <LotRow nearbyLot={item} action={<LotSpotHold lot={item.lot} spotHold={spotHold} onHeld={controller.refresh} />} />}
        ListHeaderComponent={<HomeHeader controller={controller} firstName={firstName} spotHold={spotHold} onRefresh={refreshByDriver} onReleased={onReleased} />}
        ListEmptyComponent={<HomeStateMessage controller={controller} />}
        refreshControl={<RefreshControl refreshing={controller.isRefreshing} onRefresh={refreshByDriver} />}
        contentContainerStyle={styles.content}
        testID="lot-list"
      />
    </SafeAreaView>
  );
}

function HomeHeader({ controller, firstName, spotHold, onRefresh, onReleased }: HomeHeaderProps) {
  const colors = useColors();
  return (
    <View>
      <Text style={[typography.bodyStrong, styles.greeting, { color: colors.ink }]}>{i18n.t('home.greeting', { firstName })}</Text>
      <ScreenHeader
        eyebrow={freshnessStamp(controller.state)}
        title={i18n.t('home.title')}
        action={<TextButton label={i18n.t('home.refresh')} onPress={onRefresh} />}
      />
      <HeldSpotSection spotHold={spotHold} onReleased={onReleased} />
      {controller.state.status === 'loaded' ? <LocationNotice location={controller.state.location} /> : null}
    </View>
  );
}

// A list read retries a hold read that failed; once the hold is known, only the driver's own refresh reads it again
// and clears the problem left by an earlier tap. Returns that refresh.
function useHomeRefresh(controller: LotsController, spotHold: SpotHoldController): () => void {
  const { state, refresh } = controller;
  const { readState, refreshHold, dismissProblem } = spotHold;
  useEffect(() => {
    if (state.status === 'loaded' && readState === 'unknown') {
      refreshHold();
    }
  }, [state, readState, refreshHold]);
  return useCallback(() => {
    dismissProblem();
    refreshHold();
    refresh();
  }, [dismissProblem, refreshHold, refresh]);
}

function useReleasedHold(refresh: () => void): () => void {
  return useCallback(() => {
    AccessibilityInfo.announceForAccessibility(i18n.t('spotHold.released'));
    refresh();
  }, [refresh]);
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
