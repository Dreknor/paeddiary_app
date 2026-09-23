import { useState, type ReactElement } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { useDiaryCategories, useDiaryEntries } from '@/api/queries';
import { Chip } from '@/components/controls';
import { EmptyState, ErrorBox } from '@/components/ui';
import { useOutboxItems } from '@/sync/outbox';
import { colors, spacing } from '@/theme';

import { DiaryEntryRow, PendingEntryRow } from './DiaryEntryRow';

/** Alle Tagebucheinträge eines Schülers, neueste zuerst, mit Kategorie-Filter und Endlos-Scrollen. */
export function DiaryTab({ studentId, header }: { studentId: number; header: ReactElement }) {
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const { data: categories } = useDiaryCategories();
  const query = useDiaryEntries(studentId, categoryId);
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
          <EmptyState title="Noch keine Einträge." />
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
