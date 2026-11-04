import type { Vehicle } from '@palier/shared-types';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { VehicleClient } from '../api/VehicleClient';
import { ErrorState } from '../components/ErrorState';
import { MessageState } from '../components/MessageState';
import { ScreenHeader } from '../components/ScreenHeader';
import { TextButton } from '../components/TextButton';
import { i18n } from '../i18n/i18n';
import { useIsLargeText } from '../theme/useIsLargeText';
import { declaredNeeds } from '../vehicles/vehicleNeeds';
import { useVehicles, type VehicleActionError, type VehiclesController } from '../vehicles/useVehicles';
import { useColors } from '../theme/useColors';
import { spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

const NO_VEHICLES: readonly Vehicle[] = [];

interface VehiclesScreenProps {
  readonly firstName: string;
  readonly client: VehicleClient;
  readonly onAddVehicle: () => void;
  readonly onEditVehicle: (vehicle: Vehicle) => void;
}

export function VehiclesScreen({ firstName, client, onAddVehicle, onEditVehicle }: VehiclesScreenProps) {
  const controller = useVehicles(client);
  const colors = useColors();
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.screen, { backgroundColor: colors.canvas }]}>
      <FlatList
        data={controller.state.status === 'loaded' ? controller.state.vehicles : NO_VEHICLES}
        keyExtractor={(vehicle) => vehicle.id}
        renderItem={({ item }) => <VehicleRow vehicle={item} controller={controller} onEdit={() => onEditVehicle(item)} />}
        ListHeaderComponent={<VehiclesHeader firstName={firstName} onAddVehicle={onAddVehicle} actionError={controller.actionError} />}
        ListEmptyComponent={<VehiclesStateMessage controller={controller} />}
        contentContainerStyle={styles.content}
        testID="vehicle-list"
      />
    </SafeAreaView>
  );
}

function VehiclesHeader({
  firstName,
  onAddVehicle,
  actionError,
}: {
  readonly firstName: string;
  readonly onAddVehicle: () => void;
  readonly actionError: VehicleActionError | null;
}) {
  return (
    <>
      <ScreenHeader
        eyebrow={firstName}
        title={i18n.t('vehicles.title')}
        action={<TextButton label={i18n.t('vehicles.add')} onPress={onAddVehicle} />}
      />
      <VehicleActionMessage actionError={actionError} />
    </>
  );
}

function VehicleActionMessage({ actionError }: { readonly actionError: VehicleActionError | null }) {
  const colors = useColors();
  if (actionError === null) {
    return null;
  }
  const message = actionError === 'last-vehicle' ? i18n.t('vehicles.keepOneVehicle') : i18n.t('vehicles.actionFailed');
  return (
    <Text accessibilityRole="alert" style={[typography.body, styles.actionError, { color: colors.ink }]}>
      {message}
    </Text>
  );
}

interface VehicleRowProps {
  readonly vehicle: Vehicle;
  readonly controller: VehiclesController;
  readonly onEdit: () => void;
}

function VehicleRow({ vehicle, controller, onEdit }: VehicleRowProps) {
  const colors = useColors();
  const layout = useIsLargeText() ? stackedStyles : sideBySideStyles;
  return (
    <View testID={`vehicle-row-${vehicle.id}`} style={[styles.row, layout.row, { borderBottomColor: colors.line }]}>
      <View style={layout.plate}>
        <VehicleLabel vehicle={vehicle} />
      </View>
      <View style={styles.actions}>
        <TextButton label={i18n.t('vehicles.edit')} onPress={onEdit} />
        {vehicle.isDefault ? (
          <Text style={[typography.bodyStrong, { color: colors.muted }]}>{i18n.t('vehicles.defaultBadge')}</Text>
        ) : (
          <TextButton label={i18n.t('vehicles.useAsDefault')} onPress={() => controller.chooseDefault(vehicle)} />
        )}
        <TextButton label={i18n.t('vehicles.delete')} onPress={() => controller.remove(vehicle)} />
      </View>
    </View>
  );
}

function VehicleLabel({ vehicle }: { readonly vehicle: Vehicle }) {
  const colors = useColors();
  const needs = declaredNeeds(vehicle);
  return (
    <>
      <Text style={[typography.lotName, { color: colors.ink }]}>{`${vehicle.plate} · ${vehicle.province}`}</Text>
      {needs.length > 0 ? <Text style={[typography.body, { color: colors.muted }]}>{needs.join(' · ')}</Text> : null}
    </>
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
  row: { paddingVertical: spacing.medium, borderBottomWidth: StyleSheet.hairlineWidth },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.medium },
  actionError: { paddingBottom: spacing.medium },
});

const sideBySideStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.medium },
  plate: { flexShrink: 1 },
});

const stackedStyles = StyleSheet.create({
  row: { flexDirection: 'column', alignItems: 'flex-start', gap: spacing.extraSmall },
  plate: {},
});
