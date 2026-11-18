import { describe, expect, it } from 'vitest';
import { keyFieldAttributes } from '../../src/http/demo/keyField.js';

describe('keyFieldAttributes', () => {
  it('marks the field invalid and describes it by the message after a refused key', () => {
    expect(keyFieldAttributes({ message: { key: 'keyRefused', isError: true } })).toEqual({ isInvalid: true, describedBy: 'device-key-hint message' });
  });

  it.each([
    ['no message', null],
    ['another error', { key: 'unreachable', isError: true } as const],
    ['a status', { key: 'sending', isError: false } as const],
  ])('leaves the field valid with %s', (_case, message) => {
    expect(keyFieldAttributes({ message })).toEqual({ isInvalid: false, describedBy: 'device-key-hint' });
  });
});
