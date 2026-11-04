import { useLanguage } from '../i18n/LanguageContext.tsx';

// The button names the other language in that language, the way people look for it.
export function LanguageToggle() {
  const { text, setLanguage } = useLanguage();
  const target = text.language.switchToCode === 'en' ? 'en' : 'fr';
  return (
    <button type="button" className="text-button" lang={target} aria-label={text.language.switchLabel} onClick={() => setLanguage(target)}>
      {text.language.switchTo}
    </button>
  );
}
