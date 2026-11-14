import { useState, type FormEvent } from 'react';
import { asDashboardApiError, type DisplayedErrorCode } from '../api/DashboardApiError.ts';
import { followUpRefusal, type Refusal, type StaleDataFollowUps } from '../api/followUpRefusal.ts';
import { useSessionRefresh } from '../session/SessionRefreshContext.tsx';
import { useGuardedRequest } from './useGuardedRequest.ts';

export type FieldValues<Field extends string> = Readonly<Record<Field, string>>;
export type FieldErrorCodes<Field extends string> = Partial<Readonly<Record<Field, DisplayedErrorCode>>>;
export type ReadForm<Field extends string, Value> = { readonly ok: true; readonly value: Value } | { readonly ok: false; readonly errors: FieldErrorCodes<Field> };

export function readFormOf<Field extends string, Value>(value: Value, errors: FieldErrorCodes<Field>): ReadForm<Field, Value> {
  return Object.keys(errors).length === 0 ? { ok: true, value } : { ok: false, errors };
}

export interface FieldFormSetup<Field extends string, Value> {
  readonly initialValues: FieldValues<Field>;
  // The shared rule, run before the request: a form that breaks it sends nothing.
  readonly read: (values: FieldValues<Field>) => ReadForm<Field, Value>;
  readonly send: (value: Value) => Promise<void>;
  readonly fieldOfCode: Partial<Readonly<Record<DisplayedErrorCode, Field>>>;
  // What the page reads again after a refusal that says it is out of date, before the form shows the refusal.
  readonly staleData?: StaleDataFollowUps;
  // Runs once the refusal is known, after the page read again what it called out of date: the code the API answered, then the refusal shown.
  readonly afterRefusal?: (answeredCode: DisplayedErrorCode, refusal: Refusal) => void;
  // Empties every field once a send succeeds, so the form is ready for the next entry; focus stays on the submit button.
  readonly emptiesOnSuccess?: boolean;
}

export interface FieldForm<Field extends string> {
  readonly values: FieldValues<Field>;
  readonly setValue: (field: Field, value: string) => void;
  readonly errors: FieldErrorCodes<Field>;
  readonly summary: DisplayedErrorCode | null;
  // Fill the refusal's sentence, beside its field or in the summary: the taken number of SPOT_NUMBER_TAKEN.
  readonly refusalValues: Readonly<Record<string, string>>;
  // Changes with each refused submit, so the summary takes focus again even when its text stays the same.
  readonly attempt: number;
  readonly submitting: boolean;
  readonly submit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}

interface Outcome<Field extends string> {
  readonly errors: FieldErrorCodes<Field>;
  readonly refusal: DisplayedErrorCode | null;
  readonly values: Readonly<Record<string, string>>;
}

const ACCEPTED = { errors: {}, refusal: null, values: {} } as const;

export function useFieldForm<Field extends string, Value>(setup: FieldFormSetup<Field, Value>): FieldForm<Field> {
  const { values, setValue, outcome, setOutcome, reset } = useFieldValues(setup.initialValues);
  const afterSuccess = setup.emptiesOnSuccess === true ? reset : () => undefined;
  const { attempt, submitting, submit } = useSubmit(values, useSender(setup, { show: setOutcome, afterSuccess }));
  return { values, setValue, errors: outcome.errors, summary: summaryOf(outcome), refusalValues: outcome.values, attempt, submitting, submit };
}

// Editing a field clears its own error only, so the others stay beside their fields until fixed.
function useFieldValues<Field extends string>(initialValues: FieldValues<Field>) {
  const [values, setValues] = useState(initialValues);
  const [outcome, setOutcome] = useState<Outcome<Field>>(ACCEPTED);
  const setValue = (field: Field, value: string) => {
    setValues((previous) => ({ ...previous, [field]: value }));
    setOutcome((previous) => ({ ...previous, errors: withoutField(previous.errors, field) }));
  };
  const reset = () => {
    setValues(initialValues);
    setOutcome(ACCEPTED);
  };
  return { values, setValue, outcome, setOutcome, reset };
}

function useSubmit<Field extends string>(values: FieldValues<Field>, sendValues: (values: FieldValues<Field>) => Promise<boolean>) {
  const [attempt, setAttempt] = useState(0);
  const request = useGuardedRequest();
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await request.run(async () => {
      if (!(await sendValues(values))) {
        setAttempt((previous) => previous + 1);
      }
    });
  };
  return { attempt, submitting: request.busy, submit };
}

interface SenderFollowUps<Field extends string> {
  readonly show: (outcome: Outcome<Field>) => void;
  readonly afterSuccess: () => void;
}

// Reads the form and sends it only when the shared rule accepts it; answers whether the request succeeded.
function useSender<Field extends string, Value>(setup: FieldFormSetup<Field, Value>, { show, afterSuccess }: SenderFollowUps<Field>) {
  const refuse = useRefusal(setup, show);
  return async (values: FieldValues<Field>): Promise<boolean> => {
    const readForm = setup.read(values);
    if (!readForm.ok) {
      show({ errors: readForm.errors, refusal: null, values: {} });
      return false;
    }
    show(ACCEPTED);
    try {
      await setup.send(readForm.value);
      afterSuccess();
      return true;
    } catch (failure) {
      await refuse(failure);
      return false;
    }
  };
}

// Follows the refusal up, shows it, then tells the form that owns it what the API had answered.
function useRefusal<Field extends string, Value>({ fieldOfCode, staleData, afterRefusal }: FieldFormSetup<Field, Value>, show: (outcome: Outcome<Field>) => void) {
  const refreshSession = useSessionRefresh();
  return async (failure: unknown): Promise<void> => {
    const refusal = await followUpRefusal(failure, { refreshSession, ...staleData });
    show(refusalOutcome(refusal, fieldOfCode));
    afterRefusal?.(asDashboardApiError(failure).code, refusal);
  };
}

// A refusal that names a field goes beside it; any other goes in the summary.
function refusalOutcome<Field extends string>({ code, values }: Refusal, fieldOfCode: FieldFormSetup<Field, unknown>['fieldOfCode']): Outcome<Field> {
  const field = fieldOfCode[code];
  return field === undefined ? { errors: {}, refusal: code, values } : { errors: { [field]: code } as FieldErrorCodes<Field>, refusal: null, values };
}

function summaryOf<Field extends string>({ errors, refusal }: Outcome<Field>): DisplayedErrorCode | null {
  return refusal ?? (Object.keys(errors).length === 0 ? null : 'FIELDS_INVALID');
}

function withoutField<Field extends string>(errors: FieldErrorCodes<Field>, field: Field): FieldErrorCodes<Field> {
  return Object.fromEntries(Object.entries(errors).filter(([name]) => name !== field)) as FieldErrorCodes<Field>;
}
