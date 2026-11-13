import { describe, expect, it } from 'vitest';
import { parseAmount, parseDecimal, parseWholeNumber } from '../src/lotSetup/parseNumbers.ts';

const accepted = (value: number) => ({ ok: true, value });
const EMPTY = { ok: false, reason: 'empty' };
const INVALID = { ok: false, reason: 'invalid' };

describe('reading an amount typed in French or English', () => {
  it.each([
    ['1,00', 100],
    ['1.00', 100],
    ['1', 100],
    ['18,5', 1850],
    ['0,05', 5],
    ['18,00 $', 1800],
    ['18,00 $', 1800],
    ['$18.00', 1800],
    ['1 000,00', 100_000],
    ['1 000,00', 100_000],
    ['  2,50  ', 250],
  ])('reads %s as %i cents', (text, cents) => {
    expect(parseAmount(text, 'fr')).toEqual(accepted(cents));
  });

  it.each([
    ['$1,800.00', 180_000],
    ['$100,000.00', 10_000_000],
    ['1,000.00', 100_000],
    ['100,000', 10_000_000],
    ['1,00', 100],
    ['18.5', 1850],
  ])('reads %s as %i cents in English', (text, cents) => {
    expect(parseAmount(text, 'en')).toEqual(accepted(cents));
  });

  it.each(['1,000,00', '1,00.00', '1,0000.00', '1,00,000', '1.000,00'])('refuses %s in English', (text) => {
    expect(parseAmount(text, 'en')).toEqual(INVALID);
  });

  it.each(['', '   ', '$', ' $ '])('answers empty for %j', (text) => {
    expect(parseAmount(text, 'fr')).toEqual(EMPTY);
  });

  it.each(['-1,00', '1,005', '1.000,00', '$1,000.00', '1,000.00', 'abc', '1,', ',50', '1e3', '99999999999999999999'])('refuses %s', (text) => {
    expect(parseAmount(text, 'fr')).toEqual(INVALID);
  });
});

describe('reading degrees', () => {
  it.each([
    ['45,52', 45.52],
    ['-73,58', -73.58],
    ['40.5', 40.5],
    [' 45 ', 45],
  ])('reads %s as %d', (text, degrees) => {
    expect(parseDecimal(text)).toEqual(accepted(degrees));
  });

  it.each(['45,5,2', 'abc', '45°', '--1', '1e3'])('refuses %s', (text) => {
    expect(parseDecimal(text)).toEqual(INVALID);
  });

  it('answers empty for nothing typed', () => {
    expect(parseDecimal('')).toEqual(EMPTY);
  });
});

describe('reading a whole number', () => {
  it.each([
    ['40', 40],
    [' 4 ', 4],
    ['0', 0],
    ['1 000', 1000],
    ['1\u00a0000', 1000],
    ['1\u202f000', 1000],
    ['10 000', 10_000],
  ])('reads %s as %i', (text, value) => {
    expect(parseWholeNumber(text, 'fr')).toEqual(accepted(value));
  });

  it.each([
    ['10,000', 10_000],
    ['1,000', 1000],
    ['1 000', 1000],
  ])('reads %s as %i in English', (text, value) => {
    expect(parseWholeNumber(text, 'en')).toEqual(accepted(value));
  });

  it.each(['1,00', '1,0000', '20,5'])('refuses %s in English', (text) => {
    expect(parseWholeNumber(text, 'en')).toEqual(INVALID);
  });

  it('refuses a comma as a thousands mark in French', () => {
    expect(parseWholeNumber('10,000', 'fr')).toEqual(INVALID);
  });

  it.each(['40.5', '20,5', '-1', 'abc', '1 00', '1,00', '99999999999999999999'])('refuses %s', (text) => {
    expect(parseWholeNumber(text, 'fr')).toEqual(INVALID);
  });

  it('answers empty for nothing typed', () => {
    expect(parseWholeNumber('', 'fr')).toEqual(EMPTY);
  });
});
