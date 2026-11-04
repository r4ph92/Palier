import type { AssignedSpot } from '@palier/shared-types';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { SpotWithState } from '../components/SpotLine';
import { useAccessibilityFocusOnMount } from '../components/useAccessibilityFocusOnMount';
import { useAnnouncement } from '../components/useAnnouncement';
import type { EntryController, EntryState } from '../entries/useEntry';
import { i18n } from '../i18n/i18n';
import { useColors } from '../theme/useColors';
import { MINIMUM_TOUCH_TARGET, spacing } from '../theme/tokens';
import { typography } from '../theme/typography';
import { EntryProblem } from './EntryProblem';

// A QR content is a link, never words: no capitals, corrections or spelling marks.
const QR_INPUT_BEHAVIOUR = { autoCapitalize: 'none', autoCorrect: false, spellCheck: false, returnKeyType: 'go' } as const;

interface ScanScreenProps {
  readonly entry: EntryController;
  // Shown above the form: what the tab knows about a current session.
  readonly notice?: ReactNode;
  readonly onDone: () => void;
  readonly onAddPlate: () => void;
  readonly onAddCard: () => void;
}

export function ScanScreen({ entry, notice, onDone, onAddPlate, onAddCard }: ScanScreenProps) {
  return (
    <ScanFrame>
      {entry.state.status === 'entered' ? (
        <EnteredSpot spot={entry.state.spot} isConfirmed={entry.state.isConfirmed} onDone={onDone} />
      ) : (
        <>
          {notice}
          <ScanForm entry={entry} onAddPlate={onAddPlate} onAddCard={onAddCard} />
        </>
      )}
    </ScanFrame>
  );
}

// The scan tab's screen and header, also shown while the tab waits to know whether a session is current.
export function ScanFrame({ children }: { readonly children: ReactNode }) {
  const colors = useColors();
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.screen, { backgroundColor: colors.canvas }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader eyebrow={i18n.t('scan.eyebrow')} title={i18n.t('scan.title')} />
        {children}
      </ScrollView>
    </SafeAreaView>
  );
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
      <SpotWithState ref={resultRef} spot={spot} lead={i18n.t('scan.spotLead')} status={status} markColor={colors.free} />
      <PrimaryButton label={i18n.t('scan.done')} onPress={onDone} />
    </View>
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
