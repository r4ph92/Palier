import { useText } from '../i18n/LanguageContext.tsx';
import { StateMark } from './StateMark.tsx';

export function LotStateMark({ isOnline }: { readonly isOnline: boolean }) {
  const text = useText();
  return <StateMark tone={isOnline ? 'free' : 'muted'} label={isOnline ? text.lot.online : text.lot.offline} />;
}
