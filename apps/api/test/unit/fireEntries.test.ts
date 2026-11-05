import { describe, expect, it } from 'vitest';
import { unreachableAnswer } from '../../src/load/fireEntries.ts';

describe('unreachableAnswer', () => {
  it('names the system error behind a failed fetch', () => {
    const refused = new TypeError('fetch failed', { cause: Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:3042'), { code: 'ECONNREFUSED' }) });

    expect(unreachableAnswer(refused)).toBe('UNREACHABLE:ECONNREFUSED');
  });

  it('stays UNREACHABLE when the failure carries no code', () => {
    expect(unreachableAnswer(new Error('aborted'))).toBe('UNREACHABLE');
  });
});
