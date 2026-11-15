import { describe, expect, it } from 'vitest';
import { ATTESTATION_TIME_ZONE, attestationErrors, calendarDayIn, isCalendarDay } from '@palier/shared-types/publication';

const TODAY = '2026-11-15';
const measured = { measuredOn: '2026-11-12', note: 'Signal mesuré aux niveaux P1 et P2.' };

describe('the rule for an operator attestation', () => {
  it.each([
    ['a measure taken three days ago', {}],
    ['a measure taken today', { measuredOn: TODAY }],
    ['the earliest day allowed', { measuredOn: '2020-01-01' }],
    ['a 300-character note', { note: 'é'.repeat(300) }],
    ['a note surrounded by spaces', { note: '  Quatre barres.  ' }],
  ])('accepts %s', (_case, change) => {
    expect(attestationErrors({ ...measured, ...change }, TODAY)).toEqual({});
  });

  it.each([
    ['a day that is not on the calendar', { measuredOn: '2026-02-30' }, { measuredOn: 'ATTESTATION_DAY_INVALID' }],
    ['a day written another way', { measuredOn: '12/11/2026' }, { measuredOn: 'ATTESTATION_DAY_INVALID' }],
    ['a day before 2020', { measuredOn: '2019-12-31' }, { measuredOn: 'ATTESTATION_DAY_INVALID' }],
    ['tomorrow', { measuredOn: '2026-11-16' }, { measuredOn: 'ATTESTATION_DAY_IN_FUTURE' }],
    ['an empty note', { note: '   ' }, { note: 'ATTESTATION_NOTE_INVALID' }],
    ['a 301-character note', { note: 'é'.repeat(301) }, { note: 'ATTESTATION_NOTE_INVALID' }],
    ['a note with a line break', { note: 'Niveau P1\nNiveau P2' }, { note: 'ATTESTATION_NOTE_INVALID' }],
    ['a note with a zero-width space', { note: 'Signal​ fort' }, { note: 'ATTESTATION_NOTE_INVALID' }],
  ])('refuses %s', (_case, change, errors) => {
    expect(attestationErrors({ ...measured, ...change }, TODAY)).toEqual(errors);
  });

  it('reads 2026-02-28 as a day and 2026-13-01 as none', () => {
    expect(isCalendarDay('2026-02-28')).toBe(true);
    expect(isCalendarDay('2026-13-01')).toBe(false);
  });

  it('takes today on Montréal’s calendar, not on UTC’s', () => {
    const lateEveningInMontreal = new Date('2026-11-16T03:30:00Z');

    expect(calendarDayIn(ATTESTATION_TIME_ZONE, lateEveningInMontreal)).toBe('2026-11-15');
  });
});
