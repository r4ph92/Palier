import type { Vehicle } from '@palier/shared-types';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { VehicleClient } from '../api/VehicleClient';
import { ErrorState } from '../components/ErrorState';
import { MessageState } from '../components/MessageState';
import { ScreenHeader } from '../components/ScreenHeader';
import { i18n } from '../i18n/i18n';
import { useVehicles, type VehiclesController } from '../vehicles/useVehicles';
import { useColors } from '../theme/useColors';
import { spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

const NO_VEHICLES: readonly Vehicle[] = [];

interface VehiclesScreenProps {
  readonly firstName: string;
  readonly client: VehicleClient;
}

export function VehiclesScreen({ firstName, client }: VehiclesScreenProps) {
  const controller = useVehicles(client);
  const colors = useColors();
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.screen, { backgroundColor: colors.canvas }]}>
      <FlatList
        data={controller.state.status === 'loaded' ? controller.state.vehicles : NO_VEHICLES}
        keyExtractor={(vehicle) => vehicle.id}
        renderItem={({ item, index }) => <VehicleRow vehicle={item} isDefault={index === 0} />}
        ListHeaderComponent={<ScreenHeader eyebrow={firstName} title={i18n.t('vehicles.title')} />}
        ListEmptyComponent={<VehiclesStateMessage controller={controller} />}
        contentContainerStyle={styles.content}
        testID="vehicle-list"
      />
    </SafeAreaView>
  );
}

// The first vehicle is the default one. Choosing it is out of scope until several vehicles are managed.
function VehicleRow({ vehicle, isDefault }: { readonly vehicle: Vehicle; readonly isDefault: boolean }) {
  const colors = useColors();
  return (
    <View accessible testID={`vehicle-row-${vehicle.id}`} style={[styles.row, { borderBottomColor: colors.line }]}>
      <Text style={[typography.lotName, { color: colors.ink }]}>{`${vehicle.plate} · ${vehicle.province}`}</Text>
      {isDefault ? <Text style={[typography.eyebrow, { color: colors.muted }]}>{i18n.t('vehicles.defaultBadge')}</Text> : null}
    </View>
  );
}

function VehiclesStateMessage({ controller }: { readonly controller: VehiclesController }) {
  const colors = useColors();
  switch (controller.state.status) {
    case 'loading':
      return <Text style={[typography.body, { color: colors.muted }]}>{i18n.t('vehicles.loading')}</Text>;
    case 'error':
      return <ErrorState onRetry={controller.reload} />;
    case 'loaded':
      return controller.state.vehicles.length === 0 ? (
        <MessageState message={i18n.t('vehicles.empty')} hint={i18n.t('vehicles.emptyHint')} />
      ) : null;
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: spacing.medium },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.medium,
    paddingVertical: spacing.medium,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
