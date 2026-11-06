// A zero-row update after a read under the lock is a broken invariant: throwing rolls the transaction back.
export function requireUpdatedRow(rows: readonly unknown[], failure: string): void {
  if (rows.length === 0) {
    throw new Error(failure);
  }
}
