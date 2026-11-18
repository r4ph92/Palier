const EARLIEST_STORABLE_YEAR = 1;

// Postgres timestamptz refuses year 0000 and earlier, which a Date can hold; an invalid date is not storable either.
export function isStorableDate(moment: Date): boolean {
  return !Number.isNaN(moment.getTime()) && moment.getUTCFullYear() >= EARLIEST_STORABLE_YEAR;
}
