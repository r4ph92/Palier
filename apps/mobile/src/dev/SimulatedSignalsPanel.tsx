import { useSyncExternalStore } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { TextButton } from '../components/TextButton';
import { useColors } from '../theme/useColors';
import { spacing } from '../theme/tokens';
import { typography } from '../theme/typography';
import { formatLogTime } from './formatLogTime';
import type { PanelAction } from './panelActions';
import type { SignalJournal } from './SignalJournal';

interface SimulatedSignalsPanelProps {
  readonly journal: SignalJournal;
  readonly actions: readonly PanelAction[];
  readonly onBack: () => void;
}

export function SimulatedSignalsPanel({ journal, actions, onBack }: SimulatedSignalsPanelProps) {
  const colors = useColors();
  return (
    <SafeAreaView testID="SimulatedSignalsPanel" edges={['top', 'left', 'right']} style={[styles.screen, { backgroundColor: colors.canvas }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader eyebrow="Développeur" title="Signaux simulés" action={<TextButton label="Retour" onPress={onBack} />} />
        {actions.map((action) => (
          <PrimaryButton key={action.label} label={action.label} onPress={action.run} />
        ))}
        <EventLog journal={journal} />
      </ScrollView>
    </SafeAreaView>
  );
}

function EventLog({ journal }: { readonly journal: SignalJournal }) {
  const colors = useColors();
  const entries = useSyncExternalStore(journal.subscribe, journal.snapshot);
  return (
    <View accessibilityLabel="Journal des événements" style={styles.log}>
      <Text style={[typography.eyebrow, { color: colors.muted }]}>Journal</Text>
      {entries.length === 0 ? <Text style={[typography.body, { color: colors.muted }]}>Aucun événement pour l'instant.</Text> : null}
      {entries.map((entry) => (
        <Text key={entry.id} style={[typography.countLabel, { color: colors.ink }]}>
          {`${formatLogTime(entry.at)}  ${entry.text}`}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, gap: spacing.small, paddingHorizontal: spacing.medium, paddingBottom: spacing.large },
  log: { gap: spacing.small, paddingTop: spacing.medium },
});
