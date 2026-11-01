// The app sends its version in this header; the API answers 426 when that version is below the minimum it accepts.
export const APP_VERSION_HEADER = 'x-palier-app-version';

// Dotted numbers such as 1.2.0; the API reads the minimum version and the app's version with this.
export const VERSION_PATTERN = /^\d+(\.\d+)*$/;
