import { useMemo, useState, type ReactElement } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { useDiaryCategories, useDiaryEntries } from '@/api/queries';
import { Chip } from '@/components/controls';
import { EmptyState, ErrorBox } from '@/components/ui';
import { addDays, schoolYearStartIso, todayIso } from '@/lib/dates';
import { useOutboxItems } from '@/sync/outbox';
import { colors, spacing } from '@/theme';

import { DiaryEntryRow, PendingEntryRow } from './DiaryEntryRow';

type Range = 'all' | '4w' | 'half' | 'year';

const RANGES: { value: Range; label: string }[] = [
  { value: 'all', label: 'Gesamt' },
  { value: '4w', label: '4 Wochen' },
  { value: 'half', label: 'Halbjahr' },
  { value: 'year', label: 'Schuljahr' },
];

/** Beginn des Zeitraums; Halbjahr = ab 1. Februar bzw. Schuljahresbeginn (Sachsen). */
function rangeStart(range: Range): string | null {
  const today = todayIso();
  if (range === '4w') return addDays(today, -28);
  const yearStart = schoolYearStartIso();
  if (range === 'year') return yearStart;
  if (range === 'half') {
    const february = `${Number(yearStart.slice(0, 4)) + 1}-02-01`;
    return today >= february ? february : yearStart;
  }
  return null;
}

/** Alle Tagebucheinträge eines Schülers, neueste zuerst, mit Zeitraum- und Kategorie-Filter und Endlos-Scrollen. */
export function DiaryTab({ studentId, header }: { studentId: number; header: ReactElement }) {
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [range, setRange] = useState<Range>('all');
  const { data: categories } = useDiaryCategories();
  const filter = useMemo(() => ({ categoryId, fromDate: rangeStart(range) }), [categoryId, range]);
  const query = useDiaryEntries(studentId, filter);
  const pending = useOutboxItems(
    'diary',
    (i) => i.method === 'POST' && ((i.meta?.studentIds as number[] | undefined) ?? []).includes(studentId),
  );

  const entries = query.data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <FlatList
      data={entries}
      keyExtractor={(e) => String(e.id)}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={query.refetch} />}
      onEndReachedThreshold={0.4}
      onEndReached={() => query.hasNextPage && !query.isFetchingNextPage && query.fetchNextPage()}
      ListHeaderComponent={
        <View style={styles.header}>
          {header}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            {RANGES.map((r) => (
              <Chip key={r.value} label={r.label} selected={range === r.value} onPress={() => setRange(r.value)} />
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            <Chip label="Alle" selected={categoryId === null} onPress={() => setCategoryId(null)} />
            {(categories ?? [])
              .filter((c) => !c.is_hidden)
              .map((c) => (
                <Chip
                  key={c.id}
                  label={c.name}
                  color={c.color}
                  selected={categoryId === c.id}
                  onPress={() => setCategoryId(categoryId === c.id ? null : c.id)}
                />
              ))}
          </ScrollView>
          {query.error ? <ErrorBox message={query.error.message} onRetry={query.refetch} /> : null}
          {pending.map((p) => (
            <PendingEntryRow
              key={p.id}
              preview={String(p.meta?.preview ?? '')}
              date={p.meta?.entryDate as string | undefined}
              failed={p.status === 'failed'}
              error={p.error}
            />
          ))}
        </View>
      }
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      renderItem={({ item }) => <DiaryEntryRow entry={item} />}
      ListEmptyComponent={
        query.isLoading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : query.error ? null : (
          <EmptyState
            title={
              range === 'all' && categoryId === null ? 'Noch keine Einträge.' : 'Keine Einträge in diesem Zeitraum.'
            }
          />
        )
      }
      ListFooterComponent={
        <View style={styles.footer}>
          {query.isFetchingNextPage ? <ActivityIndicator color={colors.primary} /> : null}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, width: '100%', maxWidth: 900, alignSelf: 'center' },
  header: { gap: spacing.md, marginBottom: spacing.md },
  filters: { gap: spacing.sm, paddingVertical: spacing.xs },
  separator: { height: spacing.sm },
  loader: { marginTop: spacing.xl },
  footer: { height: 120, alignItems: 'center', paddingTop: spacing.lg },
});
