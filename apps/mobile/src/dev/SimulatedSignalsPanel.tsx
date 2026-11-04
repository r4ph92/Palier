import { useEffect, useRef, useSyncExternalStore } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../components/ScreenHeader';
import { TextButton } from '../components/TextButton';
import { useColors } from '../theme/useColors';
import { MINIMUM_TOUCH_TARGET, spacing } from '../theme/tokens';
import { typography } from '../theme/typography';
import { formatLogTime } from './formatLogTime';
import type { PanelAction } from './panelActions';
import type { LogEntry, SignalJournal } from './SignalJournal';

const MAX_FONT_SCALE = 2;

interface SimulatedSignalsPanelProps {
  readonly journal: SignalJournal;
  readonly signals: readonly PanelAction[];
  readonly commands: readonly PanelAction[];
  readonly onBack: () => void;
}

export function SimulatedSignalsPanel({ journal, signals, commands, onBack }: SimulatedSignalsPanelProps) {
  const colors = useColors();
  return (
    <SafeAreaView testID="SimulatedSignalsPanel" edges={['top', 'left', 'right']} style={[styles.screen, { backgroundColor: colors.canvas }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader eyebrow="Développeur" title="Signaux simulés" action={<TextButton label="Retour" onPress={onBack} />} />
        <EventLog journal={journal} />
        <ActionGroup title="Signaux" actions={signals} />
        <ActionGroup title="Commandes" actions={commands} />
      </ScrollView>
    </SafeAreaView>
  );
}

function GroupLabel({ title }: { readonly title: string }) {
  const colors = useColors();
  return (
    <Text accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE} style={[typography.eyebrow, styles.groupLabel, { color: colors.muted }]}>
      {title}
    </Text>
  );
}

function ActionGroup({ title, actions }: { readonly title: string; readonly actions: readonly PanelAction[] }) {
  const colors = useColors();
  return (
    <View>
      <GroupLabel title={title} />
      {actions.map((action) => (
        <Pressable
          key={action.label}
          accessibilityRole="button"
          onPress={action.run}
          style={({ pressed }) => [styles.row, { borderBottomColor: colors.line, opacity: pressed ? 0.6 : 1 }]}
        >
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[typography.body, { color: colors.ink }]}>
            {action.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function EventLog({ journal }: { readonly journal: SignalJournal }) {
  const colors = useColors();
  const entries = useSyncExternalStore(journal.subscribe, journal.snapshot);
  useAnnounceNewest(entries[0]);
  return (
    <View>
      <GroupLabel title="Journal" />
      {entries.length === 0 ? (
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[typography.body, styles.emptyLog, { color: colors.muted }]}>
          Aucun événement pour l'instant.
        </Text>
      ) : null}
      {entries.map((entry) => (
        <LogLine key={entry.id} entry={entry} />
      ))}
    </View>
  );
}

function LogLine({ entry }: { readonly entry: LogEntry }) {
  const colors = useColors();
  return (
    <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[typography.countLabel, styles.logLine, { color: colors.ink, borderBottomColor: colors.line }]}>
      {`${formatLogTime(entry.at)}  ${entry.text}`}
    </Text>
  );
}

// Keyed on the id, not the text, so a repeated "Allée 2" is announced again; the entry already there at mount stays silent.
function useAnnounceNewest(newest: LogEntry | undefined): void {
  const announcedId = useRef(newest?.id);
  useEffect(() => {
    if (newest === undefined || newest.id === announcedId.current) {
      return;
    }
    announcedId.current = newest.id;
    AccessibilityInfo.announceForAccessibility(newest.text);
  }, [newest]);
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: spacing.medium, paddingBottom: spacing.large },
  groupLabel: { paddingTop: spacing.large, paddingBottom: spacing.small },
  emptyLog: { paddingVertical: spacing.small },
  logLine: { paddingVertical: spacing.small, borderBottomWidth: StyleSheet.hairlineWidth },
  row: { justifyContent: 'center', minHeight: MINIMUM_TOUCH_TARGET, borderBottomWidth: StyleSheet.hairlineWidth },
});
