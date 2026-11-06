import type { CurrentParkingSession, ParkedQuestion } from '@palier/shared-types';
import { canonicalSpotNumber, SPOT_NUMBER_MAX_LENGTH } from '@palier/shared-types/spotNumber';
import { useState, type ReactNode } from 'react';
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
// Wide enough for « P1-12 » at that scale; a full-width field would ask for a sentence, not a number.
const SPOT_FIELD_MIN_WIDTH = 160;

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
  // The offline notice, or null; it sits under the title so the driver knows the free spots may be old.
  readonly offline: ReactNode;
  // Reads the session again once the answer is accepted, or the session moved on without it.
  readonly onAnswered: () => void;
}

// The driver walked away in another aisle than the assigned spot's, so Palier asks where the car is.
// The free spots of the aisle seen at the walk come first, a tap writes the number in the field; only « Confirmer » sends.
export function WhereParkedScreen({ client, session, offline, onAnswered }: WhereParkedScreenProps) {
  const answering = useParkedAnswer(client, session.sessionId, onAnswered);
  return <WhereParkedQuestion question={session.question} offline={offline} answering={answering} />;
}

interface WhereParkedQuestionProps {
  // null when Palier sent no usable list: the field alone still takes any number.
  readonly question: ParkedQuestion | null;
  readonly offline: ReactNode;
  readonly answering: ParkedAnswerController;
}

function WhereParkedQuestion({ question, offline, answering }: WhereParkedQuestionProps) {
  const colors = useColors();
  const titleRef = useAccessibilityFocusOnMount();
  const [spotNumber, setSpotNumber] = useState('');
  const changeNumber = (value: string) => {
    setSpotNumber(value);
    answering.clearProblem();
  };
  return (
    <View style={styles.section}>
      <Text ref={titleRef} accessibilityRole="header" maxFontSizeMultiplier={BODY_TEXT_MAX_FONT_SCALE} style={[typography.spotLine, { color: colors.ink }]}>
        {i18n.t('session.whereParked.question')}
      </Text>
      {offline}
      {question === null ? null : <FreeSpots question={question} typed={spotNumber} onChoose={changeNumber} />}
      <SpotNumberField spotNumber={spotNumber} onChange={changeNumber} answering={answering} />
    </View>
  );
}

interface FreeSpotListProps {
  readonly question: ParkedQuestion;
  // What the field holds: the row showing that number reads as chosen.
  readonly typed: string;
  readonly onChoose: (spotNumber: string) => void;
}

// An aisle without a free spot says so, so the driver knows the list is not missing.
function FreeSpots(props: FreeSpotListProps) {
  const colors = useColors();
  if (props.question.freeSpotNumbers.length > 0) {
    return <FreeSpotList {...props} />;
  }
  return <Text style={[typography.body, { color: colors.muted }]}>{i18n.t('session.whereParked.noFreeSpot', { aisle: props.question.aisleCode })}</Text>;
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
  const problem = answering.problem === null ? null : i18n.t(PROBLEM_MESSAGES[answering.problem]);
  const submit = () => {
    if (!isBlank) {
      answering.answer(spotNumber);
    }
  };
  return (
    <View style={styles.field}>
      <Text style={[typography.bodyStrong, { color: colors.ink }]}>{i18n.t('session.whereParked.numberLabel')}</Text>
      <SpotNumberInput value={spotNumber} problem={problem} onChange={onChange} onSubmit={submit} />
      <AnswerProblem message={problem} attempts={answering.attempts} />
      <ConfirmButton spotNumber={spotNumber.trim()} isSending={answering.isSending} onPress={submit} />
    </View>
  );
}

interface ConfirmButtonProps {
  // Trimmed; blank keeps a plain, disabled « Confirmer ».
  readonly spotNumber: string;
  readonly isSending: boolean;
  readonly onPress: () => void;
}

// Names the number about to be sent, « Confirmer B-3 », so a slip in the field shows before it is sent.
function ConfirmButton({ spotNumber, isSending, onPress }: ConfirmButtonProps) {
  const isBlank = spotNumber === '';
  const label = isBlank ? i18n.t('session.whereParked.confirm') : i18n.t('session.whereParked.confirmNumber', { number: unbrokenNumber(spotNumber) });
  return (
    <PrimaryButton
      label={label}
      busyLabel={i18n.t('session.whereParked.sending')}
      onPress={onPress}
      busy={isSending}
      disabled={isBlank}
    />
  );
}

interface SpotNumberInputProps {
  readonly value: string;
  // Read again with the field while it shows, since VoiceOver's focus stays on the field.
  readonly problem: string | null;
  readonly onChange: (value: string) => void;
  readonly onSubmit: () => void;
}

function SpotNumberInput({ value, problem, onChange, onSubmit }: SpotNumberInputProps) {
  const colors = useColors();
  return (
    <TextInput
      accessibilityLabel={i18n.t('session.whereParked.numberLabel')}
      accessibilityHint={problem ?? undefined}
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
function AnswerProblem({ message, attempts }: { readonly message: string | null; readonly attempts: number }) {
  useAnnouncement(message, attempts);
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
  input: { alignSelf: 'flex-start', minWidth: SPOT_FIELD_MIN_WIDTH, minHeight: MINIMUM_TOUCH_TARGET, paddingHorizontal: spacing.medium, borderWidth: 2 },
});
