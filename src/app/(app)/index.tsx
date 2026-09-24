import { useQueryClient } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { queryKeys, useClasses } from '@/api/queries';
import type { LearningGroup, SchoolClass } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { LinkButton } from '@/components/controls';
import { openWeek } from '@/lib/navigation';
import { classKey, groupKey, keyToScope, MAX_TODAY, useStartPrefs, type StartKey } from '@/lib/startPrefs';
import { TodayPanel, type TodayTarget } from '@/components/today/TodayPanel';
import { EmptyState, ErrorBox, Loading } from '@/components/ui';
import { useOutbox } from '@/sync/outbox';
import { colors, font, radius, shadow, spacing, touchTarget } from '@/theme';

type Tab = 'classes' | 'groups';

export default function ClassesScreen() {
  const { user, server } = useAuth();
  const { data, isLoading, error, refetch, isRefetching } = useClasses();
  const queryClient = useQueryClient();
  const refresh = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: queryKeys.diaryWeeks });
  };
  const [tab, setTab] = useState<Tab>('classes');
  const outbox = useOutbox().filter((i) => i.userId === user?.id);
  const failed = outbox.filter((i) => i.status === 'failed').length;

  const { prefs, ready } = useStartPrefs(user?.id);
  const classes = data?.data ?? [];
  const groups = data?.learning_groups ?? [];
  const hidden = new Set(prefs.hidden);
  const visibleClasses = classes.filter((c) => !hidden.has(classKey(c.id)));
  const visibleGroups = groups.filter((g) => !hidden.has(groupKey(g.id)));
  const hiddenCount = classes.length + groups.length - visibleClasses.length - visibleGroups.length;
  // Nur Lerngruppen sichtbar → gleich diese zeigen.
  const shownTab: Tab = !visibleGroups.length ? 'classes' : !visibleClasses.length ? 'groups' : tab;

  const todayKeys = prefs.today ?? classes.slice(0, MAX_TODAY).map((c) => classKey(c.id));
  const targets = todayKeys.map((key) => todayTarget(key, classes, groups)).filter((t): t is TodayTarget => !!t);
  const todayHint =
    prefs.today === null && classes.length + groups.length > targets.length
      ? 'Weitere Klassen und Lerngruppen kannst du über „Anpassen“ hinzufügen.'
      : null;
  const customize = () => router.push('/startseite');

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
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refresh} />}
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

        {ready && classes.length + groups.length ? (
          <TodayPanel targets={targets} hint={todayHint} onCustomize={customize} />
        ) : null}

        {data ? (
          <View style={styles.headingRow}>
            <Text style={styles.heading}>{groups.length ? 'Klassen & Lerngruppen' : 'Meine Klassen'}</Text>
            {classes.length + groups.length ? <LinkButton label="Anpassen" onPress={customize} /> : null}
          </View>
        ) : null}

        {visibleClasses.length > 0 && visibleGroups.length > 0 ? (
          <View style={styles.segment} accessibilityRole="tablist">
            <SegmentButton label="Klassen" active={shownTab === 'classes'} onPress={() => setTab('classes')} />
            <SegmentButton label="Lerngruppen" active={shownTab === 'groups'} onPress={() => setTab('groups')} />
          </View>
        ) : null}

        {isLoading ? <Loading /> : null}
        {error ? <ErrorBox message={error.message} onRetry={refetch} /> : null}

        {data && shownTab === 'classes' ? (
          visibleClasses.length ? (
            <View style={styles.grid}>
              {visibleClasses.map((c) => (
                <ClassCard key={c.id} item={c} />
              ))}
            </View>
          ) : classes.length ? null : (
            <EmptyState title="Dir sind noch keine Klassen zugewiesen." />
          )
        ) : null}

        {data && shownTab === 'groups' ? (
          <View style={styles.grid}>
            {visibleGroups.map((g) => (
              <GroupCard key={g.id} item={g} classes={classes} />
            ))}
          </View>
        ) : null}

        {hiddenCount > 0 ? (
          <Text style={styles.greeting}>
            {hiddenCount === 1 ? '1 Klasse/Lerngruppe ausgeblendet' : `${hiddenCount} Klassen/Lerngruppen ausgeblendet`}
          </Text>
        ) : null}
      </ScrollView>
    </>
  );
}

function todayTarget(key: StartKey, classes: SchoolClass[], groups: LearningGroup[]): TodayTarget | null {
  const scope = keyToScope(key);
  if ('classId' in scope) {
    const c = classes.find((x) => x.id === scope.classId);
    return c ? { key, scope, name: c.name, color: c.color || colors.primary } : null;
  }
  const g = groups.find((x) => x.id === scope.groupId);
  return g ? { key, scope, name: g.name, color: colors.accent } : null;
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
      <WeekButton onPress={() => openWeek({ classId: item.id }, item.name)} name={item.name} />
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
      <WeekButton onPress={() => openWeek({ groupId: item.id }, item.name)} name={item.name} />
    </Pressable>
  );
}

/** Direkt zur Wochenansicht (Kalender). */
function WeekButton({ onPress, name }: { onPress: () => void; name: string }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.weekButton, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`Wochenansicht ${name}`}
    >
      <Text style={styles.weekButtonText}>Woche</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, width: '100%', maxWidth: 1100, alignSelf: 'center' },
  syncBanner: { backgroundColor: colors.warningSoft, borderRadius: radius.md, padding: spacing.md },
  syncFailed: { backgroundColor: colors.dangerSoft },
  syncText: { color: colors.warning, fontSize: font.size.sm, fontWeight: font.weight.medium },
  syncTextFailed: { color: colors.danger },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  heading: { fontSize: font.size.xl, fontWeight: font.weight.bold, color: colors.text },
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
  weekButton: {
    alignSelf: 'center',
    minHeight: touchTarget,
    minWidth: touchTarget,
    marginRight: spacing.md,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  weekButtonText: { color: colors.primary, fontWeight: font.weight.semibold, fontSize: font.size.sm },
});
