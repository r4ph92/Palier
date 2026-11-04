import type { Dictionary } from './fr.ts';

export const en: Dictionary = {
  app: {
    name: 'Palier dashboard',
    eyebrow: 'Palier · Dashboard',
    skipToContent: 'Skip to content',
    signOut: 'Sign out',
    signingOut: 'Signing out…',
    loading: 'Loading…',
  },
  language: {
    switchTo: 'Français',
    switchToCode: 'fr',
  },
  signIn: {
    eyebrow: 'Dashboard',
    title: 'Sign in',
    providersLater: 'Signing in with Google or Apple is not available yet.',
  },
  createOperator: {
    eyebrow: 'First step',
    title: 'Create your operator',
    greeting: 'Hello %{firstName}.',
    intro: 'You are not a member of any operator. Enter your company’s legal name to create one.',
    legalNameLabel: 'Legal name',
    legalNameHint: '%{minimum} to %{maximum} characters, as registered.',
    submit: 'Create the operator',
    submitting: 'Creating…',
  },
  home: {
    eyebrow: 'Operator',
    stripeLabel: 'Stripe account',
    lotsTitle: 'Parking lots',
    lotsLoading: 'Loading parking lots…',
    lotsEmpty: 'No parking lots yet.',
  },
  kycStatus: {
    NOT_STARTED: 'Not started',
    PENDING: 'Pending',
    VERIFIED: 'Verified',
  },
  lot: {
    eyebrow: 'Parking lot',
    online: 'Online',
    offline: 'Offline',
    back: 'Back to parking lots',
  },
  notFound: {
    eyebrow: 'Error 404',
    title: 'Not found',
    message: 'This page does not exist or is not available to you.',
    back: 'Back to home',
  },
  failure: {
    title: 'Palier cannot be reached',
    retry: 'Try again',
  },
  errors: {
    UNAUTHORIZED: 'Your session ended. Sign in again.',
    CSRF_HEADER_MISSING: 'This request was refused. Reload the page.',
    LEGAL_NAME_INVALID: 'The legal name must be %{minimum} to %{maximum} characters, with no invisible characters.',
    OPERATOR_EXISTS: 'You are already a member of an operator.',
    NO_OPERATOR: 'Create your operator first.',
    LOT_NOT_FOUND: 'This parking lot cannot be found.',
    UNKNOWN: 'Something went wrong. Try again in a moment.',
  },
};
