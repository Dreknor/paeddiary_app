import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useDossier } from '@/api/queries';
import { useAuth } from '@/auth/AuthContext';
import { Card, Chip, LinkButton, SectionTitle, SwitchRow } from '@/components/controls';
import { GOAL_STATUS, RATINGS } from '@/components/diagnostic/rating';
import { DiaryEntryRow } from '@/components/diary/DiaryEntryRow';
import { StageBadge } from '@/components/grading/StageBadge';
import { EmptyState, ErrorBox, Loading } from '@/components/ui';
import { addMonths, formatDate, formatDateTime, schoolYearStartIso, todayIso } from '@/lib/dates';
import { openDossierPdf } from '@/lib/pdf';
import { colors, font, radius, spacing } from '@/theme';

type Period = 'year' | '6m' | '3m';

/** Dossier für Entwicklungsgespräche: Bildschirmansicht, Präsentationsmodus und PDF. */
export default function DossierScreen() {
  const params = useLocalSearchParams<{ studentId: string; name?: string }>();
  const studentId = Number(params.studentId);
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>('year');
  const [includeConfidential, setIncludeConfidential] = useState(true);
  const [presentation, setPresentation] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const range = useMemo(() => {
    const to = todayIso();
    const from = period === 'year' ? schoolYearStartIso() : addMonths(to, period === '6m' ? -6 : -3);
    return { from_date: from, to_date: to };
  }, [period]);
  // Präsentationsmodus (Elterngespräch) blendet vertrauliche Einträge immer aus.
  const confidential = presentation ? false : includeConfidential;
  const query = useDossier(studentId, { ...range, include_confidential: confidential });
  const dossier = query.data;

  async function pdf() {
    setPdfBusy(true);
    try {
      const name = dossier ? `${dossier.student.lastname}_${dossier.student.firstname}` : String(studentId);
      await openDossierPdf(
        studentId,
        { ...range, include_confidential: confidential },
        `Dossier_${name}_${range.from_date}_${range.to_date}.pdf`,
      );
    } catch (e) {
      Alert.alert('PDF nicht verfügbar', e instanceof Error ? e.message : String(e));
    } finally {
      setPdfBusy(false);
    }
  }

  const big = presentation ? styles.bigText : null;

  return (
    <>
      <Stack.Screen
        options={{
          title: presentation ? (params.name ?? 'Dossier') : `Dossier · ${params.name ?? ''}`,
          headerRight: () => <LinkButton label={pdfBusy ? 'Lädt …' : 'PDF'} onPress={() => !pdfBusy && void pdf()} />,
        }}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={query.refetch} />}
      >
        <Card>
          <View style={styles.chips}>
            <Chip label="Schuljahr" selected={period === 'year'} onPress={() => setPeriod('year')} />
            <Chip label="6 Monate" selected={period === '6m'} onPress={() => setPeriod('6m')} />
            <Chip label="3 Monate" selected={period === '3m'} onPress={() => setPeriod('3m')} />
          </View>
          <SwitchRow
            label="Präsentationsmodus"
            hint="Für Elterngespräche: große Schrift, ohne vertrauliche Einträge."
            value={presentation}
            onValueChange={setPresentation}
          />
          {!presentation ? (
            <SwitchRow
              label="Vertrauliche Einträge einbeziehen"
              hint={
                user?.permissions.view_confidential_entries
                  ? 'Inkl. vertraulicher Einträge anderer.'
                  : 'Nur deine eigenen vertraulichen Einträge.'
              }
              value={includeConfidential}
              onValueChange={setIncludeConfidential}
            />
          ) : null}
        </Card>

        {query.isLoading ? <Loading /> : null}
        {query.error ? <ErrorBox message={query.error.message} onRetry={query.refetch} /> : null}

        {dossier ? (
          <>
            <View>
              <Text style={[styles.title, presentation && styles.bigTitle]}>
                {dossier.student.firstname} {dossier.student.lastname}
              </Text>
              <Text style={styles.muted}>
                {formatDate(dossier.period.from_date)} – {formatDate(dossier.period.to_date)}
                {dossier.meta.includes_confidential ? ' · inkl. vertraulicher Einträge' : ''}
              </Text>
            </View>

            {/* Graduierung */}
            <SectionTitle>Graduierung</SectionTitle>
            <Card>
              <View style={styles.row}>
                <StageBadge stage={dossier.grading.current_stage} size={presentation ? 72 : 48} />
                <Text style={[styles.value, big]}>{dossier.grading.current_stage?.title ?? 'Noch keine Stufe'}</Text>
              </View>
              {dossier.grading.stage_history.map((h) => (
                <Text key={h.id} style={[styles.text, big]}>
                  {formatDate(h.changed_at)}: {h.previous_stage_title ? `${h.previous_stage_title} → ` : ''}
                  {h.stage_title ?? 'entfernt'}
                </Text>
              ))}
              {dossier.grading.completed_sessions.flatMap((s) =>
                (s.teacher_assessments ?? [])
                  .filter((t) => t.schueler_id === studentId)
                  .map((t) => (
                    <Text key={`${s.id}-${t.noted_at}`} style={[styles.quote, big]}>
                      „{t.note}“ ({formatDate(t.noted_at)})
                    </Text>
                  )),
              )}
            </Card>

            {/* Diagnose */}
            {dossier.diagnostic ? (
              <>
                <SectionTitle>Diagnose & Entwicklungsziele</SectionTitle>
                <Card>
                  {dossier.diagnostic.development_goals.length ? (
                    dossier.diagnostic.development_goals.map((g) => (
                      <View key={g.id} style={styles.goalRow}>
                        <Text
                          style={[
                            styles.status,
                            { color: GOAL_STATUS[g.status].color, backgroundColor: GOAL_STATUS[g.status].background },
                          ]}
                        >
                          {GOAL_STATUS[g.status].label}
                        </Text>
                        <Text style={[styles.text, styles.flex, big]}>{g.title}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.muted}>Keine Entwicklungsziele im Zeitraum.</Text>
                  )}
                </Card>
                {dossier.diagnostic.sessions.map((s) => (
                  <Card key={s.id}>
                    <Text style={[styles.value, big]}>
                      {s.area_title} · {formatDate(s.session_date)}
                    </Text>
                    <Text style={styles.muted}>
                      {RATINGS.map((r) => `${r.label}: ${s.rating_summary[r.value]}`).join(' · ')}
                    </Text>
                    {s.notes ? <Text style={[styles.text, big]}>{s.notes}</Text> : null}
                  </Card>
                ))}
              </>
            ) : null}

            {/* Tagebuch */}
            <SectionTitle>Pädagogisches Tagebuch ({dossier.paed_diary.entries_count})</SectionTitle>
            {dossier.paed_diary.by_category.length ? (
              <Card>
                {dossier.paed_diary.by_category.map((c) => {
                  const max = Math.max(...dossier.paed_diary.by_category.map((x) => x.count), 1);
                  return (
                    <View key={c.category_id ?? 0} style={styles.barRow}>
                      <Text style={[styles.barLabel, big]} numberOfLines={1}>
                        {c.category_name}
                      </Text>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.bar,
                            { width: `${(c.count / max) * 100}%`, backgroundColor: c.category_color || colors.primary },
                          ]}
                        />
                      </View>
                      <Text style={styles.barCount}>{c.count}</Text>
                    </View>
                  );
                })}
              </Card>
            ) : null}
            {dossier.paed_diary.entries.length ? (
              dossier.paed_diary.entries.map((e) => <DiaryEntryRow key={e.id} entry={e} />)
            ) : (
              <EmptyState title="Keine Einträge im Zeitraum." />
            )}

            <Text style={styles.footer}>
              Erstellt {formatDateTime(dossier.meta.generated_at)} von {dossier.meta.generated_by} · Vertraulich – nur
              für den dienstlichen Gebrauch
            </Text>
          </>
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
    paddingBottom: 60,
  },
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  title: { fontSize: font.size.xxl, fontWeight: font.weight.bold, color: colors.text },
  bigTitle: { fontSize: 36 },
  muted: { fontSize: font.size.sm, color: colors.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  value: { fontSize: font.size.lg, fontWeight: font.weight.semibold, color: colors.primary },
  text: { fontSize: font.size.md, color: colors.text, lineHeight: 22 },
  bigText: { fontSize: font.size.xl, lineHeight: 30 },
  quote: {
    fontSize: font.size.md,
    fontStyle: 'italic',
    color: colors.text,
    backgroundColor: colors.divider,
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
  goalRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  status: {
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  barLabel: { width: 130, fontSize: font.size.sm, color: colors.text },
  barTrack: { flex: 1, height: 14, backgroundColor: colors.divider, borderRadius: radius.sm, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: radius.sm },
  barCount: {
    width: 32,
    textAlign: 'right',
    fontSize: font.size.sm,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  footer: { fontSize: font.size.xs, color: colors.textSubtle, textAlign: 'center' },
});
