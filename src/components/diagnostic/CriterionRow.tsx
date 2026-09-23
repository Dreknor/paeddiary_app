import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { DiagnosticCriterion, DiagnosticRating } from '@/api/types';
import { colors, font, radius, spacing } from '@/theme';

import { nextRating, ratingInfo } from './rating';

type Props = {
  criterion: DiagnosticCriterion;
  rating: DiagnosticRating | null;
  isCurrentGoal: boolean;
  previous?: DiagnosticRating | null;
  changed: boolean;
  onRate: (r: DiagnosticRating | null) => void;
  onToggleGoal: () => void;
  onCreateGoal: () => void;
};

/**
 * Ein Katalogkriterium: Tippen auf die Ampel schaltet weiter (leer → kann es → Ziel → kann es nicht),
 * ⭐ markiert es als aktuelles Ziel, „+ Ziel“ übernimmt es als Entwicklungsziel.
 */
export function CriterionRow({
  criterion,
  rating,
  isCurrentGoal,
  previous,
  changed,
  onRate,
  onToggleGoal,
  onCreateGoal,
}: Props) {
  const info = ratingInfo(rating);
  const prev = ratingInfo(previous);

  return (
    <View style={[styles.row, changed && styles.changed]}>
      <View style={styles.text}>
        <Text style={styles.code}>{criterion.code}</Text>
        <Text style={styles.description}>{criterion.description}</Text>
        {prev ? <Text style={styles.previous}>zuletzt: {prev.label}</Text> : null}
      </View>
      <View style={styles.actions}>
        <Pressable
          onPress={() => {
            void Haptics.selectionAsync();
            onRate(nextRating(rating));
          }}
          onLongPress={() => onRate(null)}
          accessibilityRole="button"
          accessibilityLabel={`Bewertung: ${info?.label ?? 'keine'}. Tippen zum Wechseln.`}
          style={[styles.rating, info ? { backgroundColor: info.color, borderColor: info.border } : styles.ratingEmpty]}
        >
          <Text style={[styles.ratingText, info ? { color: info.text } : null]} numberOfLines={1}>
            {info?.label ?? 'bewerten'}
          </Text>
        </Pressable>
        <View style={styles.smallActions}>
          <Pressable
            onPress={onToggleGoal}
            hitSlop={8}
            accessibilityRole="switch"
            accessibilityState={{ checked: isCurrentGoal }}
            accessibilityLabel="Als aktuelles Ziel markieren"
            style={[styles.small, isCurrentGoal && styles.smallActive]}
          >
            <Text style={styles.smallText}>{isCurrentGoal ? '⭐' : '☆'}</Text>
          </Pressable>
          <Pressable
            onPress={onCreateGoal}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Als Entwicklungsziel übernehmen"
            style={styles.small}
          >
            <Text style={[styles.smallText, styles.plus]}>+ Ziel</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderLeftWidth: 4,
    borderLeftColor: 'transparent',
  },
  changed: { borderLeftColor: colors.primary },
  text: { flex: 1, gap: 2 },
  code: { fontSize: font.size.xs, fontWeight: font.weight.bold, color: colors.primary },
  description: { fontSize: font.size.md, color: colors.text, lineHeight: 22 },
  previous: { fontSize: font.size.xs, color: colors.textSubtle },
  actions: { alignItems: 'flex-end', gap: spacing.sm, width: 128 },
  rating: {
    width: 128,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  ratingEmpty: { borderStyle: 'dashed', borderColor: colors.textSubtle, backgroundColor: colors.background },
  ratingText: { fontSize: font.size.sm, fontWeight: font.weight.semibold, color: colors.textMuted },
  smallActions: { flexDirection: 'row', gap: spacing.sm },
  small: {
    minHeight: 36,
    minWidth: 40,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.divider,
  },
  smallActive: { backgroundColor: colors.warningSoft },
  smallText: { fontSize: font.size.md },
  plus: { fontSize: font.size.sm, color: colors.primary, fontWeight: font.weight.semibold },
});
