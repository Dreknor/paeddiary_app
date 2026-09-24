import { router } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import type { ClassStudent } from '@/api/types';
import { colors, font, radius, shadow, spacing, touchTarget } from '@/theme';

import { BottomBar } from './controls';
import { StageBadge } from './grading/StageBadge';
import { Avatar, Button, EmptyState, ErrorBox, Loading } from './ui';

type Student = ClassStudent & { className?: string };

export type SelectionAction = { label: string; onPress: (students: Student[]) => void; primary?: boolean };

type Props = {
  students: Student[];
  isLoading: boolean;
  isRefetching: boolean;
  error: Error | null;
  onRefresh: () => void;
  /** Zeitraum für den Hinweis „lange nichts notiert“. */
  recentDays?: number;
  /** Aktionen für ausgewählte Schüler (langer Druck auf eine Kachel startet die Auswahl). */
  selectionActions?: SelectionAction[];
  /** Zusätzlicher Inhalt oberhalb der Suche (z. B. offene Gruppenbewertungen). */
  listHeader?: ReactNode;
};

const MIN_TILE_WIDTH = 150;

/** Kachelansicht einer Klasse oder Lerngruppe; Spaltenzahl passt sich Smartphone/iPad an. */
export function StudentGrid({
  students,
  isLoading,
  isRefetching,
  error,
  onRefresh,
  recentDays = 14,
  selectionActions,
  listHeader,
}: Props) {
  const { width } = useWindowDimensions();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<number> | null>(null);
  const selecting = selected !== null;

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const columns = Math.max(2, Math.floor((width - spacing.lg * 2) / MIN_TILE_WIDTH));

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('de');
    if (!q) return students;
    return students.filter((s) => `${s.firstname} ${s.lastname}`.toLocaleLowerCase('de').includes(q));
  }, [students, search]);

  if (isLoading) return <Loading />;

  const selectedStudents = students.filter((s) => selected?.has(s.id));

  return (
    <View style={styles.flex}>
      <FlatList
        key={columns}
        data={filtered}
        numColumns={columns}
        keyExtractor={(s) => String(s.id)}
        contentContainerStyle={styles.content}
        columnWrapperStyle={styles.row}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View style={styles.header}>
            {error ? <ErrorBox message={error.message} onRetry={onRefresh} /> : null}
            {listHeader}
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Schüler suchen"
              placeholderTextColor={colors.textSubtle}
              style={styles.search}
              autoCorrect={false}
              clearButtonMode="while-editing"
              accessibilityLabel="Schüler suchen"
            />
            <View style={styles.legend}>
              <View style={styles.dot} />
              <Text style={styles.legendText}>seit {recentDays} Tagen kein Tagebucheintrag</Text>
              {selectionActions?.length ? (
                <Text
                  style={styles.selectLink}
                  onPress={() => setSelected(selecting ? null : new Set())}
                  accessibilityRole="button"
                >
                  {selecting ? 'Auswahl beenden' : 'Auswählen'}
                </Text>
              ) : null}
            </View>
          </View>
        }
        ListEmptyComponent={
          error ? null : <EmptyState title={search ? 'Kein Schüler gefunden.' : 'Keine Schüler in dieser Gruppe.'} />
        }
        renderItem={({ item }) => (
          <StudentTile
            student={item}
            selecting={selecting}
            selected={!!selected?.has(item.id)}
            onToggle={() => toggle(item.id)}
            onLongPress={
              selectionActions?.length
                ? () => (selecting ? toggle(item.id) : setSelected(new Set([item.id])))
                : undefined
            }
          />
        )}
      />
      {selecting && selectionActions?.length ? (
        <BottomBar>
          <Text style={styles.selectionCount}>{selectedStudents.length} ausgewählt</Text>
          <Button
            title={selectedStudents.length === students.length ? 'Keine' : 'Alle'}
            variant="ghost"
            onPress={() =>
              setSelected(selectedStudents.length === students.length ? new Set() : new Set(students.map((s) => s.id)))
            }
          />
          <View style={styles.flex} />
          {selectionActions.map((a) => (
            <Button
              key={a.label}
              title={a.label}
              variant={a.primary ? 'primary' : 'secondary'}
              disabled={!selectedStudents.length}
              onPress={() => {
                a.onPress(selectedStudents);
                setSelected(null);
              }}
            />
          ))}
        </BottomBar>
      ) : null}
    </View>
  );
}

