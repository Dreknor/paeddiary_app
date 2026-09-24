import type { ReactElement } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import type { DiaryWeek, WeekStudent } from '@/api/types';
import { formatDayMonth, formatWeekdayShort, todayIso } from '@/lib/dates';
import { colors, font, spacing } from '@/theme';

import { StudentDay } from './StudentDay';
import type { WeekActions } from './useWeekActions';
import type { WeekIndex } from './week';
import { DayBanner, StudentHead } from './WeekParts';

const NAME_WIDTH = 200;

type Row =
  | { type: 'head'; key: string }
  | { type: 'divider'; key: string; label: string; color: string | null }
  | { type: 'student'; key: string; student: WeekStudent };

/** Wochentabelle Schüler × Mo–Fr wie im Web (iPad quer). */
export function WeekGrid({
  week,
  index,
  actions,
  showPaused,
  header,
  refreshing,
  onRefresh,
  emptyText = 'Keine Schüler.',
}: {
  week: DiaryWeek;
  index: WeekIndex;
  actions: WeekActions;
  showPaused: boolean;
  header: ReactElement;
  refreshing: boolean;
  onRefresh: () => void;
  emptyText?: string;
}) {
  const rows = buildRows(week);
  const className = (id: number) => week.classes.find((c) => c.id === id)?.short_name ?? null;

  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => r.key}
      // Index 0 = ListHeader, Index 1 = Tageskopf (bleibt beim Scrollen oben).
      stickyHeaderIndices={[1]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={styles.content}
      ListHeaderComponent={header}
      ListHeaderComponentStyle={styles.header}
      ListFooterComponent={
        week.students.length ? <View style={styles.footer} /> : <Text style={styles.empty}>{emptyText}</Text>
      }
      removeClippedSubviews={false}
      renderItem={({ item }) => {
        if (item.type === 'head') return <WeekGridHead week={week} index={index} actions={actions} />;
        if (item.type === 'divider') {
          return (
            <View style={[styles.divider, item.color ? { backgroundColor: item.color } : null]}>
              <Text style={[styles.dividerText, item.color && isLight(item.color) ? styles.dividerTextDark : null]}>
                {item.label}
              </Text>
            </View>
          );
        }
        const s = item.student;
        return (
          <View style={styles.row}>
            <View style={styles.nameCell}>
              <StudentHead
                student={s}
                index={index}
                actions={actions}
                className={week.group ? className(s.class_id) : null}
                compact
              />
            </View>
            {week.days.map((d) => {
              const absent = index.isAbsent(s.id, d.date);
              return (
                <Pressable
                  key={d.date}
                  onPress={() => actions.cellMenu(s, d.date, absent)}
                  style={[styles.cell, (d.is_holiday || index.dayPause(d.date, s.class_id)) && styles.muted]}
                  accessibilityRole="button"
                  accessibilityLabel={`${s.firstname} ${formatWeekdayShort(d.date)} ${formatDayMonth(d.date)} – Notiz oder Abwesenheit`}
                >
                  <StudentDay
                    index={index}
                    student={s}
                    date={d.date}
                    actions={actions}
                    showPaused={showPaused}
                    compact
                  />
                </Pressable>
              );
            })}
          </View>
        );
      }}
    />
  );
}

/** Kopfzeile der Tabelle: Wochentage mit Ferien, Tagespause und Klassenterminen. */
export function WeekGridHead({ week, index, actions }: { week: DiaryWeek; index: WeekIndex; actions: WeekActions }) {
  const today = todayIso();
  return (
    <View style={[styles.row, styles.headRow]}>
      <View style={styles.nameCell}>
        <Text style={styles.headTitle}>Schüler</Text>
      </View>
      {week.days.map((d) => (
        <View key={d.date} style={[styles.cell, styles.headCell, d.date === today && styles.today]}>
          <Text style={[styles.headDay, d.date === today && styles.headToday]}>
            {formatWeekdayShort(d.date)} {formatDayMonth(d.date)}
          </Text>
          <DayBanner date={d.date} day={d} index={index} actions={actions} compact />
        </View>
      ))}
    </View>
  );
}

function buildRows(week: DiaryWeek): Row[] {
  const rows: Row[] = [{ type: 'head', key: 'head' }];
  if (!week.group) {
    week.students.forEach((s) => rows.push({ type: 'student', key: `s${s.id}`, student: s }));
    return rows;
  }
  let current: number | null = null;
  for (const s of week.students) {
    if (s.class_id !== current) {
      current = s.class_id;
      const c = week.classes.find((k) => k.id === s.class_id);
      rows.push({ type: 'divider', key: `k${s.class_id}`, label: c?.name ?? 'Klasse', color: c?.color ?? null });
    }
    rows.push({ type: 'student', key: `s${s.id}`, student: s });
  }
  return rows;
}

/** Helle Klassenfarbe → dunkle Schrift (wie im Web). */
function isLight(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 128;
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl },
  header: { padding: spacing.lg, paddingBottom: 0 },
  footer: { height: 96 },
  row: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headRow: { backgroundColor: colors.background, borderBottomWidth: 1 },
  nameCell: {
    width: NAME_WIDTH,
    padding: spacing.sm,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.border,
  },
  cell: {
    flex: 1,
    minHeight: 56,
    padding: spacing.xs,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.border,
  },
  headCell: { gap: spacing.xs, paddingVertical: spacing.sm },
  today: { backgroundColor: colors.primarySoft },
  muted: { backgroundColor: colors.divider },
  headTitle: {
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    color: colors.textMuted,
    paddingTop: spacing.xs,
  },
  headDay: { fontSize: font.size.sm, fontWeight: font.weight.semibold, color: colors.text },
  headToday: { color: colors.accent },
  divider: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, backgroundColor: colors.primary },
  dividerText: { color: colors.onPrimary, fontWeight: font.weight.semibold, fontSize: font.size.sm },
  dividerTextDark: { color: colors.text },
  empty: { textAlign: 'center', color: colors.textMuted, padding: spacing.xxl },
});
