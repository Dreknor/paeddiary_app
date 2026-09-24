import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, font, radius, shadow, spacing, touchTarget } from '@/theme';

/** Auswahl-Chip, optional mit Farbpunkt (Kategorie) oder Symbol (z. B. Stufenbild). */
export function Chip({
  label,
  selected,
  onPress,
  color,
  disabled,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string | null;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      hitSlop={4}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        selected && color ? { backgroundColor: color, borderColor: color } : null,
        pressed && { opacity: 0.75 },
        disabled && { opacity: 0.5 },
      ]}
    >
      {color && !selected ? <View style={[styles.chipDot, { backgroundColor: color }]} /> : null}
      {icon}
      <Text style={[styles.chipText, selected && styles.chipTextSelected]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.segment, style]} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.segmentButton, active && styles.segmentButtonActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SwitchRow({
  label,
  hint,
  value,
  onValueChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <Pressable
      style={styles.switchRow}
      onPress={() => onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
    >
      <View style={styles.switchText}>
        <Text style={styles.switchLabel}>{label}</Text>
        {hint ? <Text style={styles.switchHint}>{hint}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: colors.primary }} />
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {action}
    </View>
  );
}

export function LinkButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button">
      <Text style={styles.link}>{label}</Text>
    </Pressable>
  );
}

/** Schwebender Aktionsknopf unten rechts (Daumenbereich). */
export function Fab({ label, onPress, icon = '+' }: { label: string; onPress: () => void; icon?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.fab, { bottom: spacing.xl + insets.bottom }, pressed && { opacity: 0.85 }]}
    >
      <Text style={styles.fabIcon}>{icon}</Text>
      <Text style={styles.fabLabel}>{label}</Text>
    </Pressable>
  );
}

/** Leiste am unteren Rand (z. B. Aktionen für ausgewählte Schüler). */
export function BottomBar({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return <View style={[styles.bottomBar, { paddingBottom: spacing.md + insets.bottom }]}>{children}</View>;
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    maxWidth: 260,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipDot: { width: 10, height: 10, borderRadius: 5 },
  chipText: { fontSize: font.size.sm, color: colors.text, fontWeight: font.weight.medium },
  chipTextSelected: { color: colors.onPrimary },

  segment: { flexDirection: 'row', backgroundColor: colors.divider, borderRadius: radius.md, padding: 3 },
  segmentButton: {
    flex: 1,
    paddingHorizontal: spacing.md,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  segmentButtonActive: { backgroundColor: colors.surface, ...shadow },
  segmentText: { fontSize: font.size.sm, color: colors.textMuted, fontWeight: font.weight.medium },
  segmentTextActive: { color: colors.primary, fontWeight: font.weight.semibold },

  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: touchTarget },
  switchText: { flex: 1 },
  switchLabel: { fontSize: font.size.md, color: colors.text },
  switchHint: { fontSize: font.size.xs, color: colors.textMuted },

  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm, ...shadow },

  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  sectionTitle: { fontSize: font.size.lg, fontWeight: font.weight.semibold, color: colors.text, flexShrink: 1 },
  link: { fontSize: font.size.md, color: colors.primary, fontWeight: font.weight.medium },

  fab: {
    position: 'absolute',
    right: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 56,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    ...shadow,
    elevation: 6,
  },
  fabIcon: { color: colors.onPrimary, fontSize: 26, fontWeight: font.weight.bold, lineHeight: 28 },
  fabLabel: { color: colors.onPrimary, fontSize: font.size.md, fontWeight: font.weight.semibold },

  bottomBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
