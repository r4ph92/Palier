import type { Language } from '../i18n/LanguageContext.tsx';

// Outside the main dictionaries so that the production build carries none of the test sign-in copy.
export const testSignInText: Readonly<Record<Language, { readonly title: string; readonly hint: string; readonly signingIn: string }>> = {
  fr: {
    title: 'Connexion de test',
    hint: 'Choisissez une identité de démonstration.',
    signingIn: 'Connexion…',
  },
  en: {
    title: 'Test sign-in',
    hint: 'Pick a demonstration identity.',
    signingIn: 'Signing in…',
  },
};
