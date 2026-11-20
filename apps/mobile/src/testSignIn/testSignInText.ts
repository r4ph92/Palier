import { currentLanguage, type SupportedLanguage } from '../i18n/i18n';

interface TestSignInText {
  readonly testSignIn: string;
  readonly pickDriver: string;
  readonly loadingDrivers: string;
  readonly driverGone: string;
}

const TEXT: Record<SupportedLanguage, TestSignInText> = {
  fr: {
    testSignIn: 'Connexion de test',
    pickDriver: 'Choisissez un conducteur de démonstration.',
    loadingDrivers: 'Chargement des conducteurs',
    driverGone: 'Ce conducteur n’existe plus.',
  },
  en: {
    testSignIn: 'Test sign-in',
    pickDriver: 'Pick a demo driver.',
    loadingDrivers: 'Loading drivers',
    driverGone: 'This driver no longer exists.',
  },
};

export function testSignInText(): TestSignInText {
  return TEXT[currentLanguage()];
}
