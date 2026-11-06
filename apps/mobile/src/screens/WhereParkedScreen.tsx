import type { CurrentParkingSession, ParkedQuestion } from '@palier/shared-types';
import { canonicalSpotNumber, SPOT_NUMBER_MAX_LENGTH } from '@palier/shared-types/spotNumber';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ParkingSessionClient } from '../api/ParkingSessionClient';
import { FieldError } from '../components/FieldError';
import { PrimaryButton } from '../components/PrimaryButton';
import { BODY_TEXT_MAX_FONT_SCALE } from '../components/ScreenHeader';
import { useAccessibilityFocusOnMount } from '../components/useAccessibilityFocusOnMount';
import { useAnnouncement } from '../components/useAnnouncement';
import { i18n } from '../i18n/i18n';
import type { ParkedAnswerProblem } from '../parkingSessions/parkedAnswerOutcome';
import { useParkedAnswer, type ParkedAnswerController } from '../parkingSessions/useParkedAnswer';
import { unbrokenNumber } from '../spots/spotNumber';
import { useColors } from '../theme/useColors';
import { MINIMUM_TOUCH_TARGET, spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

// Past this scale a spot number stops fitting its field; the cap keeps « B-12 » whole.
const SPOT_NUMBER_MAX_FONT_SCALE = 2;

const PROBLEM_MESSAGES: Readonly<Record<ParkedAnswerProblem, string>> = {
  UNKNOWN_SPOT: 'session.whereParked.unknownSpot',
  SPOT_TAKEN: 'session.whereParked.spotTaken',
  SPOT_OUT_OF_SERVICE: 'session.whereParked.spotOutOfService',
  INVALID_NUMBER: 'session.whereParked.invalidNumber',
  UNREACHABLE: 'session.whereParked.unreachable',
};

interface WhereParkedScreenProps {
  readonly client: ParkingSessionClient;
  readonly session: CurrentParkingSession;
  // Reads the session again once the answer is accepted, or the session moved on without it.
  readonly onAnswered: () => void;
}

// Story #21: the driver walked away in another aisle than the assigned spot's, so Palier asks where the car is.
// The free spots of the aisle seen at the walk come first, a tap writes the number in the field; only « Confirmer » sends.
export function WhereParkedScreen({ client, session, onAnswered }: WhereParkedScreenProps) {
  const answering = useParkedAnswer(client, session.sessionId, onAnswered);
  return <WhereParkedQuestion question={session.question} answering={answering} />;
}

interface WhereParkedQuestionProps {
  // null when Palier sent no usable list: the field alone still takes any number.
  readonly question: ParkedQuestion | null;
  readonly answering: ParkedAnswerController;
}

function WhereParkedQuestion({ question, answering }: WhereParkedQuestionProps) {
  const colors = useColors();
  const titleRef = useAccessibilityFocusOnMount();
  const [spotNumber, setSpotNumber] = useState('');
  return (
    <View style={styles.section}>
      <Text ref={titleRef} accessibilityRole="header" maxFontSizeMultiplier={BODY_TEXT_MAX_FONT_SCALE} style={[typography.spotLine, { color: colors.ink }]}>
        {i18n.t('session.whereParked.question')}
      </Text>
      {question === null || question.freeSpotNumbers.length === 0 ? null : <FreeSpotList question={question} typed={spotNumber} onChoose={setSpotNumber} />}
      <SpotNumberField spotNumber={spotNumber} onChange={setSpotNumber} answering={answering} />
    </View>
  );
}

interface FreeSpotListProps {
  readonly question: ParkedQuestion;
  // What the field holds: the row showing that number reads as chosen.
  readonly typed: string;
  readonly onChoose: (spotNumber: string) => void;
}

// A radio group like ProvincePicker: a tap only chooses, so a slip of the finger sends nothing.
function FreeSpotList({ question, typed, onChoose }: FreeSpotListProps) {
  const colors = useColors();
  const lead = i18n.t('session.whereParked.freeSpotsLead', { aisle: question.aisleCode });
  const chosen = canonicalSpotNumber(typed);
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={lead}>
      <Text style={[typography.body, styles.listLead, { color: colors.muted }]}>{lead}</Text>
      {question.freeSpotNumbers.map((spotNumber) => (
        <FreeSpotRow key={spotNumber} spotNumber={spotNumber} isChosen={canonicalSpotNumber(spotNumber) === chosen} onChoose={onChoose} />
      ))}
    </View>
  );
}

