import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, font, radius, spacing } from '@/theme';

/** Skala wie im Web (`public-student-session.blade.php`). */
export const SCALE = [
  { value: 1, emoji: '😞', label: 'Sehr schlecht', color: '#DC3545' },
  { value: 2, emoji: '😟', label: 'Schlecht', color: '#FD7E14' },
  { value: 3, emoji: '😐', label: 'Mittel', color: '#6C757D' },
  { value: 4, emoji: '🙂', label: 'Gut', color: '#0AA2C0' },
  { value: 5, emoji: '🤩', label: 'Sehr gut', color: '#198754' },
] as const;

export const scaleInfo = (v: number | null | undefined) => SCALE.find((s) => s.value === v) ?? null;

/** Kompakte 1–5-Auswahl für Lehrkräfte. Erneutes Tippen auf den aktiven Wert entfernt ihn. */
export function RatingScale({
  value,
  onChange,
  disabled,
  compact,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {SCALE.map((s) => {
        const active = value === s.value;
        return (
          <Pressable
            key={s.value}
            disabled={disabled}
            onPress={() => {
              void Haptics.selectionAsync();
              onChange(active ? null : s.value);
            }}
            accessibilityRole="radio"
            accessibilityLabel={`${s.value} – ${s.label}`}
            accessibilityState={{ checked: active, disabled: !!disabled }}
            style={({ pressed }) => [
              styles.button,
              compact && styles.compact,
              active && { backgroundColor: s.color, borderColor: s.color },
              pressed && { opacity: 0.7 },
              disabled && { opacity: 0.4 },
            ]}
          >
            <Text style={[styles.number, active && styles.numberActive]}>{s.value}</Text>
            {!compact ? <Text style={styles.emoji}>{s.emoji}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Anzeige einer Selbsteinschätzung als Smiley. */
export function SelfRatingBadge({ value }: { value: number | null | undefined }) {
  const info = scaleInfo(value);
  return (
    <View
      style={styles.badge}
      accessibilityLabel={info ? `Selbsteinschätzung: ${info.label}` : 'Keine Selbsteinschätzung'}
    >
      <Text style={styles.badgeLabel}>selbst</Text>
      <Text style={styles.badgeEmoji}>{info ? info.emoji : '–'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  button: {
    flex: 1,
    minWidth: 48,
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: { minHeight: 44, minWidth: 44 },
  number: { fontSize: font.size.lg, fontWeight: font.weight.bold, color: colors.text },
  numberActive: { color: colors.onPrimary },
  emoji: { fontSize: 14 },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 52,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.divider,
  },
  badgeLabel: { fontSize: 10, color: colors.textMuted },
  badgeEmoji: { fontSize: 20 },
});
