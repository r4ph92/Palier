import { i18n } from '../i18n/i18n';
import { MessageState } from './MessageState';
import { PrimaryButton } from './PrimaryButton';
import { useAnnouncement } from './useAnnouncement';

interface ErrorStateProps {
  readonly onRetry: () => void;
}

export function ErrorState({ onRetry }: ErrorStateProps) {
  const message = i18n.t('home.unreachable');
  useAnnouncement(message);
  return (
    <MessageState
      message={message}
      hint={i18n.t('home.unreachableHint')}
      messageRole="alert"
      action={<PrimaryButton label={i18n.t('home.retry')} onPress={onRetry} />}
    />
  );
}
