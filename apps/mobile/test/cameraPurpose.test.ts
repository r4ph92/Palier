import appConfig from '../app.config';

describe('the iOS camera purpose string', () => {
  it('is in the base Info.plist, without which Apple refuses the build', () => {
    expect(appConfig.ios?.infoPlist?.NSCameraUsageDescription).toMatch(/QR de la borne/);
  });

  it.each([
    ['fr', /lire le QR de la borne/],
    ['en', /read the terminal’s QR/],
  ])('explains the entry QR scan in %s', (language, reason) => {
    const strings = appConfig.locales?.[language] as Record<string, string>;

    expect(strings.NSCameraUsageDescription).toMatch(reason);
  });
});
