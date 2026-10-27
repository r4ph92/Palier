import { i18n } from '../i18n/i18n';
import { MessageState } from './MessageState';
import { PrimaryButton } from './PrimaryButton';

interface ErrorStateProps {
  readonly onRetry: () => void;
}

export function ErrorState({ onRetry }: ErrorStateProps) {
  return (
    <MessageState
      message={i18n.t('home.unreachable')}
      hint={i18n.t('home.unreachableHint')}
      action={<PrimaryButton label={i18n.t('home.retry')} onPress={onRetry} />}
    />
  );
}
