import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';

import { useClassFeed, type FeedFilter } from '@/api/queries';
import { Chip } from '@/components/controls';
import { DiaryEntryRow } from '@/components/diary/DiaryEntryRow';
import { EmptyState, ErrorBox, Loading } from '@/components/ui';
import { addDays, todayIso } from '@/lib/dates';
import { parseIdList } from '@/lib/params';
import { colors, font, radius, spacing, touchTarget } from '@/theme';

type Range = 'today' | '14d' | 'year';

const RANGES: { value: Range; label: string }[] = [
  { value: 'today', label: 'Heute' },
  { value: '14d', label: '14 Tage' },
  { value: 'year', label: '1 Jahr' },
];

const rangeStart = (range: Range) =>
  range === 'today' ? todayIso() : addDays(todayIso(), range === '14d' ? -13 : -365);

/**
 * Klassen-Feed: Was Kolleg*innen (und du) zu den Schülern der Klasse bzw. Lerngruppe notiert haben.
 * Mit Volltextsuche („Wann hatten wir das mit dem Streit am Klettergerüst?“).
 * Parameter: `classIds=1,2`, optional `name`.
 */
export default function FeedScreen() {
  const params = useLocalSearchParams<{ classIds?: string; name?: string }>();
  const classIds = useMemo(() => parseIdList(params.classIds), [params.classIds]);
  const [range, setRange] = useState<Range>('today');
  const [othersOnly, setOthersOnly] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  // Mit Suche über ein ganzes Jahr, sonst gewählter Zeitraum.
  const filter: FeedFilter = {
    author: othersOnly ? 'others' : 'all',
    fromDate: search ? rangeStart('year') : rangeStart(range),
    search: search || null,
  };
  const feed = useClassFeed(classIds, filter);

  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ title: params.name ? `Feed · ${params.name}` : 'Feed' }} />
      <FlatList
        data={feed.entries}
        keyExtractor={(e) => String(e.id)}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={feed.isRefetching} onRefresh={feed.refetch} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <TextInput
              value={searchInput}
              onChangeText={(t) => {
                setSearchInput(t);
                if (!t.trim()) setSearch('');
              }}
              onSubmitEditing={() => setSearch(searchInput.trim())}
              placeholder="Suchen, z. B. Streit Klettergerüst"
              placeholderTextColor={colors.textSubtle}
              returnKeyType="search"
              clearButtonMode="while-editing"
              accessibilityLabel="Im Klassen-Tagebuch suchen"
              style={styles.search}
            />
            <View style={styles.filters}>
              {!search
                ? RANGES.map((r) => (
                    <Chip
                      key={r.value}
                      label={r.label}
                      selected={range === r.value}
                      onPress={() => setRange(r.value)}
                    />
                  ))
                : null}
              <Chip label="Nur Kolleg*innen" selected={othersOnly} onPress={() => setOthersOnly((v) => !v)} />
            </View>
            {search && !feed.isLoading ? (
              <Text style={styles.info}>
                {feed.entries.length} Treffer im letzten Jahr
                {feed.truncated ? ' · nur die neuesten angezeigt' : ''}
              </Text>
            ) : null}
            {feed.error ? <ErrorBox message={feed.error.message} onRetry={feed.refetch} /> : null}
          </View>
        }
        renderItem={({ item }) => <DiaryEntryRow entry={item} numberOfLines={6} />}
        ListEmptyComponent={
          feed.isLoading ? (
            <Loading />
          ) : feed.error ? null : (
            <EmptyState title={search ? 'Nichts gefunden.' : 'Keine Einträge in diesem Zeitraum.'} />
          )
        }
        ListFooterComponent={<View style={styles.footer} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.lg, width: '100%', maxWidth: 900, alignSelf: 'center' },
  header: { gap: spacing.md, marginBottom: spacing.md },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  search: {
    minHeight: touchTarget,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    fontSize: font.size.md,
    color: colors.text,
  },
  info: { fontSize: font.size.sm, color: colors.textMuted },
  separator: { height: spacing.sm },
  footer: { height: 80 },
});
