import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useDiaryWeeks } from '@/api/queries';
import type { DiaryWeek, SchoolClass } from '@/api/types';
import { appointmentLabel, WeekIndex } from '@/components/calendar/week';
import { formatDayMonth, formatRelativeDay, nextSchoolDayIso, startOfWeekIso, todayIso } from '@/lib/dates';
import { openWeek } from '@/lib/navigation';
import { colors, font, radius, shadow, spacing, touchTarget } from '@/theme';

/** Mehr Klassen lädt die Startseite nicht auf einmal (je Klasse ein Abruf). */
const MAX_CLASSES = 6;
const MAX_ITEMS = 4;

type Item = { key: string; text: string; meta: string; tone?: 'danger' | 'accent' };

type ClassToday = { schoolClass: SchoolClass; notes: Item[]; tasks: Item[]; appointments: Item[] };

/** Was heute ansteht: eigene offene Notizen, fällige Aufgaben und Termine je Klasse. */
export function TodayPanel({ classes }: { classes: SchoolClass[] }) {
  const day = nextSchoolDayIso();
  const shown = classes.slice(0, MAX_CLASSES);
  const results = useDiaryWeeks(
    shown.map((c) => c.id),
    startOfWeekIso(day),
  );

  const perClass = shown
    .map((schoolClass, i) => {
      const week = results[i]?.data;
      return week ? summarize(schoolClass, week, day) : null;
    })
    .filter((c): c is ClassToday => !!c && c.notes.length + c.tasks.length + c.appointments.length > 0);

  const loading = results.some((r) => r.isLoading);
  const title = day === todayIso() ? 'Heute' : `Am ${formatRelativeDay(day)}`;

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>{title}</Text>
      {loading && !perClass.length ? <Text style={styles.muted}>Lädt …</Text> : null}
      {!loading && !perClass.length ? (
        <Text style={styles.muted}>Keine offenen Notizen, Aufgaben oder Termine.</Text>
      ) : null}
      {perClass.map((c) => (
        <Pressable
          key={c.schoolClass.id}
          onPress={() => openWeek({ classId: c.schoolClass.id }, c.schoolClass.name)}
          style={({ pressed }) => [styles.classBlock, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`Wochenansicht ${c.schoolClass.name} öffnen`}
        >
          <View style={styles.classHead}>
            <View style={[styles.dot, { backgroundColor: c.schoolClass.color || colors.primary }]} />
            <Text style={styles.className}>{c.schoolClass.name}</Text>
            <Text style={styles.open}>Woche ›</Text>
          </View>
          <Section label="Termine" items={c.appointments} />
          <Section label="Meine offenen Notizen" items={c.notes} />
          <Section label="Aufgaben" items={c.tasks} />
        </Pressable>
      ))}
      {classes.length > MAX_CLASSES ? (
        <Text style={styles.muted}>Weitere Klassen findest du über „Woche“ in der Liste.</Text>
      ) : null}
    </View>
  );
}

function Section({ label, items }: { label: string; items: Item[] }) {
  if (!items.length) return null;
  const rest = items.length - MAX_ITEMS;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>
        {label} ({items.length})
      </Text>
      {items.slice(0, MAX_ITEMS).map((item) => (
        <View key={item.key} style={styles.item}>
          <Text
            style={[styles.itemText, item.tone === 'danger' && styles.danger, item.tone === 'accent' && styles.accent]}
            numberOfLines={2}
          >
            {item.text}
          </Text>
          {item.meta ? <Text style={styles.itemMeta}>{item.meta}</Text> : null}
        </View>
      ))}
      {rest > 0 ? <Text style={styles.muted}>+ {rest} weitere</Text> : null}
    </View>
  );
}

function summarize(schoolClass: SchoolClass, week: DiaryWeek, day: string): ClassToday {
  const index = new WeekIndex(week);
  const name = (id: number) => week.students.find((s) => s.id === id)?.firstname;
  const isHoliday = week.days.find((d) => d.date === day)?.is_holiday ?? false;

  const notes: Item[] = isHoliday
    ? []
    : week.entries
        .filter((e) => e.is_own && !e.is_completed && e.entry_date <= day)
        .map((e) => {
          // Nur Schüler, bei denen die Notiz heute auch erscheint (nicht pausiert/abwesend).
          const names = e.schueler_ids
            .filter((id) => !index.isAbsent(id, day) && index.entriesForCell(id, day).some((x) => x.id === e.id))
            .map(name)
            .filter(Boolean);
          return names.length ? { key: `n${e.id}`, text: e.content, meta: names.join(', ') } : null;
        })
        .filter((i): i is Item => !!i);

  const tasks: Item[] = week.tasks
    .filter((t) => t.highlighted || (t.due_date !== null && t.due_date <= day))
    .sort((a, b) => (a.due_date ?? '9').localeCompare(b.due_date ?? '9'))
    .map((t) => ({
      key: `t${t.id}`,
      text: t.title,
      meta: [name(t.schueler_id), t.due_date ? dueLabel(t.due_date, day) : null].filter(Boolean).join(' · '),
      tone: t.due_date !== null && t.due_date < day ? 'danger' : t.highlighted ? 'accent' : undefined,
    }));

  const appointments: Item[] = week.appointments
    .filter((a) => a.date === day)
    .map((a) => ({
      key: `a${a.id}`,
      text: appointmentLabel(a),
      meta: a.schueler_ids.map(name).filter(Boolean).join(', '),
    }));

  return { schoolClass, notes, tasks, appointments };
}

function dueLabel(due: string, day: string) {
  if (due < day) return `überfällig seit ${formatDayMonth(due)}`;
  if (due === day) return 'fällig heute';
  return `bis ${formatDayMonth(due)}`;
}

const styles = StyleSheet.create({
  panel: { gap: spacing.md },
  title: { fontSize: font.size.xl, fontWeight: font.weight.bold, color: colors.text },
  muted: { fontSize: font.size.sm, color: colors.textMuted },
  pressed: { opacity: 0.8 },
  classBlock: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    minHeight: touchTarget,
    ...shadow,
  },
  classHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  className: { flex: 1, fontSize: font.size.md, fontWeight: font.weight.semibold, color: colors.text },
  open: { color: colors.primary, fontSize: font.size.sm, fontWeight: font.weight.semibold },
  section: { gap: spacing.xs },
  sectionLabel: { fontSize: font.size.xs, fontWeight: font.weight.semibold, color: colors.textMuted },
  item: { borderLeftWidth: 3, borderLeftColor: colors.border, paddingLeft: spacing.sm },
  itemText: { fontSize: font.size.sm, color: colors.text },
  itemMeta: { fontSize: font.size.xs, color: colors.textMuted },
  danger: { color: colors.danger, fontWeight: font.weight.semibold },
  accent: { color: colors.accent, fontWeight: font.weight.semibold },
});
