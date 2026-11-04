import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { i18n } from '../i18n/i18n';
import { useColors } from '../theme/useColors';
import { MINIMUM_TOUCH_TARGET } from '../theme/tokens';
import { typography } from '../theme/typography';

export type Tab = 'lots' | 'scan' | 'account';

const TABS: readonly Tab[] = ['lots', 'scan', 'account'];
// Like the system tab bar, labels grow a little with Dynamic Type, then shrink to fit on one line.
const TAB_LABEL_MAX_FONT_SCALE = 1.4;
// Three tabs share the width: any side padding comes out of the label, which would then shrink below 16 pt.
const TAB_SIDE_PADDING = 0;

interface TabBarProps {
  readonly selected: Tab;
  readonly onSelect: (tab: Tab) => void;
  // The scan tab reads « Session » while the driver has one; it is still the same tab.
  readonly hasCurrentSession?: boolean;
}

export function TabBar({ selected, onSelect, hasCurrentSession = false }: TabBarProps) {
  const colors = useColors();
  return (
    <SafeAreaView edges={['bottom']} style={[styles.bar, { backgroundColor: colors.canvas, borderTopColor: colors.ink }]}>
      <View accessibilityRole="tablist" style={styles.row}>
        {TABS.map((tab) => (
          <TabButton key={tab} label={tabLabel(tab, hasCurrentSession)} isSelected={tab === selected} onPress={() => onSelect(tab)} />
        ))}
      </View>
    </SafeAreaView>
  );
}

function tabLabel(tab: Tab, hasCurrentSession: boolean): string {
  return i18n.t(tab === 'scan' && hasCurrentSession ? 'tabs.session' : `tabs.${tab}`);
}

function TabButton({ label, isSelected, onPress }: { readonly label: string; readonly isSelected: boolean; readonly onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: isSelected }} onPress={onPress} style={styles.tab}>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        maxFontSizeMultiplier={TAB_LABEL_MAX_FONT_SCALE}
        style={[typography.button, isSelected ? styles.selected : null, { color: isSelected ? colors.ink : colors.muted }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { borderTopWidth: 2 },
  row: { flexDirection: 'row' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: MINIMUM_TOUCH_TARGET, paddingHorizontal: TAB_SIDE_PADDING },
  selected: { textDecorationLine: 'underline' },
});
