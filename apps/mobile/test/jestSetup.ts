// The Stripe SDK needs its native module; tests use the mock it ships instead.
jest.mock('@stripe/stripe-react-native', () => jest.requireActual('@stripe/stripe-react-native/jest/mock.js'));
