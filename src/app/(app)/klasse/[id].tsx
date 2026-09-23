import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useClasses, useClassGradingSessions, useClassStudents } from '@/api/queries';
import type { ClassStudent } from '@/api/types';
import { Fab } from '@/components/controls';
import { StudentGrid, type SelectionAction } from '@/components/StudentGrid';
import { formatDate } from '@/lib/dates';
import { openNewEntry } from '@/lib/navigation';
import { colors, font, radius, shadow, spacing } from '@/theme';

export default function ClassScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const classId = Number(id);
  const { data, isLoading, isRefetching, error, refetch } = useClassStudents(classId);
  const { data: classes } = useClasses();
  const schoolClass = classes?.data.find((c) => c.id === classId);
  const hasGrading = !!schoolClass?.grading_system_id;
  const { data: sessions } = useClassGradingSessions(hasGrading ? classId : NaN);
  const openGroupSessions = (sessions ?? []).filter((s) => s.type === 'group' && s.is_owner && !s.is_completed);

  const actions: SelectionAction[] = [
    { label: 'Eintrag', primary: true, onPress: (selected) => openNewEntry(selected, [classId]) },
    ...(hasGrading
      ? [
          {
            label: 'Graduierung',
            onPress: (selected: ClassStudent[]) =>
              router.push({
                pathname: '/graduierung/gruppe',
                params: { classId: String(classId), studentIds: selected.map((s) => s.id).join(',') },
              }),
          },
        ]
      : []),
  ];

  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ title: data?.meta.class.name ?? name ?? 'Klasse' }} />
      <StudentGrid
        students={data?.data ?? []}
        recentDays={data?.meta.recent_days}
        isLoading={isLoading}
        isRefetching={isRefetching}
        error={error}
        onRefresh={refetch}
        selectionActions={actions}
        listHeader={
          openGroupSessions.length ? (
            <View style={styles.sessions}>
              {openGroupSessions.map((s) => (
                <Pressable
                  key={s.id}
                  style={({ pressed }) => [styles.session, pressed && { opacity: 0.8 }]}
                  onPress={() =>
                    router.push({ pathname: '/graduierung/[sessionId]', params: { sessionId: String(s.id) } })
                  }
                  accessibilityRole="button"
                >
                  <Text style={styles.sessionTitle}>Offene Gruppenbewertung fortsetzen</Text>
                  <Text style={styles.sessionMeta}>
                    begonnen {formatDate(s.started_at)} · {s.progress.students_finalized}/{s.progress.students_total}{' '}
                    abgeschlossen · {s.progress.answered}/{s.progress.total} Bewertungen
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null
        }
      />
      <Fab label="Eintrag" onPress={() => openNewEntry([], [classId])} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sessions: { gap: spacing.sm },
  session: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderLeftWidth: 5,
    borderLeftColor: colors.accent,
    padding: spacing.md,
    gap: 2,
    ...shadow,
  },
  sessionTitle: { fontSize: font.size.md, fontWeight: font.weight.semibold, color: colors.text },
  sessionMeta: { fontSize: font.size.xs, color: colors.textMuted },
});
