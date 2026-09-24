import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useDiagnosticOverview } from '@/api/queries';
import type { DiagnosticCriterionOverview } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { Chip } from '@/components/controls';
import { ratingInfo } from '@/components/diagnostic/rating';
import { StudentLinks } from '@/components/StudentLinks';
import { Button, EmptyState, ErrorBox, Loading } from '@/components/ui';
import { openNewEntry } from '@/lib/navigation';
import { colors, font, radius, shadow, spacing } from '@/theme';

/**
 * Diagnose-Übersicht einer Klasse: Kriterien, die viele Kinder noch nicht können – Grundlage für Fördergruppen.
 * Je Kind zählt die letzte Bewertung. Parameter: `classId`, `name`.
 */
export default function DiagnosticOverviewScreen() {
  const params = useLocalSearchParams<{ classId: string; name?: string }>();
  const classId = Number(params.classId);
  const { user } = useAuth();
  const allowed = !!user?.permissions.view_diagnostics;
  const [areaId, setAreaId] = useState<number | null>(null);
  const { data, isLoading, error, refetch, isRefetching } = useDiagnosticOverview(classId, areaId, allowed);

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
    >
      <Stack.Screen options={{ title: `Förderbedarf${params.name ? ` · ${params.name}` : ''}` }} />
      {!allowed ? <EmptyState title="Dafür fehlt dir das Recht „Diagnose“." /> : null}
      {isLoading ? <Loading /> : null}
      {error ? <ErrorBox message={error.message} onRetry={refetch} /> : null}
      {data ? (
        <>
          <Text style={styles.summary}>
            {data.assessed_students} von {data.students_total} Schülern diagnostiziert · je Kind zählt die letzte
            Bewertung
          </Text>
          <View style={styles.chips}>
            <Chip label="Alle Bereiche" selected={areaId === null} onPress={() => setAreaId(null)} />
            {data.areas.map((a) => (
              <Chip key={a.id} label={a.title} selected={areaId === a.id} onPress={() => setAreaId(a.id)} />
            ))}
          </View>
          {data.criteria.length ? (
            data.criteria.map((c) => <CriterionCard key={c.criterion_id} criterion={c} classId={classId} />)
          ) : (
            <EmptyState title="Keine offenen Kriterien – alle diagnostizierten Kinder können es." />
          )}
        </>
      ) : null}
    </ScrollView>
  );
}

function CriterionCard({ criterion: c, classId }: { criterion: DiagnosticCriterionOverview; classId: number }) {
  const notYet = ratingInfo('dark_gray');
  const goal = ratingInfo('gray');
  const segments = [
    { key: 'dark_gray', count: c.counts.dark_gray, color: notYet?.color ?? colors.text },
    { key: 'gray', count: c.counts.gray, color: goal?.color ?? colors.border },
    { key: 'white', count: c.counts.white, color: colors.successSoft },
  ];
  const group = [...c.students_not_yet, ...c.students_partial];

  return (
    <View style={styles.card}>
      <Text style={styles.meta}>{[c.area_title, c.stage_title, c.code].filter(Boolean).join(' · ')}</Text>
      <Text style={styles.title}>{c.description}</Text>
      <View
        style={styles.bar}
        accessible
        accessibilityLabel={`${c.counts.dark_gray} können es noch nicht, ${c.counts.gray} aktuelles Ziel, ${c.counts.white} können es`}
      >
        {segments.map((s) =>
          s.count ? <View key={s.key} style={{ flex: s.count, backgroundColor: s.color }} /> : null,
        )}
      </View>
      <Text style={styles.legend}>
        {c.counts.dark_gray} {notYet?.label.toLowerCase()} · {c.counts.gray} {goal?.label.toLowerCase()} ·{' '}
        {c.counts.white} kann es
      </Text>
      {c.students_not_yet.length ? (
        <View style={styles.group}>
          <Text style={styles.groupLabel}>{notYet?.label}</Text>
          <StudentLinks students={c.students_not_yet} />
        </View>
      ) : null}
      {c.students_partial.length ? (
        <View style={styles.group}>
          <Text style={styles.groupLabel}>{goal?.label}</Text>
          <StudentLinks students={c.students_partial} />
        </View>
      ) : null}
      {group.length > 1 ? (
        <Button
          title={`Eintrag für diese ${group.length} Schüler`}
          variant="secondary"
          onPress={() => openNewEntry(group, [classId])}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, width: '100%', maxWidth: 900, alignSelf: 'center' },
  summary: { fontSize: font.size.sm, color: colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, ...shadow },
  meta: { fontSize: font.size.xs, color: colors.textMuted },
  title: { fontSize: font.size.md, fontWeight: font.weight.semibold, color: colors.text },
  bar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: colors.divider,
    borderWidth: 1,
    borderColor: colors.border,
  },
  legend: { fontSize: font.size.xs, color: colors.textMuted },
  group: { gap: spacing.xs },
  groupLabel: { fontSize: font.size.xs, fontWeight: font.weight.semibold, color: colors.textMuted },
});
