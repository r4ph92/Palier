import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { TextButton, type TextButtonProps } from './TextButton';

interface NoticeWithActionProps {
  readonly message: ReactNode;
  readonly action: TextButtonProps;
}

// A message with one text button below it, lined up at the start.
export function NoticeWithAction({ message, action }: NoticeWithActionProps) {
  return (
    <View style={styles.withAction}>
      {message}
      <TextButton {...action} />
    </View>
  );
}

const styles = StyleSheet.create({
  withAction: { alignItems: 'flex-start' },
});
