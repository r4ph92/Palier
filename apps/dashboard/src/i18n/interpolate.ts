export const PLACEHOLDER_PATTERN = /%\{(\w+)\}/g;

// Fills %{name} placeholders, the same syntax as the mobile app's i18n-js strings.
export function interpolate(template: string, values: Readonly<Record<string, string>>): string {
  return template.replace(PLACEHOLDER_PATTERN, (placeholder, name: string) => values[name] ?? placeholder);
}
