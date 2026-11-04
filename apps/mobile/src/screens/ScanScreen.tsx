import type { AssignedSpot } from '@palier/shared-types';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { EntryClient } from '../api/EntryClient';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { StateMark } from '../components/StateMark';
import { useAccessibilityFocusOnMount } from '../components/useAccessibilityFocusOnMount';
import { useAnnouncement } from '../components/useAnnouncement';
import { useEntry, type EntryController, type EntryState } from '../entries/useEntry';
import { i18n } from '../i18n/i18n';
import { useColors } from '../theme/useColors';
import { MINIMUM_TOUCH_TARGET, spacing } from '../theme/tokens';
import { typography } from '../theme/typography';
import { EntryProblem } from './EntryProblem';

// A QR content is a link, never words: no capitals, corrections or spelling marks.
const QR_INPUT_BEHAVIOUR = { autoCapitalize: 'none', autoCorrect: false, spellCheck: false, returnKeyType: 'go' } as const;
// After the hyphen of a spot number, so « A-1 » never splits across two lines; it is invisible and not spoken.
const WORD_JOINER = '\u2060';

interface ScanScreenProps {
  readonly client: EntryClient;
  readonly onAddPlate: () => void;
  readonly onAddCard: () => void;
}

export function ScanScreen({ client, onAddPlate, onAddCard }: ScanScreenProps) {
  const colors = useColors();
  const entry = useEntry(client);
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.screen, { backgroundColor: colors.canvas }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader eyebrow={i18n.t('scan.eyebrow')} title={i18n.t('scan.title')} />
        {entry.state.status === 'entered' ? (
          <EnteredSpot spot={entry.state.spot} isConfirmed={entry.state.isConfirmed} onDone={entry.startOver} />
        ) : (
          <ScanForm entry={entry} onAddPlate={onAddPlate} onAddCard={onAddCard} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export function spotLabel(spot: AssignedSpot): string {
  return `${i18n.t('scan.spotLead')}${spot.number}${spotPlace(spot)}`;
}

function spotPlace(spot: AssignedSpot): string {
  return i18n.t('scan.spotPlace', { level: spot.levelCode, aisle: spot.aisleCode });
}

interface EnteredSpotProps {
  readonly spot: AssignedSpot;
  readonly isConfirmed: boolean;
  readonly onDone: () => void;
}

// Spot and barrier are one stop for VoiceOver, focused as soon as they replace the form.
// The barrier line gives way to the confirmation in place once the entry loop proves the car passed.
function EnteredSpot({ spot, isConfirmed, onDone }: EnteredSpotProps) {
  const colors = useColors();
  const resultRef = useAccessibilityFocusOnMount();
  const status = i18n.t(isConfirmed ? 'scan.entryConfirmed' : 'scan.barrierOpen');
  useAnnouncement(isConfirmed ? status : null);
  return (
    <View style={styles.section}>
      <View ref={resultRef} accessible accessibilityLabel={`${spotLabel(spot)}. ${status}`} style={styles.field}>
        <SpotLine spot={spot} />
        <StateMark color={colors.free}>
          <Text style={[typography.bodyStrong, { color: colors.ink }]}>{status}</Text>
        </StateMark>
      </View>
      <PrimaryButton label={i18n.t('scan.done')} onPress={onDone} />
    </View>
  );
}

// The spot number is the largest thing on the screen, in mono like every figure (docs/design.md, gesture 3).
function SpotLine({ spot }: { readonly spot: AssignedSpot }) {
  const colors = useColors();
  return (
    <Text style={[typography.spotLine, { color: colors.ink }]}>
      {i18n.t('scan.spotLead')}
      <Text style={typography.spotNumber}>{spot.number.replaceAll('-', `-${WORD_JOINER}`)}</Text>
      {spotPlace(spot)}
    </Text>
  );
}

interface ScanFormProps {
  readonly entry: EntryController;
  readonly onAddPlate: () => void;
  readonly onAddCard: () => void;
}

function ScanForm({ entry, onAddPlate, onAddCard }: ScanFormProps) {
  const { state } = entry;
  const isSubmitting = state.status === 'submitting';
  return (
    <View style={styles.section}>
      <QrField entry={entry} />
      <EntryProblem state={state} onAddPlate={onAddPlate} onAddCard={onAddCard} />
      <PrimaryButton
        label={i18n.t(submitLabelKey(state))}
        busy={isSubmitting}
        disabled={entry.qrContent.trim() === ''}
        onPress={entry.submit}
      />
    </View>
  );
}

function submitLabelKey(state: EntryState): string {
  if (state.status === 'submitting') {
    return 'scan.submitting';
  }
  return state.status === 'unreachable' || state.status === 'notResponding' ? 'scan.retry' : 'scan.submit';
}

function QrField({ entry }: { readonly entry: EntryController }) {
  const colors = useColors();
  return (
    <View style={styles.field}>
      <Text style={[typography.bodyStrong, { color: colors.ink }]}>{i18n.t('scan.qrLabel')}</Text>
      <TextInput
        accessibilityLabel={i18n.t('scan.qrLabel')}
        {...QR_INPUT_BEHAVIOUR}
        editable={entry.state.status !== 'submitting'}
        value={entry.qrContent}
        onChangeText={entry.setQrContent}
        onSubmitEditing={entry.submit}
        style={[typography.body, styles.input, { color: colors.ink, borderColor: colors.ink }]}
      />
      <Text style={[typography.body, { color: colors.muted }]}>{i18n.t('scan.qrHint')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, gap: spacing.medium, paddingHorizontal: spacing.medium, paddingBottom: spacing.large },
  section: { gap: spacing.medium },
  field: { gap: spacing.small },
  input: { minHeight: MINIMUM_TOUCH_TARGET, paddingHorizontal: spacing.medium, borderWidth: 2 },
});
