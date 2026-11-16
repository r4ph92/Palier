import { describe, expect, it } from 'vitest';
import { formatRecentDateTime } from '../src/i18n/formatNumbers.ts';

const NOW = new Date('2026-11-14T12:00:00');

describe('formatting the time a spot was flagged', () => {
  it('leaves the year out for a moment of this year', () => {
    expect(formatRecentDateTime(new Date('2026-11-13T14:05:00'), 'en', NOW)).not.toMatch(/2026/);
  });

  it('keeps the year for a moment of another year', () => {
    expect(formatRecentDateTime(new Date('2025-12-31T23:30:00'), 'fr', NOW)).toMatch(/2025/);
  });
});
