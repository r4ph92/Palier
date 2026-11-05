import { i18n } from '../i18n/i18n';
import { MessageState } from './MessageState';

interface EmptyStateProps {
  readonly message: string;
}

export function EmptyState({ message }: EmptyStateProps) {
  return <MessageState message={message} hint={i18n.t('home.emptyHint')} />;
}
