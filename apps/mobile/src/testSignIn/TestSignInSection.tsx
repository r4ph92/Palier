import type { TestDriverListResponse } from '@palier/shared-types';
import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { PalierStatusError, PalierUnreachableError } from '../api/LotsClient';
import { ErrorState } from '../components/ErrorState';
import { PrimaryButton } from '../components/PrimaryButton';
import { TITLE_MAX_FONT_SCALE } from '../components/ScreenHeader';
import { useAnnouncement } from '../components/useAnnouncement';
import { useColors } from '../theme/useColors';
import { spacing } from '../theme/tokens';
import { typography } from '../theme/typography';
import type { TestSignInClient } from './TestSignInClient';
import { testSignInText } from './testSignInText';

const NOT_FOUND = 404;

export interface TestSignInSectionProps {
  readonly client: TestSignInClient;
  readonly onSignedIn: (token: string) => Promise<void>;
}

type TestSignInState =
  | { readonly status: 'closed' }
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'open'; readonly drivers: TestDriverListResponse; readonly driverGone: boolean };

export function TestSignInSection({ client, onSignedIn }: TestSignInSectionProps) {
  const { state, open, signInAs } = useTestSignIn(client, onSignedIn);
  const text = testSignInText();
  switch (state.status) {
    case 'closed':
      return <PrimaryButton label={text.testSignIn} onPress={open} />;
    case 'loading':
      return <ActivityIndicator accessibilityLabel={text.loadingDrivers} style={styles.loading} />;
    case 'error':
      return <ErrorState onRetry={open} />;
    case 'open':
      return <DriverPicker drivers={state.drivers} driverGone={state.driverGone} onPick={signInAs} />;
  }
}

function useTestSignIn(client: TestSignInClient, onSignedIn: (token: string) => Promise<void>) {
  const [state, setState] = useState<TestSignInState>({ status: 'closed' });
  const open = useCallback(() => {
    setState({ status: 'loading' });
    loadDrivers(client, setState, false);
  }, [client]);
  const signInAs = useCallback(
    (driverId: string) => {
      setState({ status: 'loading' });
      signInThenRecover({ client, onSignedIn, setState }, driverId);
    },
    [client, onSignedIn],
  );
  return { state, open, signInAs };
}

interface SignInTools {
  readonly client: TestSignInClient;
  readonly onSignedIn: (token: string) => Promise<void>;
  readonly setState: Dispatch<SetStateAction<TestSignInState>>;
}

function signInThenRecover({ client, onSignedIn, setState }: SignInTools, driverId: string) {
  client
    .signInAsTestDriver(driverId)
    .then(({ token }) => onSignedIn(token))
    .catch((error: unknown) =>
      error instanceof PalierStatusError && error.status === NOT_FOUND ? loadDrivers(client, setState, true) : settleFailure(setState, error),
    );
}

function loadDrivers(client: TestSignInClient, setState: Dispatch<SetStateAction<TestSignInState>>, driverGone: boolean) {
  client
    .listTestDrivers()
    .then((drivers) => setState({ status: 'open', drivers, driverGone }), (error: unknown) => settleFailure(setState, error));
}

// An error rejected in an async callback bypasses error boundaries; throwing from a state updater re-raises it during render.
function settleFailure(setState: Dispatch<SetStateAction<TestSignInState>>, error: unknown) {
  setState(() => {
    if (error instanceof PalierUnreachableError) {
      return { status: 'error' };
    }
    throw error;
  });
}

function DriverPicker({
  drivers,
  driverGone,
  onPick,
}: {
  readonly drivers: TestDriverListResponse;
  readonly driverGone: boolean;
  readonly onPick: (driverId: string) => void;
}) {
  return (
    <View style={styles.picker}>
      <PickerIntro driverGone={driverGone} />
      {drivers.map((driver) => (
        <PrimaryButton key={driver.id} label={`${driver.firstName} ${driver.lastName}`} onPress={() => onPick(driver.id)} />
      ))}
    </View>
  );
}

function PickerIntro({ driverGone }: { readonly driverGone: boolean }) {
  const colors = useColors();
  const text = testSignInText();
  useAnnouncement(driverGone ? text.driverGone : null);
  return (
    <>
      <Text accessibilityRole="header" maxFontSizeMultiplier={TITLE_MAX_FONT_SCALE} style={[typography.bodyStrong, { color: colors.ink }]}>
        {text.testSignIn}
      </Text>
      <Text style={[typography.body, { color: colors.muted }]}>{text.pickDriver}</Text>
      {driverGone ? <Text style={[typography.body, { color: colors.ink }]}>{text.driverGone}</Text> : null}
    </>
  );
}

const styles = StyleSheet.create({
  loading: { alignSelf: 'flex-start', paddingVertical: spacing.large },
  picker: { gap: spacing.small },
});
