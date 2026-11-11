import type { Vehicle } from '@palier/shared-types';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { VehicleClient } from '../api/VehicleClient';
import { FieldError } from '../components/FieldError';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { TextButton } from '../components/TextButton';
import { VehicleNeedsFields } from '../components/VehicleNeedsFields';
import { i18n } from '../i18n/i18n';
import { LIST_SEPARATOR } from '../i18n/spaces';
import { useEditVehicle, type EditVehicleController } from '../vehicles/useEditVehicle';
import { useColors } from '../theme/useColors';
import { MINIMUM_TOUCH_TARGET, spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

interface EditVehicleScreenProps {
  readonly client: VehicleClient;
  readonly vehicle: Vehicle;
  readonly onCancel: () => void;
  readonly onSaved: () => void;
}

// Only the needs and the transponder change here; a different plate is a different vehicle.
export function EditVehicleScreen({ client, vehicle, onCancel, onSaved }: EditVehicleScreenProps) {
  const colors = useColors();
  const form = useEditVehicle(client, vehicle, onSaved);
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.screen, { backgroundColor: colors.canvas }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader
          eyebrow={`${vehicle.plate}${LIST_SEPARATOR}${vehicle.province}`}
          title={i18n.t('vehicles.editTitle')}
          action={<TextButton label={i18n.t('vehicles.cancel')} onPress={onCancel} />}
        />
        <VehicleNeedsFields needs={form.needs} onToggle={form.toggleNeed} />
        <TransponderField form={form} />
        {form.hasFailed ? <SaveFailedMessage /> : null}
        <PrimaryButton label={i18n.t('vehicles.save')} onPress={form.save} busy={form.isSaving} />
      </ScrollView>
    </SafeAreaView>
  );
}

// Past this scale the identifier stops fitting its field; the cap keeps all eight characters visible.
const TRANSPONDER_MAX_FONT_SCALE = 2;

function TransponderField({ form }: { readonly form: EditVehicleController }) {
  const colors = useColors();
  return (
    <View style={styles.field}>
      <Text style={[typography.bodyStrong, { color: colors.ink }]}>{i18n.t('vehicles.transponder')}</Text>
      <TextInput
        accessibilityLabel={i18n.t('vehicles.transponder')}
        maxFontSizeMultiplier={TRANSPONDER_MAX_FONT_SCALE}
        autoCapitalize="characters"
        autoCorrect={false}
        value={form.transponder}
        onChangeText={form.setTransponder}
        style={[typography.body, styles.input, { color: colors.ink, borderColor: colors.ink }]}
      />
      {form.transponderError === null ? null : <FieldError message={i18n.t(`vehicles.${form.transponderError === 'taken' ? 'transponderTaken' : 'invalidTransponder'}`)} />}
    </View>
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
  field: { gap: spacing.small },
  input: { minHeight: MINIMUM_TOUCH_TARGET, paddingHorizontal: spacing.medium, borderWidth: 2 },
  content: { flexGrow: 1, gap: spacing.medium, paddingHorizontal: spacing.medium, paddingBottom: spacing.extraLarge },
});
