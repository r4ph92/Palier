// Fills %{name} placeholders, the same syntax as the mobile app's i18n-js strings.
export function interpolate(template: string, values: Readonly<Record<string, string>>): string {
  return template.replace(/%\{(\w+)\}/g, (placeholder, name: string) => values[name] ?? placeholder);
}
