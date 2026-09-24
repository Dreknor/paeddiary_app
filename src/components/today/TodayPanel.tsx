import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useDiaryWeeks } from '@/api/queries';
import type { DiaryWeek, WeekScope } from '@/api/types';
import { LinkButton } from '@/components/controls';
import { appointmentLabel, WeekIndex } from '@/components/calendar/week';
import { formatDayMonth, formatRelativeDay, nextSchoolDayIso, startOfWeekIso, todayIso } from '@/lib/dates';
import { openWeek } from '@/lib/navigation';
import { colors, font, radius, shadow, spacing, touchTarget } from '@/theme';

const MAX_ITEMS = 4;

type Item = { key: string; text: string; meta: string; tone?: 'danger' | 'accent' };

/** Klasse oder Lerngruppe, die bei „Heute“ erscheint. */
export type TodayTarget = { key: string; scope: WeekScope; name: string; color: string };

type TargetToday = { target: TodayTarget; notes: Item[]; tasks: Item[]; appointments: Item[] };

/** Was heute ansteht: Termine, eigene offene Einträge und fällige Aufgaben je Klasse/Lerngruppe. */
export function TodayPanel({
  targets,
  hint,
  onCustomize,
}: {
  targets: TodayTarget[];
  /** Zusatzhinweis unter der Liste (z. B. „weitere über Anpassen“). */
  hint?: string | null;
  onCustomize: () => void;
}) {
  const day = nextSchoolDayIso();
  const results = useDiaryWeeks(
    targets.map((t) => t.scope),
    startOfWeekIso(day),
  );

  const perTarget = targets
    .map((target, i) => {
      const week = results[i]?.data;
      return week ? summarize(target, week, day) : null;
    })
    .filter((c): c is TargetToday => !!c && c.notes.length + c.tasks.length + c.appointments.length > 0);

  const loading = results.some((r) => r.isLoading);
  const title = day === todayIso() ? 'Heute' : `Am ${formatRelativeDay(day)}`;

  return (
    <View style={styles.panel}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{title}</Text>
        <LinkButton label="Anpassen" onPress={onCustomize} />
      </View>
      {!targets.length ? (
        <Text style={styles.muted}>Keine Klasse gewählt. Über „Anpassen“ legst du fest, was hier erscheint.</Text>
      ) : null}
      {targets.length > 0 && loading && !perTarget.length ? <Text style={styles.muted}>Lädt …</Text> : null}
      {targets.length > 0 && !loading && !perTarget.length ? (
        <Text style={styles.muted}>Keine Termine, offenen Einträge oder Aufgaben.</Text>
      ) : null}
      {perTarget.map((c) => (
        <Pressable
          key={c.target.key}
          onPress={() => openWeek(c.target.scope, c.target.name)}
          style={({ pressed }) => [styles.classBlock, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`Wochenansicht ${c.target.name} öffnen`}
        >
          <View style={styles.classHead}>
            <View style={[styles.dot, { backgroundColor: c.target.color }]} />
            <Text style={styles.className}>{c.target.name}</Text>
            <Text style={styles.open}>Woche ›</Text>
          </View>
          <Section label="Termine" items={c.appointments} />
          <Section label="Meine offenen Einträge" items={c.notes} />
          <Section label="Aufgaben" items={c.tasks} />
        </Pressable>
      ))}
      {hint ? <Text style={styles.muted}>{hint}</Text> : null}
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

function summarize(target: TodayTarget, week: DiaryWeek, day: string): TargetToday {
  const index = new WeekIndex(week);
  const name = (id: number) => week.students.find((s) => s.id === id)?.firstname;
  const isHoliday = week.days.find((d) => d.date === day)?.is_holiday ?? false;

  const notes: Item[] = isHoliday
    ? []
    : week.entries
        .filter((e) => e.is_own && !e.is_completed && e.entry_date <= day)
        .map((e) => {
          // Nur Schüler, bei denen der Eintrag heute auch erscheint (nicht pausiert/abwesend).
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
    .sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? ''))
    .map((a) => ({
      key: `a${a.id}`,
      text: appointmentLabel(a),
      meta: a.schueler_ids.map(name).filter(Boolean).join(', '),
    }));

  return { target, notes, tasks, appointments };
}

function dueLabel(due: string, day: string) {
  if (due < day) return `überfällig seit ${formatDayMonth(due)}`;
  if (due === day) return 'fällig heute';
  return `bis ${formatDayMonth(due)}`;
}

const styles = StyleSheet.create({
  panel: { gap: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
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
