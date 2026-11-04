import { OTHER_LANGUAGE, useLanguage } from '../i18n/LanguageContext.tsx';

// The button names the other language in that language, the way people look for it; its visible word is its accessible name.
export function LanguageToggle() {
  const { language, text, setLanguage } = useLanguage();
  const target = OTHER_LANGUAGE[language];
  return (
    <button type="button" className="text-button" lang={target} onClick={() => setLanguage(target)}>
      {text.language.switchTo}
    </button>
  );
}
