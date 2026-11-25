import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { FieldError } from '../components/FieldError';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenFrame } from '../components/ScreenFrame';
import { BODY_TEXT_MAX_FONT_SCALE, ScreenHeader } from '../components/ScreenHeader';
import { i18n } from '../i18n/i18n';
import { useColors } from '../theme/useColors';
import { MINIMUM_TOUCH_TARGET, spacing } from '../theme/tokens';
import { typography } from '../theme/typography';
import { useSingleFlight } from '../useSingleFlight';

// The API keeps 50 characters at most.
const NAME_MAX_LENGTH = 50;

interface NameScreenProps {
  readonly onSave: (firstName: string, lastName: string) => Promise<void>;
}

type NameError = 'firstNameRequired' | 'failed' | null;

// Shown after the notice when the provider gave no name, as Apple does after the first sign-in.
export function NameScreen({ onSave }: NameScreenProps) {
  const colors = useColors();
  const { firstName, setFirstName, lastName, setLastName, error, saving, save } = useNameForm(onSave);
  return (
    <ScreenFrame>
      <ScreenHeader eyebrow="Palier" title={i18n.t('name.title')} />
      <Text maxFontSizeMultiplier={BODY_TEXT_MAX_FONT_SCALE} style={[typography.body, { color: colors.muted }]}>{i18n.t('name.intro')}</Text>
      <NameField label={i18n.t('name.firstName')} value={firstName} onChange={setFirstName} autoComplete="given-name" />
      {error === 'firstNameRequired' ? <FieldError message={i18n.t('name.firstNameRequired')} /> : null}
      <NameField label={i18n.t('name.lastName')} value={lastName} onChange={setLastName} autoComplete="family-name" />
      <PrimaryButton label={i18n.t('name.save')} busy={saving} busyLabel={i18n.t('name.busy')} onPress={save} />
      {error === 'failed' ? <FieldError message={i18n.t('name.failed')} /> : null}
    </ScreenFrame>
  );
}

function useNameForm(onSave: NameScreenProps['onSave']) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState<NameError>(null);
  const { runningKey, run } = useSingleFlight<'save'>();
  const save = () => {
    if (firstName.trim() === '') {
      setError('firstNameRequired');
      return;
    }
    run('save', () => {
      setError(null);
      return onSave(firstName.trim(), lastName.trim()).catch(() => setError('failed'));
    });
  };
  return { firstName, setFirstName, lastName, setLastName, error, saving: runningKey === 'save', save };
}

interface NameFieldProps {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly autoComplete: 'given-name' | 'family-name';
}

function NameField({ label, value, onChange, autoComplete }: NameFieldProps) {
  const colors = useColors();
  return (
    <View style={styles.field}>
      <Text maxFontSizeMultiplier={BODY_TEXT_MAX_FONT_SCALE} style={[typography.bodyStrong, { color: colors.ink }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoComplete={autoComplete}
        autoCorrect={false}
        maxLength={NAME_MAX_LENGTH}
        maxFontSizeMultiplier={BODY_TEXT_MAX_FONT_SCALE}
        value={value}
        onChangeText={onChange}
        style={[typography.body, styles.input, { color: colors.ink, borderColor: colors.ink }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.small, paddingTop: spacing.medium },
  input: { minHeight: MINIMUM_TOUCH_TARGET, paddingHorizontal: spacing.medium, borderWidth: 2 },
});
