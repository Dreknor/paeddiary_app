import { Stack } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useClasses } from '@/api/queries';
import { useAuth } from '@/auth/AuthContext';
import { Chip, LinkButton, SectionTitle } from '@/components/controls';
import { ErrorBox, Loading } from '@/components/ui';
import {
  classKey,
  groupKey,
  MAX_TODAY,
  saveStartPrefs,
  useStartPrefs,
  type StartKey,
  type StartPrefs,
} from '@/lib/startPrefs';
import { colors, font, radius, shadow, spacing } from '@/theme';

type Row = { key: StartKey; name: string; meta: string; color: string };

/** Startseite anpassen: welche Klassen/Lerngruppen in der Liste und bei „Heute“ erscheinen. */
export default function StartSettingsScreen() {
  const { user } = useAuth();
  const { data, isLoading, error, refetch } = useClasses();
  const { prefs, ready } = useStartPrefs(user?.id);

  const classes = data?.data ?? [];
  const groups = data?.learning_groups ?? [];
  const today = prefs.today ?? classes.slice(0, MAX_TODAY).map((c) => classKey(c.id));
  // Nur Einträge zählen, die es noch gibt.
  const known = new Set<StartKey>([...classes.map((c) => classKey(c.id)), ...groups.map((g) => groupKey(g.id))]);
  const todayCount = today.filter((k) => known.has(k)).length;

  const save = (next: Partial<StartPrefs>) => {
    if (user) saveStartPrefs(user.id, { ...prefs, ...next });
  };
  const toggleList = (key: StartKey) =>
    save({ hidden: prefs.hidden.includes(key) ? prefs.hidden.filter((k) => k !== key) : [...prefs.hidden, key] });
  const toggleToday = (key: StartKey) =>
    save({ today: today.includes(key) ? today.filter((k) => k !== key) : [...today, key] });

  const classRows: Row[] = classes.map((c) => ({
    key: classKey(c.id),
    name: c.name,
    meta: `${c.students_count} Schüler`,
    color: c.color || colors.primary,
  }));
  const groupRows: Row[] = groups.map((g) => ({
    key: groupKey(g.id),
    name: g.name,
    meta: g.class_ids
      .map((id) => classes.find((c) => c.id === id))
      .map((c) => c?.short_name || c?.name)
      .filter(Boolean)
      .join(' · '),
    color: colors.accent,
  }));

  const renderRow = (row: Row) => {
    const inToday = today.includes(row.key);
    return (
      <View key={row.key} style={styles.row}>
        <View style={[styles.dot, { backgroundColor: row.color }]} />
        <View style={styles.rowText}>
          <Text style={styles.name} numberOfLines={1}>
            {row.name}
          </Text>
          {row.meta ? (
            <Text style={styles.muted} numberOfLines={1}>
              {row.meta}
            </Text>
          ) : null}
        </View>
        <View style={styles.chips}>
          <Chip label="Liste" selected={!prefs.hidden.includes(row.key)} onPress={() => toggleList(row.key)} />
          <Chip
            label="Heute"
            selected={inToday}
            disabled={!inToday && todayCount >= MAX_TODAY}
            onPress={() => toggleToday(row.key)}
          />
        </View>
      </View>
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          title: 'Startseite',
          headerRight: () => <LinkButton label="Standard" onPress={() => save({ hidden: [], today: null })} />,
        }}
      />
      <Text style={styles.intro}>
        „Liste“: erscheint unter „Meine Klassen“. „Heute“: Termine, offene Notizen und fällige Aufgaben erscheinen oben
        auf der Startseite.
      </Text>
      <Text style={styles.muted}>
        Heute: {todayCount} von höchstens {MAX_TODAY} gewählt.
      </Text>

      {isLoading || !ready ? <Loading /> : null}
      {error ? <ErrorBox message={error.message} onRetry={refetch} /> : null}

      {ready && classRows.length ? (
        <>
          <SectionTitle>Klassen</SectionTitle>
          <View style={styles.card}>{classRows.map(renderRow)}</View>
        </>
      ) : null}

      {ready && groupRows.length ? (
        <>
          <SectionTitle>Lerngruppen</SectionTitle>
          <View style={styles.card}>{groupRows.map(renderRow)}</View>
          <Text style={styles.muted}>
            Tipp: Wählst du bei „Heute“ eine Lerngruppe und ihre Klasse, erscheinen Notizen doppelt.
          </Text>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingBottom: 60,
  },
  intro: { fontSize: font.size.md, color: colors.text },
  muted: { fontSize: font.size.sm, color: colors.textMuted },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: spacing.md, ...shadow },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rowText: { flex: 1, minWidth: 120 },
  name: { fontSize: font.size.md, fontWeight: font.weight.semibold, color: colors.text },
  chips: { flexDirection: 'row', gap: spacing.sm, marginLeft: 'auto' },
});
