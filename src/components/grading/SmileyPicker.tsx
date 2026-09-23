import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { colors, font, radius, spacing } from '@/theme';

import { SCALE } from './scale';

/** Große, kindgerechte Smiley-Auswahl für die Selbsteinschätzung. */
export function SmileyPicker({
  value,
  onPick,
  disabled,
}: {
  value: number | null;
  onPick: (v: number) => void;
  disabled?: boolean;
}) {
  const { width } = useWindowDimensions();
  const size = Math.min(140, Math.max(56, (width - spacing.lg * 2 - spacing.md * 4) / 5));

  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {SCALE.map((s) => {
        const active = value === s.value;
        return (
          <Pressable
            key={s.value}
            disabled={disabled}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onPick(s.value);
            }}
            accessibilityRole="radio"
            accessibilityLabel={s.label}
            accessibilityState={{ checked: active }}
            style={({ pressed }) => [
              styles.button,
              { width: size, height: size + 28 },
              active && { borderColor: s.color, backgroundColor: `${s.color}22` },
              pressed && { transform: [{ scale: 0.95 }] },
            ]}
          >
            <Text style={{ fontSize: size * 0.55 }}>{s.emoji}</Text>
            <Text style={[styles.label, active && { color: s.color }]} numberOfLines={1}>
              {s.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: 3,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  label: { fontSize: font.size.xs, color: colors.textMuted, fontWeight: font.weight.semibold },
});
