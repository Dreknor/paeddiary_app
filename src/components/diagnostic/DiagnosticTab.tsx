import { router } from 'expo-router';
import { useState, type ReactElement } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useDiagnosticHistory } from '@/api/queries';
import type { DiagnosticSession, StudentView } from '@/api/types';
import { Card, LinkButton, SectionTitle } from '@/components/controls';
import { Button, EmptyState, ErrorBox, Loading } from '@/components/ui';
import { formatDate } from '@/lib/dates';
import { colors, font, radius, spacing } from '@/theme';

import { GoalCard } from './GoalCard';
import { RATINGS } from './rating';

export function DiagnosticTab({ view, header }: { view: StudentView; header: ReactElement }) {
  const studentId = view.student.id;
  const { data, isLoading, error, refetch, isRefetching } = useDiagnosticHistory(studentId);
  const [showInactive, setShowInactive] = useState(false);
  const name = `${view.student.firstname} ${view.student.lastname}`;

  const openDiagnosis = (areaId?: number) =>
    router.push({
      pathname: '/diagnose/neu',
      params: { studentId: String(studentId), name, ...(areaId ? { areaId: String(areaId) } : {}) },
    });

  const activeGoals = data?.development_goals.filter((g) => g.is_active) ?? [];
  const inactiveGoals = data?.development_goals.filter((g) => !g.is_active) ?? [];
  const openSessions = data?.sessions.filter((s) => !s.is_completed) ?? [];

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
    >
      {header}
      <Button title="Neue Diagnose" onPress={() => openDiagnosis()} />

      {isLoading ? <Loading /> : null}
      {error ? <ErrorBox message={error.message} onRetry={refetch} /> : null}

      {openSessions.map((s) => (
        <Card key={s.id} style={styles.openCard}>
          <Text style={styles.openTitle}>Offene Diagnose · {s.area_title}</Text>
          <Text style={styles.muted}>
            begonnen {formatDate(s.session_date)}
            {s.created_by_name ? ` von ${s.created_by_name}` : ''}
          </Text>
          <Button title="Fortsetzen" variant="secondary" onPress={() => openDiagnosis(s.area_id)} />
        </Card>
      ))}

      {data ? (
        <>
          <SectionTitle>Aktive Entwicklungsziele ({activeGoals.length})</SectionTitle>
          {activeGoals.length ? (
            activeGoals.map((g) => <GoalCard key={g.id} goal={g} />)
          ) : (
            <EmptyState title="Keine aktiven Ziele." />
          )}

          {data.current_criterion_goals.length ? (
            <>
              <SectionTitle>Markierte Kriterien (aktuelle Ziele)</SectionTitle>
              <Card>
                {data.current_criterion_goals.map((c) => (
                  <View key={c.assessment_id} style={styles.criterion}>
                    <Text style={styles.code}>{c.code}</Text>
                    <View style={styles.flex}>
                      <Text style={styles.criterionText}>{c.description}</Text>
                      <Text style={styles.muted}>
                        {c.area_title} · {c.stage_title}
                      </Text>
                    </View>
                  </View>
                ))}
              </Card>
            </>
          ) : null}

          <SectionTitle>Diagnosesitzungen</SectionTitle>
          {data.sessions.filter((s) => s.is_completed).length ? (
            data.sessions.filter((s) => s.is_completed).map((s) => <SessionRow key={s.id} session={s} />)
          ) : (
            <EmptyState title="Noch keine abgeschlossenen Diagnosen." />
          )}

          {inactiveGoals.length ? (
            <>
              <SectionTitle
                action={
                  <LinkButton
                    label={showInactive ? 'Ausblenden' : `Anzeigen (${inactiveGoals.length})`}
                    onPress={() => setShowInactive((v) => !v)}
                  />
                }
              >
                Abgeschlossene Ziele
              </SectionTitle>
              {showInactive ? inactiveGoals.map((g) => <GoalCard key={g.id} goal={g} />) : null}
            </>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

function SessionRow({ session }: { session: DiagnosticSession }) {
  const [open, setOpen] = useState(false);
  const total = session.rating_summary.total || 1;
  return (
    <Pressable onPress={() => setOpen((v) => !v)} accessibilityRole="button">
      <Card>
        <View style={styles.sessionHeader}>
          <Text style={styles.openTitle}>{session.area_title}</Text>
          <Text style={styles.muted}>{formatDate(session.session_date)}</Text>
        </View>
        <View
          style={styles.bar}
          accessibilityLabel={RATINGS.map((r) => `${session.rating_summary[r.value]} ${r.label}`).join(', ')}
        >
          {RATINGS.map((r) =>
            session.rating_summary[r.value] ? (
              <View
                key={r.value}
                style={{
                  flex: session.rating_summary[r.value] / total,
                  backgroundColor: r.color,
                  borderColor: r.border,
                  borderWidth: StyleSheet.hairlineWidth,
                }}
              />
            ) : null,
          )}
        </View>
        <Text style={styles.muted}>
          {RATINGS.map((r) => `${r.label}: ${session.rating_summary[r.value]}`).join(' · ')}
        </Text>
        {open ? (
          <View style={styles.details}>
            {session.notes ? <Text style={styles.criterionText}>{session.notes}</Text> : null}
            {session.stage_notes.map((n) => (
              <Text key={n.stage_id} style={styles.criterionText}>
                {n.stage_title}: {n.notes}
              </Text>
            ))}
            {session.created_by_name ? <Text style={styles.muted}>Erfasst von {session.created_by_name}</Text> : null}
          </View>
        ) : null}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
    paddingBottom: 120,
  },
  flex: { flex: 1 },
  muted: { fontSize: font.size.xs, color: colors.textMuted },
  openCard: { borderWidth: 1, borderColor: colors.warning },
  openTitle: { fontSize: font.size.md, fontWeight: font.weight.semibold, color: colors.text },
  criterion: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.xs },
  code: { fontSize: font.size.sm, fontWeight: font.weight.bold, color: colors.primary, minWidth: 44 },
  criterionText: { fontSize: font.size.sm, color: colors.text },
  sessionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.divider,
  },
  details: { gap: spacing.xs, marginTop: spacing.sm },
});
