import { formatCardLabel } from '../src/payment/formatCardLabel';

describe('formatCardLabel', () => {
  it('shows the capitalized brand and the last four digits', () => {
    expect(formatCardLabel({ brand: 'visa', last4: '4242' })).toBe('Visa •••• 4242');
  });

  it('shows a Mastercard as Mastercard, never by its card number', () => {
    expect(formatCardLabel({ brand: 'mastercard', last4: '4444' })).toBe('Mastercard •••• 4444');
  });
});
