import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useClasses, useClassGradingSessions, useClassStudents } from '@/api/queries';
import { useAuth } from '@/auth/AuthContext';
import { Fab, LinkButton } from '@/components/controls';
import { StudentGrid, type SelectionAction } from '@/components/StudentGrid';
import { formatDate } from '@/lib/dates';
import { openNewEntry, openNewTask, openWeek, showClassMenu, showSelectionMenu } from '@/lib/navigation';
import { colors, font, radius, shadow, spacing } from '@/theme';

export default function ClassScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const classId = Number(id);
  const { user } = useAuth();
  const { data, isLoading, isRefetching, error, refetch } = useClassStudents(classId);
  const { data: classes } = useClasses();
  const schoolClass = classes?.data.find((c) => c.id === classId);
  const hasGrading = !!schoolClass?.grading_system_id;
  const { data: sessions } = useClassGradingSessions(hasGrading ? classId : NaN);
  const openGroupSessions = (sessions ?? []).filter((s) => s.type === 'group' && s.is_owner && !s.is_completed);

  const actions: SelectionAction[] = [
    { label: 'Eintrag', primary: true, onPress: (selected) => openNewEntry(selected, [classId]) },
    { label: 'Aufgabe', onPress: (selected) => openNewTask(selected, [classId]) },
    {
      label: 'Mehr …',
      onPress: (selected) =>
        showSelectionMenu(
          selected,
          { classIds: [classId] },
          hasGrading
            ? [
                {
                  label: 'Graduierung',
                  onPress: () =>
                    router.push({
                      pathname: '/graduierung/gruppe',
                      params: { classId: String(classId), studentIds: selected.map((s) => s.id).join(',') },
                    }),
                },
              ]
            : [],
        ),
    },
  ];

  return (
    <View style={styles.flex}>
      <Stack.Screen
        options={{
          title: data?.meta.class.name ?? name ?? 'Klasse',
          headerRight: () => (
            <View style={styles.headerButtons}>
              <LinkButton label="Woche" onPress={() => openWeek({ classId }, data?.meta.class.name ?? name)} />
              <LinkButton
                label="Mehr"
                onPress={() =>
                  showClassMenu({
                    title: data?.meta.class.name ?? name ?? 'Klasse',
                    classes: [{ id: classId, name: data?.meta.class.name ?? name ?? 'Klasse' }],
                    canViewDiagnostics: !!user?.permissions.view_diagnostics,
                  })
                }
              />
            </View>
          ),
        }}
      />
      <StudentGrid
        students={data?.data ?? []}
        recentDays={data?.meta.recent_days}
        isLoading={isLoading}
        isRefetching={isRefetching}
        error={error}
        onRefresh={refetch}
        fab={<Fab label="Eintrag" onPress={() => openNewEntry([], [classId])} />}
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
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerButtons: { flexDirection: 'row', gap: spacing.lg },
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
