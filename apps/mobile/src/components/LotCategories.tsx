import type { SpotCountByCategory } from '@palier/shared-types';
import { Text } from 'react-native';
import { categoryLine } from '../lots/lotText';
import { useColors } from '../theme/useColors';
import { typography } from '../theme/typography';

interface LotCategoriesProps {
  readonly counts: SpotCountByCategory;
}

export function LotCategories({ counts }: LotCategoriesProps) {
  const colors = useColors();
  return <Text style={[typography.countLabel, { color: colors.muted }]}>{categoryLine(counts)}</Text>;
}
