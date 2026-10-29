import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { VehicleClient } from '../api/VehicleClient';
import { PrimaryButton } from '../components/PrimaryButton';
import { ProvincePicker } from '../components/ProvincePicker';
import { ScreenHeader } from '../components/ScreenHeader';
import { TextButton } from '../components/TextButton';
import { i18n } from '../i18n/i18n';
import { useAddVehicle, type AddVehicleController } from '../vehicles/useAddVehicle';
import { useColors } from '../theme/useColors';
import { MINIMUM_TOUCH_TARGET, spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

interface AddVehicleScreenProps {
  readonly client: VehicleClient;
  readonly onCancel: () => void;
  readonly onSaved: () => void;
}

export function AddVehicleScreen({ client, onCancel, onSaved }: AddVehicleScreenProps) {
  const colors = useColors();
  const form = useAddVehicle(client, onSaved);
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.screen, { backgroundColor: colors.canvas }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader
          eyebrow="Palier"
          title={i18n.t('vehicles.addTitle')}
          action={<TextButton label={i18n.t('vehicles.cancel')} onPress={onCancel} />}
        />
        <PlateField form={form} />
        <ProvinceField form={form} />
        {form.errors.form ? <FieldError message={form.errors.form} /> : null}
        <PrimaryButton label={i18n.t('vehicles.save')} onPress={form.save} />
      </ScrollView>
    </SafeAreaView>
  );
}

function PlateField({ form }: { readonly form: AddVehicleController }) {
  const colors = useColors();
  return (
    <View style={styles.field}>
      <Text style={[typography.bodyStrong, { color: colors.ink }]}>{i18n.t('vehicles.plate')}</Text>
      <TextInput
        accessibilityLabel={i18n.t('vehicles.plate')}
        autoCapitalize="characters"
        autoCorrect={false}
        value={form.plate}
        onChangeText={form.setPlate}
        style={[typography.body, styles.input, { color: colors.ink, borderColor: colors.ink }]}
      />
      {form.errors.plate ? <FieldError message={form.errors.plate} /> : null}
    </View>
  );
}

function ProvinceField({ form }: { readonly form: AddVehicleController }) {
  const colors = useColors();
  return (
    <View style={styles.field}>
      <Text style={[typography.bodyStrong, { color: colors.ink }]}>{i18n.t('vehicles.province')}</Text>
      <ProvincePicker selected={form.province} onSelect={form.setProvince} />
      {form.errors.province ? <FieldError message={form.errors.province} /> : null}
    </View>
  );
}

function FieldError({ message }: { readonly message: string }) {
  const colors = useColors();
  return (
    <Text accessibilityRole="alert" style={[typography.body, { color: colors.danger }]}>
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, gap: spacing.medium, paddingHorizontal: spacing.medium },
  field: { gap: spacing.small },
  input: { minHeight: MINIMUM_TOUCH_TARGET, paddingHorizontal: spacing.medium, borderWidth: 2 },
});
