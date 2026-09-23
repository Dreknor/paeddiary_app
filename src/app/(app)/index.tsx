import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useClasses } from '@/api/queries';
import type { LearningGroup, SchoolClass } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { LinkButton } from '@/components/controls';
import { EmptyState, ErrorBox, Loading } from '@/components/ui';
import { useOutbox } from '@/sync/outbox';
import { colors, font, radius, shadow, spacing, touchTarget } from '@/theme';

type Tab = 'classes' | 'groups';

export default function ClassesScreen() {
  const { user, server } = useAuth();
  const { data, isLoading, error, refetch, isRefetching } = useClasses();
  const [tab, setTab] = useState<Tab>('classes');
  const outbox = useOutbox().filter((i) => i.userId === user?.id);
  const failed = outbox.filter((i) => i.status === 'failed').length;

  const groups = data?.learning_groups ?? [];

  return (
    <>
      <Stack.Screen
        options={{
          title: server?.instance.name ?? 'Meine Klassen',
          headerRight: () => <LinkButton label="Mehr" onPress={() => router.push('/einstellungen')} />,
        }}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        <Text style={styles.greeting}>Hallo {user?.name}</Text>

        {outbox.length ? (
          <Pressable
            onPress={() => router.push('/einstellungen')}
            style={[styles.syncBanner, failed ? styles.syncFailed : null]}
            accessibilityRole="button"
          >
            <Text style={[styles.syncText, failed ? styles.syncTextFailed : null]}>
              {failed
                ? `⚠ ${failed} Änderung(en) konnten nicht gespeichert werden – antippen`
                : `⟳ ${outbox.length} Änderung(en) warten auf Übertragung`}
            </Text>
          </Pressable>
        ) : null}

        {groups.length > 0 ? (
          <View style={styles.segment} accessibilityRole="tablist">
            <SegmentButton label="Klassen" active={tab === 'classes'} onPress={() => setTab('classes')} />
            <SegmentButton label="Lerngruppen" active={tab === 'groups'} onPress={() => setTab('groups')} />
          </View>
        ) : null}

        {isLoading ? <Loading /> : null}
        {error ? <ErrorBox message={error.message} onRetry={refetch} /> : null}

        {data && tab === 'classes' ? (
          data.data.length ? (
            <View style={styles.grid}>
              {data.data.map((c) => (
                <ClassCard key={c.id} item={c} />
              ))}
            </View>
          ) : (
            <EmptyState title="Dir sind noch keine Klassen zugewiesen." />
          )
        ) : null}

        {data && tab === 'groups' ? (
          <View style={styles.grid}>
            {groups.map((g) => (
              <GroupCard key={g.id} item={g} classes={data.data} />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </>
  );
}

function SegmentButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={[styles.segmentButton, active && styles.segmentButtonActive]}
    >
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
}

function ClassCard({ item }: { item: SchoolClass }) {
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() => router.push({ pathname: '/klasse/[id]', params: { id: String(item.id), name: item.name } })}
    >
      <View style={[styles.colorBar, { backgroundColor: item.color || colors.primary }]} />
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>{item.name}</Text>
        <Text style={styles.cardMeta}>
          {item.students_count} Schüler · {item.school_year}
        </Text>
      </View>
    </Pressable>
  );
}

function GroupCard({ item, classes }: { item: LearningGroup; classes: SchoolClass[] }) {
  const names = item.class_ids
    .map((id) => classes.find((c) => c.id === id))
    .filter((c): c is SchoolClass => !!c)
    .map((c) => c.short_name || c.name);
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() =>
        router.push({
          pathname: '/lerngruppe/[id]',
          params: { id: String(item.id), name: item.name, classIds: item.class_ids.join(',') },
        })
      }
    >
      <View style={[styles.colorBar, { backgroundColor: colors.accent }]} />
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>{item.name}</Text>
        <Text style={styles.cardMeta}>{names.join(' · ')}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, width: '100%', maxWidth: 1100, alignSelf: 'center' },
  syncBanner: { backgroundColor: colors.warningSoft, borderRadius: radius.md, padding: spacing.md },
  syncFailed: { backgroundColor: colors.dangerSoft },
  syncText: { color: colors.warning, fontSize: font.size.sm, fontWeight: font.weight.medium },
  syncTextFailed: { color: colors.danger },
  greeting: { fontSize: font.size.lg, color: colors.textMuted },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.divider,
    borderRadius: radius.md,
    padding: 3,
    alignSelf: 'flex-start',
  },
  segmentButton: { paddingHorizontal: spacing.lg, minHeight: 40, justifyContent: 'center', borderRadius: radius.sm },
  segmentButtonActive: { backgroundColor: colors.surface, ...shadow },
  segmentText: { fontSize: font.size.sm, color: colors.textMuted, fontWeight: font.weight.medium },
  segmentTextActive: { color: colors.primary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  card: {
    flexGrow: 1,
    flexBasis: 280,
    minHeight: touchTarget + 24,
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow,
  },
  pressed: { opacity: 0.8 },
  colorBar: { width: 6 },
  cardBody: { flex: 1, padding: spacing.lg, gap: spacing.xs },
  cardTitle: { fontSize: font.size.lg, fontWeight: font.weight.semibold, color: colors.text },
  cardMeta: { fontSize: font.size.sm, color: colors.textMuted },
});
