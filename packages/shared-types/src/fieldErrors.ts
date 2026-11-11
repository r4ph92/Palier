export interface WholeNumberLimits {
  readonly minimum: number;
  readonly maximum: number;
}

// Each field of a form keeps its own error, so the page can show every one beside its field at once.
export type FieldErrors<Field extends string, Code extends string> = Partial<Readonly<Record<Field, Code>>>;

export function isWholeNumberWithin(value: number, { minimum, maximum }: WholeNumberLimits): boolean {
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}

// Checks come in the form's order, so the first error is the one of the first field on the page.
export function fieldErrorsOf<Field extends string, Code extends string>(checks: readonly (readonly [Field, Code | null])[]): FieldErrors<Field, Code> {
  return Object.fromEntries(checks.filter(([, code]) => code !== null)) as FieldErrors<Field, Code>;
}

export function firstFieldError<Code extends string>(errors: Partial<Readonly<Record<string, Code>>>): Code | null {
  return Object.values(errors)[0] ?? null;
}