interface FreeSpotRowProps {
  readonly spotNumber: string;
  readonly isChosen: boolean;
  readonly onChoose: (spotNumber: string) => void;
}

// List lines are separated by thin rules, without cards (docs/design.md, gesture 2); the number is a figure in mono (gesture 3).
function FreeSpotRow({ spotNumber, isChosen, onChoose }: FreeSpotRowProps) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={spotNumber}
      accessibilityState={{ checked: isChosen }}
      onPress={() => onChoose(spotNumber)}
      style={[styles.row, { borderBottomColor: colors.line }]}
    >
      <Text style={[typography.figureStrong, { color: colors.ink }]}>{unbrokenNumber(spotNumber)}</Text>
      {isChosen ? <Text style={[typography.bodyStrong, { color: colors.ink }]}>✓</Text> : null}
    </Pressable>
  );
}

interface SpotNumberFieldProps {
  readonly spotNumber: string;
  readonly onChange: (spotNumber: string) => void;
  readonly answering: ParkedAnswerController;
}

// Any number, typed or chosen in the list; an empty field cannot be sent.
function SpotNumberField({ spotNumber, onChange, answering }: SpotNumberFieldProps) {
  const colors = useColors();
  const isBlank = spotNumber.trim() === '';
  const submit = () => {
    if (!isBlank) {
      answering.answer(spotNumber);
    }
  };
  return (
    <View style={styles.field}>
      <Text style={[typography.bodyStrong, { color: colors.ink }]}>{i18n.t('session.whereParked.numberLabel')}</Text>
      <SpotNumberInput value={spotNumber} onChange={onChange} onSubmit={submit} />
      <AnswerProblem answering={answering} />
      <ConfirmButton isBlank={isBlank} isSending={answering.isSending} onPress={submit} />
    </View>
  );
}

function ConfirmButton({ isBlank, isSending, onPress }: { readonly isBlank: boolean; readonly isSending: boolean; readonly onPress: () => void }) {
  return (
    <PrimaryButton
      label={i18n.t('session.whereParked.confirm')}
      busyLabel={i18n.t('session.whereParked.sending')}
      onPress={onPress}
      busy={isSending}
      disabled={isBlank}
    />
  );
}

interface SpotNumberInputProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onSubmit: () => void;
}

function SpotNumberInput({ value, onChange, onSubmit }: SpotNumberInputProps) {
  const colors = useColors();
  return (
    <TextInput
      accessibilityLabel={i18n.t('session.whereParked.numberLabel')}
      maxFontSizeMultiplier={SPOT_NUMBER_MAX_FONT_SCALE}
      autoCapitalize="characters"
      maxLength={SPOT_NUMBER_MAX_LENGTH}
      autoCorrect={false}
      returnKeyType="done"
      value={value}
      onChangeText={onChange}
      onSubmitEditing={onSubmit}
      style={[typography.figure, styles.input, { color: colors.ink, borderColor: colors.ink }]}
    />
  );
}

// Announced on every refused answer, the same one twice included, since the focus stays on the field.
function AnswerProblem({ answering }: { readonly answering: ParkedAnswerController }) {
  const message = answering.problem === null ? null : i18n.t(PROBLEM_MESSAGES[answering.problem]);
  useAnnouncement(message, answering.attempts);
  return message === null ? null : <FieldError message={message} />;
}

const styles = StyleSheet.create({
  section: { gap: spacing.large },
  listLead: { paddingBottom: spacing.small },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: MINIMUM_TOUCH_TARGET,
    paddingVertical: spacing.small,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  field: { gap: spacing.small },
  input: { minHeight: MINIMUM_TOUCH_TARGET, paddingHorizontal: spacing.medium, borderWidth: 2 },
});
