import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState, type ReactElement } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { queryKeys, useDiaryWeek } from '@/api/queries';
import type { DiaryWeek, WeekScope, WeekStudent } from '@/api/types';
import { StudentDay } from '@/components/calendar/StudentDay';
import { useWeekActions, type WeekActions } from '@/components/calendar/useWeekActions';
import { WeekIndex } from '@/components/calendar/week';
import { WeekGrid } from '@/components/calendar/WeekGrid';
import { DayBanner, DayTabs, StudentHead, WeekNavigator } from '@/components/calendar/WeekParts';
import { Chip, Fab } from '@/components/controls';
import { EmptyState, ErrorBox, Loading } from '@/components/ui';
import { addDays, parseIsoDate, startOfWeekIso, todayIso } from '@/lib/dates';
import { colors, font, radius, shadow, spacing, tabletBreakpoint, touchTarget } from '@/theme';

/** Ab dieser Breite zeigen wir die ganze Woche als Tabelle (iPad quer), sonst Tagesansicht. */
const GRID_MIN_WIDTH = 1000;

/** Am Wochenende gleich den kommenden Montag zeigen. */
function defaultDay(today: string) {
  const weekday = parseIsoDate(today).getDay();
  if (weekday === 6) return addDays(today, 2);
  if (weekday === 0) return addDays(today, 1);
  return today;
}

/**
 * Wochenansicht des Tagebuchs (wie „Pädagogisches Tagebuch“ im Web): offene Notizen, Einträge,
 * Abhak-Spalten, Termine, Pausen und Abwesenheiten je Schüler und Tag.
 * Parameter: `classId` oder `groupId` (Lerngruppe), optional `name`.
 */
export default function CalendarScreen() {
  const params = useLocalSearchParams<{ classId?: string; groupId?: string; name?: string }>();
  const scope: WeekScope = params.groupId ? { groupId: Number(params.groupId) } : { classId: Number(params.classId) };
  const scopeBody = 'groupId' in scope ? { group_id: scope.groupId } : { class_id: scope.classId };

  const { width } = useWindowDimensions();
  const today = todayIso();
  const [selectedDate, setSelectedDate] = useState(() => defaultDay(today));
  const [showPaused, setShowPaused] = useState(false);
  const weekStart = startOfWeekIso(selectedDate);
  const weekKey = queryKeys.diaryWeek(scope, weekStart);

  const { data: week, isLoading, error, refetch, isRefetching, isPlaceholderData } = useDiaryWeek(scope, weekStart);
  const index = useMemo(() => (week ? new WeekIndex(week) : null), [week]);
  const actions = useWeekActions(weekKey, week, scopeBody);

  const title = week?.group?.name ?? (week?.classes.length === 1 ? week.classes[0].name : null) ?? params.name;
  const useGrid = width >= GRID_MIN_WIDTH;
  const isCurrentWeek = weekStart === startOfWeekIso(defaultDay(today));

  const toolbar = (
    <View style={styles.toolbar}>
      <WeekNavigator
        weekStart={weekStart}
        weekEnd={addDays(weekStart, 4)}
        onPrev={() => setSelectedDate((d) => addDays(d, -7))}
        onNext={() => setSelectedDate((d) => addDays(d, 7))}
        onToday={() => setSelectedDate(defaultDay(today))}
        isCurrentWeek={isCurrentWeek}
        loading={isPlaceholderData}
      />
      <View style={styles.filters}>
        <Chip label="Pausierte zeigen" selected={showPaused} onPress={() => setShowPaused((v) => !v)} />
      </View>
    </View>
  );

  let content;
  if (isLoading) {
    content = (
      <View style={styles.padded}>
        {toolbar}
        <Loading />
      </View>
    );
  } else if (error && !week) {
    content = (
      <View style={styles.padded}>
        {toolbar}
        <ErrorBox message={error.message} onRetry={refetch} />
      </View>
    );
  } else if (!week || !index || isPlaceholderData) {
    // Neue Woche lädt noch – alte Woche nicht bedienbar anzeigen.
    content = (
      <View style={styles.padded}>
        {toolbar}
        <Loading />
      </View>
    );
  } else if (useGrid) {
    content = (
      <WeekGrid
        week={week}
        index={index}
        actions={actions}
        showPaused={showPaused}
        header={toolbar}
        refreshing={isRefetching}
        onRefresh={refetch}
      />
    );
  } else {
    content = (
      <DayList
        week={week}
        index={index}
        actions={actions}
        date={selectedDate}
        onSelectDate={setSelectedDate}
        showPaused={showPaused}
        toolbar={toolbar}
        refreshing={isRefetching}
        onRefresh={refetch}
        twoColumns={width >= tabletBreakpoint}
      />
    );
  }

  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ title: title ? `Woche · ${title}` : 'Woche' }} />
      {content}
      {week && !isPlaceholderData ? (
        <Fab label="Eintrag" onPress={() => actions.newEntry([], useGrid ? today : selectedDate)} />
      ) : null}
    </View>
  );
}

