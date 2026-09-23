import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { WeekEntry, WeekStudent } from '@/api/types';
import { colors, font, radius, spacing } from '@/theme';

import type { WeekActions } from './useWeekActions';
import { AMPEL_LABELS, appointmentLabel, nextColumnValue, type WeekIndex } from './week';

type Props = {
  index: WeekIndex;
  student: WeekStudent;
  date: string;
  actions: WeekActions;
  showPaused: boolean;
  /** Kompakte Darstellung für die Wochentabelle (iPad quer). */
  compact?: boolean;
};

/** Inhalt einer Zelle Schüler × Tag: Einträge, pausierte Notizen, Abhak-Spalten, Schüler-Termine. */
export function StudentDay({ index, student, date, actions, showPaused, compact }: Props) {
  if (index.isAbsent(student.id, date)) {
    return (
      <View style={styles.absent}>
        <Text style={styles.absentText}>Abwesend</Text>
      </View>
    );
  }

  const entries = index.entriesForCell(student.id, date);
  const paused = showPaused ? index.pausedForCell(student.id, date) : [];
  const columns = index.columnsFor(student);
  const appointments = index.studentAppointments(student.id, date);

  return (
    <View style={styles.wrap}>
      {appointments.map((a) => (
        <View key={`apt-${a.id}`} style={styles.appointment}>
          <Text style={styles.appointmentText} numberOfLines={2}>
            {appointmentLabel(a)}
          </Text>
        </View>
      ))}

      {entries.map((e) => (
        <EntryRow
          key={`e-${e.id}`}
          entry={e}
          compact={compact}
          onPress={() => actions.entryMenu(e, student, date)}
          onComplete={e.is_completed ? undefined : () => actions.complete(e, student, date)}
        />
      ))}

      {paused.map((e) => (
        <EntryRow
          key={`p-${e.id}`}
          entry={e}
          compact={compact}
          paused
          onPress={() => actions.entryMenu(e, student, date, true)}
        />
      ))}

      {columns.length ? (
        <View style={styles.columns}>
          {columns.map((c) =>
            c.type === 'text' ? (
              <TextInput
                // Neu aufbauen, wenn sich der Serverwert ändert (unkontrolliertes Feld).
                key={`${c.id}-${index.columnValue(c.id, student.id, date)}`}
                defaultValue={index.columnValue(c.id, student.id, date)}
                placeholder={c.name}
                placeholderTextColor={colors.textSubtle}
                accessibilityLabel={c.name}
                maxLength={255}
                style={[styles.textColumn, compact && styles.textColumnCompact]}
                onEndEditing={(ev) => {
                  const text = ev.nativeEvent.text.trim();
                  if (text !== index.columnValue(c.id, student.id, date)) {
                    actions.setColumn(c.id, student, date, text || null);
                  }
                }}
              />
            ) : (
              <ColumnToggle
                key={c.id}
                label={c.name}
                type={c.type}
                value={index.columnValue(c.id, student.id, date)}
                onPress={(value) => actions.setColumn(c.id, student, date, value)}
              />
            ),
          )}
        </View>
      ) : null}
    </View>
  );
}

function EntryRow({
  entry,
  compact,
  paused,
  onPress,
  onComplete,
}: {
  entry: WeekEntry;
  compact?: boolean;
  paused?: boolean;
  onPress: () => void;
  onComplete?: () => void;
}) {
  const open = !entry.is_completed;
  return (
    <View style={[styles.entry, open && styles.entryOpen, paused && styles.entryPaused]}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.entryBody, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`${open ? 'Offene Notiz' : 'Eintrag'}${paused ? ', pausiert' : ''}: ${entry.content}`}
      >
        <View style={styles.entryMeta}>
          {entry.category_name ? (
            <>
              <View style={[styles.dot, { backgroundColor: entry.category_color || colors.textSubtle }]} />
              <Text style={styles.category} numberOfLines={1}>
                {entry.category_name}
              </Text>
            </>
          ) : null}
          {paused ? <Text style={styles.badge}>⏸ pausiert</Text> : null}
          {!entry.is_own && entry.created_by_name && !compact ? (
            <Text style={styles.author} numberOfLines={1}>
              {entry.created_by_name}
            </Text>
          ) : null}
        </View>
        <Text style={[styles.entryText, paused && styles.entryTextPaused]} numberOfLines={compact ? 3 : 5}>
          {entry.content}
        </Text>
      </Pressable>
      {onComplete ? (
        <Pressable
          onPress={onComplete}
          hitSlop={4}
          style={({ pressed }) => [styles.check, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Notiz abschließen"
        >
          <Text style={styles.checkText}>✓</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function ColumnToggle({
  label,
  type,
  value,
  onPress,
}: {
  label: string;
  type: 'boolean' | 'ampel';
  value: string;
  onPress: (value: string | null) => void;
}) {
  const state =
    type === 'boolean'
      ? value === '1'
        ? styles.toggleYes
        : null
      : value === '1'
        ? styles.toggleYes
        : value === '2'
          ? styles.toggleProgress
          : value === '3'
            ? styles.toggleNo
            : null;
  const stateLabel = type === 'boolean' ? (value === '1' ? 'erledigt' : 'offen') : (AMPEL_LABELS[value] ?? 'offen');
  return (
    <Pressable
      onPress={() => onPress(nextColumnValue(type, value))}
      hitSlop={4}
      style={({ pressed }) => [styles.toggle, state, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${stateLabel}`}
    >
      <Text style={[styles.toggleText, state && styles.toggleTextActive]} numberOfLines={1}>
        {type === 'boolean' && value === '1' ? '✓ ' : ''}
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  pressed: { opacity: 0.7 },

  absent: { backgroundColor: colors.dangerSoft, borderRadius: radius.sm, padding: spacing.sm },
  absentText: { color: colors.danger, fontSize: font.size.sm, fontWeight: font.weight.semibold },

  appointment: {
    backgroundColor: colors.warningSoft,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  appointmentText: { fontSize: font.size.xs, color: colors.text },

  entry: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
  },
  entryOpen: { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft },
  entryPaused: { backgroundColor: colors.divider, borderColor: colors.divider },
  entryBody: { flex: 1, minHeight: 40, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, gap: 2 },
  entryMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  category: { fontSize: font.size.xs, color: colors.textMuted, fontWeight: font.weight.medium, flexShrink: 1 },
  badge: { fontSize: font.size.xs, color: colors.textMuted },
  author: { fontSize: font.size.xs, color: colors.textSubtle, flexShrink: 1 },
  entryText: { fontSize: font.size.sm, color: colors.text, lineHeight: 19 },
  entryTextPaused: { color: colors.textMuted, fontStyle: 'italic' },
  check: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.border,
  },
  checkText: { fontSize: font.size.lg, color: colors.success, fontWeight: font.weight.bold },

  columns: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  toggle: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    maxWidth: 180,
  },
  toggleYes: { backgroundColor: colors.success, borderColor: colors.success },
  toggleProgress: { backgroundColor: colors.warning, borderColor: colors.warning },
  toggleNo: { backgroundColor: colors.danger, borderColor: colors.danger },
  toggleText: { fontSize: font.size.xs, color: colors.text, fontWeight: font.weight.medium },
  toggleTextActive: { color: colors.onPrimary },
  textColumn: {
    minHeight: 40,
    minWidth: 120,
    flexGrow: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    fontSize: font.size.sm,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  textColumnCompact: { minWidth: 80 },
});
