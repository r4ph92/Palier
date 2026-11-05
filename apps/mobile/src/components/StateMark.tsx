import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing } from '../theme/tokens';

const MARK_SIZE = 8;

interface StateMarkProps {
  readonly color: string;
  readonly markTestID?: string;
  readonly children: ReactNode;
}

// A state is shown by a plain 8 pt square in its semantic color, then the words (docs/design.md, gesture 4).
export function StateMark({ color, markTestID, children }: StateMarkProps) {
  return (
    <View style={styles.row}>
      <View testID={markTestID} style={[styles.mark, { backgroundColor: color }]} />
      <View style={styles.text}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.small },
  mark: { width: MARK_SIZE, height: MARK_SIZE },
  text: { flexShrink: 1 },
});