function StudentTile({
  student,
  selecting,
  selected,
  onToggle,
  onLongPress,
}: {
  student: Student;
  selecting: boolean;
  selected: boolean;
  onToggle: () => void;
  onLongPress?: () => void;
}) {
  const noRecentEntries = student.recent_diary_entries_count === 0;
  const grading = student.current_grading;
  const goals = student.active_diagnostic_goals_count;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${student.firstname} ${student.lastname}${
        noRecentEntries ? ', lange kein Tagebucheintrag' : ''
      }`}
      accessibilityState={selecting ? { selected } : undefined}
      style={({ pressed }) => [styles.tile, selected && styles.tileSelected, pressed && styles.pressed]}
      onLongPress={onLongPress}
      onPress={() =>
        selecting
          ? onToggle()
          : router.push({
              pathname: '/schueler/[id]',
              params: { id: String(student.id), name: `${student.firstname} ${student.lastname}` },
            })
      }
    >
      {selecting ? (
        <View style={[styles.check, selected && styles.checkOn]}>
          <Text style={styles.checkMark}>{selected ? '✓' : ''}</Text>
        </View>
      ) : noRecentEntries ? (
        <View style={[styles.dot, styles.tileDot]} />
      ) : null}
      <Avatar firstname={student.firstname} lastname={student.lastname} size={52} />
      <Text style={styles.name} numberOfLines={1}>
        {student.firstname}
      </Text>
      <Text style={styles.lastname} numberOfLines={1}>
        {student.lastname}
        {student.className ? ` · ${student.className}` : ''}
      </Text>
      <View style={styles.badges}>
        {grading ? (
          <View style={styles.stage}>
            {grading.badge_url ? (
              <StageBadge
                stage={{ title: grading.stage_title, symbol: grading.symbol, badge_image_url: grading.badge_url }}
                size={22}
              />
            ) : null}
            <Text style={[styles.badge, styles.stageText]} numberOfLines={1}>
              {grading.symbol && !grading.badge_url ? `${grading.symbol} ` : ''}
              {grading.stage_title}
            </Text>
          </View>
        ) : null}
        {goals ? <Text style={[styles.badge, styles.goalBadge]}>{goals} Ziele</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  selectLink: {
    marginLeft: 'auto',
    color: colors.primary,
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    padding: spacing.xs,
  },
  selectionCount: { fontSize: font.size.md, fontWeight: font.weight.semibold, color: colors.text },
  tileSelected: { borderWidth: 2, borderColor: colors.primary, backgroundColor: colors.primarySoft },
  check: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkMark: { color: colors.onPrimary, fontWeight: font.weight.bold },
  content: { padding: spacing.lg, gap: spacing.md, width: '100%', maxWidth: 1400, alignSelf: 'center' },
  row: { gap: spacing.md },
  header: { gap: spacing.md, marginBottom: spacing.xs },
  search: {
    minHeight: touchTarget,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    fontSize: font.size.md,
    color: colors.text,
  },
  legend: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  legendText: { fontSize: font.size.xs, color: colors.textMuted },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.warning },
  tile: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    gap: 2,
    ...shadow,
  },
  pressed: { opacity: 0.75 },
  tileDot: { position: 'absolute', top: spacing.md, right: spacing.md },
  name: { marginTop: spacing.sm, fontSize: font.size.md, fontWeight: font.weight.semibold, color: colors.text },
  lastname: { fontSize: font.size.sm, color: colors.textMuted },
  stage: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, maxWidth: '100%' },
  stageText: { flexShrink: 1 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.sm },
  badge: {
    fontSize: font.size.xs,
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  goalBadge: { color: colors.accent, backgroundColor: colors.accentSoft },
});
