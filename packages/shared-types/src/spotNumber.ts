const SEPARATORS = /[\s–—-]/g;

// The painted number with case, spaces and dashes set aside: « b3 », « B 3 », « B – 3 » and « B-3 » all read « B3 »,
// while « B-03 » stays « B03 ». The app and the API compare spot numbers this way.
export function canonicalSpotNumber(spotNumber: string): string {
  return spotNumber.toUpperCase().replace(SEPARATORS, '');
}
