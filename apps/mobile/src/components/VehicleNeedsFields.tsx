import type { VehicleNeeds } from '@palier/shared-types';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { i18n } from '../i18n/i18n';
import { needLabel, VEHICLE_NEEDS, type VehicleNeed } from '../vehicles/vehicleNeeds';
import { useColors } from '../theme/useColors';
import { MINIMUM_TOUCH_TARGET, spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

interface VehicleNeedsFieldsProps {
  readonly needs: VehicleNeeds;
  readonly onToggle: (need: VehicleNeed) => void;
}

// A checkbox per need; the driver declares them and Palier does not check the permit.
export function VehicleNeedsFields({ needs, onToggle }: VehicleNeedsFieldsProps) {
  const colors = useColors();
  return (
    <View style={styles.field}>
      <Text style={[typography.bodyStrong, { color: colors.ink }]}>{i18n.t('vehicles.needs')}</Text>
      <View style={[styles.group, { borderColor: colors.line }]}>
        {VEHICLE_NEEDS.map((need) => (
          <NeedOption key={need} need={need} isChecked={needs[need]} onToggle={onToggle} />
        ))}
      </View>
    </View>
  );
}

interface NeedOptionProps {
  readonly need: VehicleNeed;
  readonly isChecked: boolean;
  readonly onToggle: (need: VehicleNeed) => void;
}

function NeedOption({ need, isChecked, onToggle }: NeedOptionProps) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={needLabel(need)}
      accessibilityState={{ checked: isChecked }}
      onPress={() => onToggle(need)}
      style={[styles.option, { borderBottomColor: colors.line }]}
    >
      <Text style={[typography.body, styles.label, { color: colors.ink }]}>{needLabel(need)}</Text>
      {isChecked ? <Text style={[typography.bodyStrong, { color: colors.ink }]}>✓</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.small },
  group: { borderWidth: StyleSheet.hairlineWidth },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.medium,
    minHeight: MINIMUM_TOUCH_TARGET,
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: { flexShrink: 1 },
});
