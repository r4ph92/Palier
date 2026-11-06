const FIRST_STORABLE_YEAR = 1;

// A Date holds year 0000 and earlier, which Postgres timestamptz refuses; also false for an invalid date.
export function isStorableDate(moment: Date): boolean {
  return !Number.isNaN(moment.getTime()) && moment.getUTCFullYear() >= FIRST_STORABLE_YEAR;
}
