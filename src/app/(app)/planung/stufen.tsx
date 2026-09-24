import { Stack, useLocalSearchParams } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useGradingOverview } from '@/api/queries';
import { StageBadge } from '@/components/grading/StageBadge';
import { StudentLinks } from '@/components/StudentLinks';
import { EmptyState, ErrorBox, Loading } from '@/components/ui';
import { colors, font, radius, shadow, spacing } from '@/theme';

/** Stufenverteilung einer Klasse: wie viele Kinder auf welcher Stufe sind. Parameter: `classId`, `name`. */
export default function GradingOverviewScreen() {
  const params = useLocalSearchParams<{ classId: string; name?: string }>();
  const { data, isLoading, error, refetch, isRefetching } = useGradingOverview(Number(params.classId));
  const max = Math.max(1, ...(data?.stages.map((s) => s.count) ?? [1]));

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
    >
      <Stack.Screen options={{ title: `Stufen${params.name ? ` · ${params.name}` : ''}` }} />
      {isLoading ? <Loading /> : null}
      {error ? <ErrorBox message={error.message} onRetry={refetch} /> : null}
      {data && !data.grading_system ? <EmptyState title="Diese Klasse hat kein Graduierungssystem." /> : null}
      {data?.grading_system ? (
        <>
          <Text style={styles.summary}>
            {data.grading_system.name} · {data.students_total} Schüler
            {data.open_sessions_count ? ` · ${data.open_sessions_count} offene Bewertungen` : ''}
          </Text>
          {data.stages.map((stage) => (
            <View key={stage.id} style={styles.card}>
              <View style={styles.row}>
                <StageBadge stage={stage} size={40} />
                <View style={styles.flex}>
                  <Text style={styles.title}>{stage.title}</Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.bar, { width: `${(stage.count / max) * 100}%` }]} />
                  </View>
                </View>
                <Text style={styles.count} accessibilityLabel={`${stage.count} Schüler`}>
                  {stage.count}
                </Text>
              </View>
              <StudentLinks students={stage.students} />
            </View>
          ))}
          {data.without_stage.length ? (
            <View style={styles.card}>
              <Text style={styles.title}>Noch ohne Stufe ({data.without_stage.length})</Text>
              <StudentLinks students={data.without_stage} />
            </View>
          ) : null}
          {data.other_stages.length ? (
            <View style={styles.card}>
              <Text style={styles.title}>Stufe aus anderem System ({data.other_stages.length})</Text>
              <StudentLinks students={data.other_stages} />
            </View>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, width: '100%', maxWidth: 900, alignSelf: 'center' },
  summary: { fontSize: font.size.sm, color: colors.textMuted },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, ...shadow },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { fontSize: font.size.md, fontWeight: font.weight.semibold, color: colors.text },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: colors.divider, marginTop: spacing.xs, overflow: 'hidden' },
  bar: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
  count: { fontSize: font.size.xl, fontWeight: font.weight.bold, color: colors.text, minWidth: 32, textAlign: 'right' },
});
