import type { VehicleNeeds } from '@palier/shared-types';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { i18n } from '../i18n/i18n';
import { needLabel, VEHICLE_NEEDS, type VehicleNeed } from '../vehicles/vehicleNeeds';
import { useColors } from '../theme/useColors';
import { useIsLargeText } from '../theme/useIsLargeText';
import { MINIMUM_TOUCH_TARGET, spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

const CHECK_BOX_SIZE = 24;

interface VehicleNeedsFieldsProps {
  readonly needs: VehicleNeeds;
  readonly onToggle: (need: VehicleNeed) => void;
}

// A checkbox per need; the driver declares them and Palier does not check the permit.
export function VehicleNeedsFields({ needs, onToggle }: VehicleNeedsFieldsProps) {
  const colors = useColors();
  return (
    <View style={styles.field}>
      <Text accessibilityRole="header" style={[typography.bodyStrong, { color: colors.ink }]}>
        {i18n.t('vehicles.needs')}
      </Text>
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

// At large text the box sits above the label, so a long word like « handicapées » keeps the full width.
function NeedOption({ need, isChecked, onToggle }: NeedOptionProps) {
  const colors = useColors();
  const isLargeText = useIsLargeText();
  return (
    <Pressable
      testID={`need-${need}`}
      accessibilityRole="checkbox"
      accessibilityLabel={needLabel(need)}
      accessibilityState={{ checked: isChecked }}
      onPress={() => onToggle(need)}
      style={[styles.option, isLargeText ? styles.stacked : styles.sideBySide, { borderBottomColor: colors.line }]}
    >
      <CheckBox need={need} isChecked={isChecked} />
      <Text style={[typography.body, styles.label, { color: colors.ink }]}>{needLabel(need)}</Text>
    </Pressable>
  );
}

function CheckBox({ need, isChecked }: { readonly need: VehicleNeed; readonly isChecked: boolean }) {
  const colors = useColors();
  return (
    <View testID={`need-box-${need}`} style={[styles.box, { borderColor: colors.ink }]}>
      {isChecked ? <Text style={[typography.bodyStrong, { color: colors.ink }]}>✓</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.small },
  group: { borderWidth: StyleSheet.hairlineWidth },
  option: {
    gap: spacing.medium,
    minHeight: MINIMUM_TOUCH_TARGET,
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sideBySide: { flexDirection: 'row', alignItems: 'center' },
  stacked: { alignItems: 'flex-start' },
  box: { width: CHECK_BOX_SIZE, height: CHECK_BOX_SIZE, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  label: { flexShrink: 1 },
});