/** Tagesansicht (Smartphone, iPad hochkant): Tag wählen, je Schüler eine Karte. */
function DayList({
  week,
  index,
  actions,
  date,
  onSelectDate,
  showPaused,
  toolbar,
  refreshing,
  onRefresh,
  twoColumns,
}: {
  week: DiaryWeek;
  index: WeekIndex;
  actions: WeekActions;
  date: string;
  onSelectDate: (date: string) => void;
  showPaused: boolean;
  toolbar: ReactElement;
  refreshing: boolean;
  onRefresh: () => void;
  twoColumns: boolean;
}) {
  const day = week.days.find((d) => d.date === date) ?? week.days[0];
  const className = (id: number) => week.classes.find((c) => c.id === id)?.short_name ?? null;
  const columns = twoColumns ? 2 : 1;

  return (
    <FlatList
      key={columns}
      data={week.students}
      numColumns={columns}
      keyExtractor={(s) => String(s.id)}
      columnWrapperStyle={columns > 1 ? styles.columnWrapper : undefined}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View style={styles.listHeader}>
          {toolbar}
          <DayTabs days={week.days} selected={day.date} onSelect={onSelectDate} index={index} />
          <DayBanner date={day.date} day={day} index={index} actions={actions} />
        </View>
      }
      ListEmptyComponent={<EmptyState title="Keine Schüler in dieser Klasse." />}
      ListFooterComponent={<View style={styles.footer} />}
      renderItem={({ item }) => (
        <StudentCard
          student={item}
          date={day.date}
          index={index}
          actions={actions}
          showPaused={showPaused}
          className={week.group ? className(item.class_id) : null}
        />
      )}
    />
  );
}

function StudentCard({
  student,
  date,
  index,
  actions,
  showPaused,
  className,
}: {
  student: WeekStudent;
  date: string;
  index: WeekIndex;
  actions: WeekActions;
  showPaused: boolean;
  className: string | null;
}) {
  const absent = index.isAbsent(student.id, date);
  return (
    <View style={[styles.card, absent && styles.cardAbsent]}>
      <StudentHead student={student} index={index} actions={actions} className={className} />
      <StudentDay index={index} student={student} date={date} actions={actions} showPaused={showPaused} />
      <View style={styles.cardActions}>
        {!absent ? (
          <Pressable
            onPress={() => actions.newEntry([student], date)}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`Neue Notiz für ${student.firstname}`}
          >
            <Text style={styles.actionText}>+ Notiz</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => actions.toggleAbsence(student, date, !absent)}
          style={({ pressed }) => [styles.action, absent && styles.actionAbsent, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={absent ? `${student.firstname} wieder anwesend` : `${student.firstname} abwesend`}
        >
          <Text style={[styles.actionText, absent && styles.actionTextAbsent]}>
            {absent ? 'Wieder anwesend' : 'Abwesend'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  padded: { flex: 1, padding: spacing.lg, gap: spacing.md },
  toolbar: { gap: spacing.md },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  list: { padding: spacing.lg, gap: spacing.md, width: '100%', maxWidth: 1100, alignSelf: 'center' },
  listHeader: { gap: spacing.md },
  columnWrapper: { gap: spacing.md },
  footer: { height: 96 },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow,
  },
  cardAbsent: { opacity: 0.85 },
  cardActions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  action: {
    minHeight: touchTarget,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionAbsent: { backgroundColor: colors.dangerSoft, borderColor: colors.dangerSoft },
  actionText: { color: colors.primary, fontWeight: font.weight.semibold, fontSize: font.size.sm },
  actionTextAbsent: { color: colors.danger },
});
