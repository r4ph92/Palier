import { Text } from 'react-native';
import { useColors } from '../theme/useColors';
import { typography } from '../theme/typography';

export function FieldError({ message }: { readonly message: string }) {
  const colors = useColors();
  return (
    <Text accessibilityRole="alert" style={[typography.body, { color: colors.danger }]}>
      {message}
    </Text>
  );
}
