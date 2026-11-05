import type { SpotCountByCategory } from '@palier/shared-types';
import { Text, View } from 'react-native';
import { categoryLine, categoryLines } from '../lots/lotText';
import { useColors } from '../theme/useColors';
import { useIsLargeText } from '../theme/useIsLargeText';
import { typography } from '../theme/typography';

interface LotCategoriesProps {
  readonly counts: SpotCountByCategory;
}

// At large text sizes each category takes its own line, so a label and its count never split inside a word.
export function LotCategories({ counts }: LotCategoriesProps) {
  const colors = useColors();
  const style = [typography.countLabel, { color: colors.muted }];
  if (!useIsLargeText()) {
    return <Text style={style}>{categoryLine(counts)}</Text>;
  }
  return (
    <View>
      {categoryLines(counts).map((line) => (
        <Text key={line} style={style}>
          {line}
        </Text>
      ))}
    </View>
  );
}
