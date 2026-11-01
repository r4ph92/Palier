import { APP_VERSION_HEADER } from '@palier/shared-types/appVersion';

// Keep in step with the version in app.config.ts; a test checks that the two match.
export const APP_VERSION = '0.1.0';
// Set in the builds that ship to the stores; without it the update screen has no button.
export const STORE_URL: string | undefined = process.env.EXPO_PUBLIC_STORE_URL || undefined;

const UPDATE_REQUIRED = 426;

let updateRequiredListener: (() => void) | null = null;

export function onUpdateRequired(listener: () => void): () => void {
  updateRequiredListener = listener;
  return () => {
    if (updateRequiredListener === listener) {
      updateRequiredListener = null;
    }
  };
}

// Every client sends its requests through here, so the version header and the update answer are handled once.
export const palierFetch: typeof fetch = async (input, init = {}) => {
  const headers = new Headers(init.headers);
  headers.set(APP_VERSION_HEADER, APP_VERSION);
  const response = await fetch(input, { ...init, headers });
  if (response.status === UPDATE_REQUIRED) {
    updateRequiredListener?.();
  }
  return response;
};
