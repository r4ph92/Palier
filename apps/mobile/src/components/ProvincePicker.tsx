import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { currentLanguage } from '../i18n/i18n';
import { PROVINCES, type Province } from '../vehicles/provinces';
import { useColors } from '../theme/useColors';
import { MINIMUM_TOUCH_TARGET, spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

const PICKER_HEIGHT = 240;

interface ProvincePickerProps {
  readonly selected: string | null;
  readonly onSelect: (code: string) => void;
}

// A scrollable list of radio buttons: Canadian provinces and territories first, then U.S. states.
export function ProvincePicker({ selected, onSelect }: ProvincePickerProps) {
  const colors = useColors();
  const language = currentLanguage();
  return (
    <ScrollView nestedScrollEnabled style={[styles.picker, { borderColor: colors.line }]}>
      {PROVINCES.map((province) => (
        <ProvinceOption
          key={province.code}
          province={province}
          label={language === 'en' ? province.en : province.fr}
          isSelected={province.code === selected}
          onSelect={onSelect}
        />
      ))}
    </ScrollView>
  );
}

interface ProvinceOptionProps {
  readonly province: Province;
  readonly label: string;
  readonly isSelected: boolean;
  readonly onSelect: (code: string) => void;
}

function ProvinceOption({ province, label, isSelected, onSelect }: ProvinceOptionProps) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected }}
      onPress={() => onSelect(province.code)}
      style={[styles.option, { borderBottomColor: colors.line }]}
    >
      <Text style={[typography.body, { color: colors.ink }]}>{label}</Text>
      {isSelected ? <Text style={[typography.bodyStrong, { color: colors.ink }]}>✓</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  picker: { maxHeight: PICKER_HEIGHT, borderWidth: StyleSheet.hairlineWidth },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: MINIMUM_TOUCH_TARGET,
    paddingHorizontal: spacing.medium,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
