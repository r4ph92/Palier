import { EXIT_IDENTIFICATIONS, GATE_INTEGRATION_KINDS } from '@palier/shared-types/gateDraft';
import type { ReactNode } from 'react';
import { CheckboxField } from '../forms/CheckboxField.tsx';
import type { BoundField } from '../forms/fieldBinder.ts';
import { SelectField } from '../forms/SelectField.tsx';
import { TextField } from '../forms/TextField.tsx';
import { useText } from '../i18n/LanguageContext.tsx';
import type { GateFormField } from './gateFormValues.ts';

interface GateFieldsProps {
  readonly field: (name: GateFormField) => BoundField;
  readonly isExit: boolean;
  // The direction, chosen only when the gate is added: it goes right after the name.
  readonly kindField?: ReactNode;
}

// Every setting of a gate; the endpoint stays visible for every connection, and the exit identification shows for an exit gate only.
export function GateFields({ field, isExit, kindField = null }: GateFieldsProps) {
  const { gates: text } = useText();
  const integrationOptions = GATE_INTEGRATION_KINDS.map((kind) => ({ value: kind, label: text.integrations[kind] }));
  return (
    <>
      <TextField {...field('name')} label={text.nameLabel} />
      {kindField}
      <SelectField field={field('integrationKind')} label={text.integrationLabel} hint={text.integrationHint} options={integrationOptions} />
      <TextField {...field('endpoint')} label={text.endpointLabel} hint={text.endpointHint} inputMode="url" />
      <CheckboxField field={field('reportsLoops')} label={text.loopsCheckbox} hint={text.loopsHint} />
      {isExit ? <ExitIdentificationField field={field('exitIdentification')} /> : null}
    </>
  );
}

function ExitIdentificationField({ field }: { readonly field: BoundField }) {
  const { gates: text } = useText();
  const options = EXIT_IDENTIFICATIONS.map((identification) => ({ value: identification, label: text.exitIdentifications[identification] }));
  return <SelectField field={field} label={text.exitIdentificationLabel} hint={text.exitIdentificationHint} options={options} />;
}
