import { i18n } from '../i18n/i18n';
import { MessageState } from './MessageState';

export function EmptyState() {
  return <MessageState message={i18n.t('home.empty')} hint={i18n.t('home.emptyHint')} />;
}
