import type { TestDriverListResponse } from '@palier/shared-types';
import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AuthClient } from '../api/AuthClient';
import { PalierStatusError, PalierUnreachableError } from '../api/LotsClient';
import { ErrorState } from '../components/ErrorState';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader, TITLE_MAX_FONT_SCALE } from '../components/ScreenHeader';
import { i18n } from '../i18n/i18n';
import { useColors } from '../theme/useColors';
import { spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

const NOT_FOUND = 404;

interface SignInScreenProps {
  readonly testSignInEnabled: boolean;
  readonly authClient: AuthClient;
  readonly onSignIn: (driverId: string) => Promise<void>;
}

type TestSignInState =
  | { readonly status: 'closed' }
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'open'; readonly drivers: TestDriverListResponse; readonly driverGone: boolean };

export function SignInScreen({ testSignInEnabled, authClient, onSignIn }: SignInScreenProps) {
  const colors = useColors();
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.canvas }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader eyebrow="Palier" title={i18n.t('signIn.title')} />
        {testSignInEnabled ? <TestSignIn authClient={authClient} onSignIn={onSignIn} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function TestSignIn({ authClient, onSignIn }: Omit<SignInScreenProps, 'testSignInEnabled'>) {
  const { state, open, signInAs } = useTestSignIn(authClient, onSignIn);
  switch (state.status) {
    case 'closed':
      return <PrimaryButton label={i18n.t('signIn.testSignIn')} onPress={open} />;
    case 'loading':
      return <ActivityIndicator accessibilityLabel={i18n.t('signIn.loadingDrivers')} style={styles.loading} />;
    case 'error':
      return <ErrorState onRetry={open} />;
    case 'open':
      return <DriverPicker drivers={state.drivers} driverGone={state.driverGone} onPick={signInAs} />;
  }
}

function useTestSignIn(authClient: AuthClient, onSignIn: (driverId: string) => Promise<void>) {
  const [state, setState] = useState<TestSignInState>({ status: 'closed' });
  const open = useCallback(() => {
    setState({ status: 'loading' });
    loadDrivers(authClient, setState, false);
  }, [authClient]);
  const signInAs = useCallback(
    (driverId: string) => {
      setState({ status: 'loading' });
      onSignIn(driverId).catch((error: unknown) =>
        error instanceof PalierStatusError && error.status === NOT_FOUND
          ? loadDrivers(authClient, setState, true)
          : settleFailure(setState, error),
      );
    },
    [authClient, onSignIn],
  );
  return { state, open, signInAs };
}

function loadDrivers(authClient: AuthClient, setState: Dispatch<SetStateAction<TestSignInState>>, driverGone: boolean) {
  authClient
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
  return (
    <>
      <Text accessibilityRole="header" maxFontSizeMultiplier={TITLE_MAX_FONT_SCALE} style={[typography.bodyStrong, { color: colors.ink }]}>
        {i18n.t('signIn.testSignIn')}
      </Text>
      <Text style={[typography.body, { color: colors.muted }]}>{i18n.t('signIn.pickDriver')}</Text>
      {driverGone ? <Text style={[typography.body, { color: colors.ink }]}>{i18n.t('signIn.driverGone')}</Text> : null}
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, gap: spacing.medium, paddingHorizontal: spacing.medium },
  loading: { alignSelf: 'flex-start', paddingVertical: spacing.large },
  picker: { gap: spacing.small },
});
