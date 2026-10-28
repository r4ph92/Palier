import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { i18n } from '../i18n/i18n';
import { useColors } from '../theme/useColors';
import { MINIMUM_TOUCH_TARGET } from '../theme/tokens';
import { typography } from '../theme/typography';

export type Tab = 'lots' | 'account';

const TABS: readonly Tab[] = ['lots', 'account'];

interface TabBarProps {
  readonly selected: Tab;
  readonly onSelect: (tab: Tab) => void;
}

export function TabBar({ selected, onSelect }: TabBarProps) {
  const colors = useColors();
  return (
    <SafeAreaView edges={['bottom']} style={[styles.bar, { backgroundColor: colors.canvas, borderTopColor: colors.ink }]}>
      <View accessibilityRole="tablist" style={styles.row}>
        {TABS.map((tab) => (
          <TabButton key={tab} tab={tab} isSelected={tab === selected} onPress={() => onSelect(tab)} />
        ))}
      </View>
    </SafeAreaView>
  );
}

function TabButton({ tab, isSelected, onPress }: { readonly tab: Tab; readonly isSelected: boolean; readonly onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: isSelected }} onPress={onPress} style={styles.tab}>
      <Text style={[typography.button, isSelected ? styles.selected : null, { color: isSelected ? colors.ink : colors.muted }]}>
        {i18n.t(`tabs.${tab}`)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { borderTopWidth: 2 },
  row: { flexDirection: 'row' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: MINIMUM_TOUCH_TARGET },
  selected: { textDecorationLine: 'underline' },
});
