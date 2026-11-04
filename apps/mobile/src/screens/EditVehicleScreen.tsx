import type { Vehicle } from '@palier/shared-types';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { VehicleClient } from '../api/VehicleClient';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { TextButton } from '../components/TextButton';
import { VehicleNeedsFields } from '../components/VehicleNeedsFields';
import { i18n } from '../i18n/i18n';
import { useEditVehicle } from '../vehicles/useEditVehicle';
import { useColors } from '../theme/useColors';
import { spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

interface EditVehicleScreenProps {
  readonly client: VehicleClient;
  readonly vehicle: Vehicle;
  readonly onCancel: () => void;
  readonly onSaved: () => void;
}

// Only the needs change here; a different plate is a different vehicle.
export function EditVehicleScreen({ client, vehicle, onCancel, onSaved }: EditVehicleScreenProps) {
  const colors = useColors();
  const form = useEditVehicle(client, vehicle, onSaved);
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.screen, { backgroundColor: colors.canvas }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader
          eyebrow={`${vehicle.plate} · ${vehicle.province}`}
          title={i18n.t('vehicles.editTitle')}
          action={<TextButton label={i18n.t('vehicles.cancel')} onPress={onCancel} />}
        />
        <VehicleNeedsFields needs={form.needs} onToggle={form.toggleNeed} />
        {form.hasFailed ? <SaveFailedMessage /> : null}
        <PrimaryButton label={i18n.t('vehicles.save')} onPress={form.save} />
      </ScrollView>
    </SafeAreaView>
  );
}

function SaveFailedMessage() {
  const colors = useColors();
  return (
    <Text accessibilityRole="alert" style={[typography.body, { color: colors.danger }]}>
      {i18n.t('vehicles.saveFailed')}
    </Text>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, gap: spacing.medium, paddingHorizontal: spacing.medium },
});
