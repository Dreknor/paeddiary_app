import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import type { DiaryWeek, WeekStudent } from '@/api/types';
import { StageBadge } from '@/components/grading/StageBadge';
import { formatDayMonth, formatWeekdayShort, isoWeekNumber, todayIso } from '@/lib/dates';
import { colors, font, radius, shadow, spacing, touchTarget } from '@/theme';

import type { WeekActions } from './useWeekActions';
import { appointmentLabel, type WeekIndex } from './week';

/** ‹ KW 39 · 21.09.–25.09. › [Heute] */
export function WeekNavigator({
  weekStart,
  weekEnd,
  onPrev,
  onNext,
  onToday,
  isCurrentWeek,
  loading,
}: {
  weekStart: string;
  weekEnd: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  isCurrentWeek: boolean;
  loading?: boolean;
}) {
  return (
    <View style={styles.nav}>
      <NavButton label="‹" accessibilityLabel="Vorherige Woche" onPress={onPrev} />
      <View style={styles.navCenter}>
        <Text style={styles.navTitle}>KW {isoWeekNumber(weekStart)}</Text>
        <Text style={styles.navSub}>
          {formatDayMonth(weekStart)}–{formatDayMonth(weekEnd)}
          {loading ? ' · lädt …' : ''}
        </Text>
      </View>
      <NavButton label="›" accessibilityLabel="Nächste Woche" onPress={onNext} />
      {!isCurrentWeek ? (
        <Pressable onPress={onToday} style={styles.todayButton} accessibilityRole="button">
          <Text style={styles.todayText}>Heute</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function NavButton({
  label,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.navButton, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Text style={styles.navButtonText}>{label}</Text>
    </Pressable>
  );
}

/** Tagesauswahl Mo–Fr mit Markierung für heute, Ferien und Tagespausen. */
export function DayTabs({
  days,
  selected,
  onSelect,
  index,
}: {
  days: DiaryWeek['days'];
  selected: string;
  onSelect: (date: string) => void;
  index: WeekIndex;
}) {
  const today = todayIso();
  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {days.map((d) => {
        const active = d.date === selected;
        const marker = d.is_holiday ? '🏖' : index.dayPause(d.date) ? '⏸' : '';
        return (
          <Pressable
            key={d.date}
            onPress={() => onSelect(d.date)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.tab, active && styles.tabActive, d.is_holiday && !active && styles.tabHoliday]}
          >
            <Text style={[styles.tabDay, active && styles.tabTextActive, d.date === today && styles.tabToday]}>
              {formatWeekdayShort(d.date)}
            </Text>
            <Text style={[styles.tabDate, active && styles.tabTextActive]}>
              {formatDayMonth(d.date).slice(0, 3)}
              {marker}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Ferien, Tagespause (mit Schalter) und Klassentermine eines Tages. */
export function DayBanner({
  date,
  day,
  index,
  actions,
  compact,
}: {
  date: string;
  day: DiaryWeek['days'][number];
  index: WeekIndex;
  actions: WeekActions;
  compact?: boolean;
}) {
  const pause = index.dayPause(date);
  const appointments = index.headerAppointments(date);
  return (
    <View style={styles.banner}>
      {day.is_holiday ? (
        <View style={styles.holiday}>
          <Text style={styles.holidayText}>🏖 {day.holiday_name ? capitalize(day.holiday_name) : 'Ferien'}</Text>
        </View>
      ) : (
        <Pressable
          onPress={() => actions.dayPauseMenu(date, pause?.reason ?? null)}
          style={({ pressed }) => [styles.pauseButton, pause && styles.pauseButtonActive, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={pause ? `Tagespause ${pause.reason} – antippen zum Aufheben` : 'Tag pausieren'}
        >
          <Text style={[styles.pauseText, pause && styles.pauseTextActive]} numberOfLines={1}>
            {pause ? `⏸ ${pause.reason}` : compact ? '⏸' : '⏸ Tag pausieren'}
          </Text>
        </Pressable>
      )}
      {appointments.map((a) => (
        <View key={a.id} style={styles.appointment}>
          <Text style={styles.appointmentText} numberOfLines={compact ? 2 : 3}>
            {appointmentLabel(a)}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Name, Stufe, Fehlzeiten-Hinweis, offene Aufgaben eines Schülers. */
export function StudentHead({
  student,
  index,
  actions,
  className,
  compact,
}: {
  student: WeekStudent;
  index: WeekIndex;
  actions: WeekActions;
  className?: string | null;
  compact?: boolean;
}) {
  const tasks = index.tasksFor(student.id);
  const openCount = index.openEntriesFor(student.id).length;
  const stage = student.current_grading
    ? {
        title: student.current_grading.stage_title,
        symbol: student.current_grading.symbol,
        badge_image_url: student.current_grading.badge_url,
      }
    : null;

  return (
    <View style={styles.head}>
      <View style={styles.headRow}>
        {stage ? <StageBadge stage={stage} size={compact ? 24 : 32} /> : null}
        <View style={styles.headName}>
          <Text style={styles.name} numberOfLines={compact ? 2 : 1}>
            {student.firstname} {student.lastname}
          </Text>
          {className || openCount ? (
            <Text style={styles.nameMeta} numberOfLines={1}>
              {[className, openCount ? `${openCount} offen` : null].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
        </View>
        {student.absence_alerts.length ? (
          <Pressable
            onPress={() =>
              Alert.alert('Fehlzeiten', student.absence_alerts.map((a) => `${a.label}: ${a.summary}`).join('\n\n'))
            }
            hitSlop={8}
            style={styles.alert}
            accessibilityRole="button"
            accessibilityLabel={`${student.absence_alerts.length} Hinweise zu Fehlzeiten`}
          >
            <Text style={styles.alertText}>⚠ {student.absence_alerts.length}</Text>
          </Pressable>
        ) : null}
      </View>
      {tasks.map((t) => (
        <View key={t.id} style={[styles.task, t.highlighted && styles.taskHighlighted]}>
          <Text style={[styles.taskText, t.highlighted && styles.taskTextHighlighted]} numberOfLines={3}>
            {t.title}
            {t.due_date ? ` (bis ${formatDayMonth(t.due_date)})` : ''}
          </Text>
          <Pressable
            onPress={() =>
              Alert.alert('Aufgabe erledigt?', t.title, [
                { text: 'Abbrechen', style: 'cancel' },
                { text: 'Erledigt', onPress: () => actions.finishTask(t.id, student) },
              ])
            }
            hitSlop={4}
            style={styles.taskDone}
            accessibilityRole="button"
            accessibilityLabel={`Aufgabe ${t.title} erledigen`}
          >
            <Text style={styles.taskDoneText}>✓</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },

  nav: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  navButton: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  navButtonText: { fontSize: font.size.xxl, color: colors.primary, lineHeight: font.size.xxl + 4 },
  navCenter: { flex: 1, alignItems: 'center' },
  navTitle: { fontSize: font.size.lg, fontWeight: font.weight.semibold, color: colors.text },
  navSub: { fontSize: font.size.sm, color: colors.textMuted },
  todayButton: {
    minHeight: touchTarget,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  todayText: { color: colors.primary, fontWeight: font.weight.semibold, fontSize: font.size.sm },

  tabs: { flexDirection: 'row', backgroundColor: colors.divider, borderRadius: radius.md, padding: 3, gap: 3 },
  tab: { flex: 1, minHeight: touchTarget + 4, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  tabActive: { backgroundColor: colors.surface, ...shadow },
  tabHoliday: { opacity: 0.6 },
  tabDay: { fontSize: font.size.sm, fontWeight: font.weight.semibold, color: colors.textMuted },
  tabDate: { fontSize: font.size.xs, color: colors.textMuted },
  tabTextActive: { color: colors.primary },
  tabToday: { color: colors.accent },

  banner: { gap: spacing.xs },
  holiday: { backgroundColor: colors.warningSoft, borderRadius: radius.sm, padding: spacing.sm },
  holidayText: { color: colors.warning, fontWeight: font.weight.semibold, fontSize: font.size.sm },
  pauseButton: {
    minHeight: 40,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pauseButtonActive: { backgroundColor: colors.warning, borderColor: colors.warning },
  pauseText: { fontSize: font.size.sm, color: colors.textMuted, fontWeight: font.weight.medium },
  pauseTextActive: { color: colors.onPrimary },
  appointment: {
    backgroundColor: colors.warningSoft,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  appointmentText: { fontSize: font.size.xs, color: colors.text },

  head: { gap: spacing.xs },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headName: { flex: 1 },
  name: { fontSize: font.size.md, fontWeight: font.weight.semibold, color: colors.text },
  nameMeta: { fontSize: font.size.xs, color: colors.textMuted },
  alert: {
    backgroundColor: colors.warningSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  alertText: { color: colors.warning, fontSize: font.size.xs, fontWeight: font.weight.semibold },
  task: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successSoft,
    borderRadius: radius.sm,
    paddingLeft: spacing.sm,
  },
  taskHighlighted: { backgroundColor: colors.dangerSoft },
  taskText: { flex: 1, fontSize: font.size.xs, color: colors.success, paddingVertical: spacing.xs },
  taskTextHighlighted: { color: colors.danger, fontWeight: font.weight.semibold },
  taskDone: { width: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  taskDoneText: { color: colors.success, fontWeight: font.weight.bold, fontSize: font.size.md },
});
