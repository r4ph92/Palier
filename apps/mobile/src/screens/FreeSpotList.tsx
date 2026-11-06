import type { ParkedQuestion } from '@palier/shared-types';
import { canonicalSpotNumber } from '@palier/shared-types/spotNumber';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { i18n } from '../i18n/i18n';
import { unbrokenNumber } from '../spots/spotNumber';
import { useColors } from '../theme/useColors';
import { MINIMUM_TOUCH_TARGET, spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

interface FreeSpotListProps {
  readonly question: ParkedQuestion;
  // What the field holds: the row showing that number reads as chosen.
  readonly typed: string;
  readonly onChoose: (spotNumber: string) => void;
}

// An aisle without a free spot says so, so the driver knows the list is not missing.
export function FreeSpots(props: FreeSpotListProps) {
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

const styles = StyleSheet.create({
  listLead: { paddingBottom: spacing.small },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: MINIMUM_TOUCH_TARGET,
    paddingVertical: spacing.small,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
