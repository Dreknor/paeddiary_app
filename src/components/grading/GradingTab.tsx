import { router } from 'expo-router';
import { useState, type ReactElement } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { startIndividualSession } from '@/api/endpoints';
import { useGradingHistory } from '@/api/queries';
import type { StudentView } from '@/api/types';
import { Card, SectionTitle } from '@/components/controls';
import { Button, EmptyState, ErrorBox, Loading } from '@/components/ui';
import { formatDate, formatDateTime } from '@/lib/dates';
import { colors, font, radius, spacing } from '@/theme';

import { StageBadge } from './StageBadge';

export function GradingTab({ view, header }: { view: StudentView; header: ReactElement }) {
  const studentId = view.student.id;
  const { data, isLoading, error, refetch, isRefetching } = useGradingHistory(studentId);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const overview = view.grading_overview;

  async function openSession() {
    setStarting(true);
    setStartError(null);
    try {
      const response = await startIndividualSession(studentId);
      router.push({ pathname: '/graduierung/[sessionId]', params: { sessionId: String(response.data.id) } });
    } catch (e) {
      setStartError(e instanceof Error ? e.message : 'Bewertung konnte nicht gestartet werden.');
    } finally {
      setStarting(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
    >
      {header}

      <Card>
        <Text style={styles.label}>{overview.grading_system?.name ?? 'Graduierung'}</Text>
        <View style={styles.stageRow}>
          <StageBadge stage={data?.current_stage ?? overview.current_stage} size={56} />
          <View style={styles.flex}>
            <Text style={styles.stage}>
              {(data?.current_stage ?? overview.current_stage)?.title ?? 'Noch keine Stufe'}
            </Text>
            {overview.current_stage?.achieved_at ? (
              <Text style={styles.muted}>erreicht am {formatDate(overview.current_stage.achieved_at)}</Text>
            ) : null}
          </View>
        </View>
        {overview.grading_system ? (
          <>
            {overview.has_open_session && !overview.open_session_is_own ? (
              <Text style={styles.note}>Eine andere Lehrkraft hat eine offene Bewertung für dieses Kind.</Text>
            ) : null}
            {startError ? <ErrorBox message={startError} /> : null}
            <Button
              title={
                overview.has_open_session && overview.open_session_is_own ? 'Bewertung fortsetzen' : 'Bewertung starten'
              }
              onPress={openSession}
              loading={starting}
            />
          </>
        ) : (
          <Text style={styles.muted}>Für die Klasse ist kein Graduierungssystem hinterlegt.</Text>
        )}
      </Card>

      {isLoading ? <Loading /> : null}
      {error ? <ErrorBox message={error.message} onRetry={refetch} /> : null}

      {data ? (
        <>
          <SectionTitle>Verlauf</SectionTitle>
          {data.stage_history.length ? (
            <View style={styles.timeline}>
              {data.stage_history.map((h) => (
                <View key={h.id} style={styles.timelineItem}>
                  <View style={styles.dot} />
                  <View style={styles.flex}>
                    <Text style={styles.timelineTitle}>
                      {h.previous_stage_title ? `${h.previous_stage_title} → ` : ''}
                      {h.stage_title ?? 'Stufe entfernt'}
                    </Text>
                    <Text style={styles.muted}>
                      {formatDateTime(h.changed_at)}
                      {h.changed_by_name ? ` · ${h.changed_by_name}` : ''}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <EmptyState title="Noch keine Stufenwechsel." />
          )}

          <SectionTitle>Abgeschlossene Bewertungen</SectionTitle>
          {data.completed_sessions.length ? (
            data.completed_sessions.map((s) => {
              const answered = (s.answers ?? []).filter(
                (a) => a.schueler_id === studentId && a.rating_value !== null,
              ).length;
              return (
                <Card key={s.id}>
                  <Text style={styles.timelineTitle}>
                    {s.completed_at ? formatDate(s.completed_at) : formatDate(s.started_at)} ·{' '}
                    {s.type === 'group' ? 'Gruppenbewertung' : 'Einzelbewertung'}
                  </Text>
                  <Text style={styles.muted}>
                    {s.created_by_name} · {answered} von {(s.questions ?? []).length} Fragen bewertet
                  </Text>
                  {(s.teacher_assessments ?? [])
                    .filter((t) => t.schueler_id === studentId)
                    .map((t) => (
                      <Text key={t.noted_at} style={styles.assessment}>
                        {t.note}
                      </Text>
                    ))}
                </Card>
              );
            })
          ) : (
            <EmptyState title="Noch keine abgeschlossenen Bewertungen." />
          )}
        </>
      ) : null}
    </ScrollView>
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
  label: { fontSize: font.size.xs, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  stageRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  stage: { fontSize: font.size.xl, fontWeight: font.weight.bold, color: colors.primary },
  muted: { fontSize: font.size.sm, color: colors.textMuted },
  note: { fontSize: font.size.sm, color: colors.warning },
  timeline: { gap: spacing.md, paddingLeft: spacing.xs },
  timelineItem: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.accent, marginTop: 4 },
  timelineTitle: { fontSize: font.size.md, fontWeight: font.weight.semibold, color: colors.text },
  assessment: {
    fontSize: font.size.sm,
    color: colors.text,
    backgroundColor: colors.divider,
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
});
