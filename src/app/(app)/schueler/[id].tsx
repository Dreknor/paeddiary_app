import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useStudentView } from '@/api/queries';
import type { StudentView } from '@/api/types';
import { Card, Fab, LinkButton, SectionTitle, Segmented } from '@/components/controls';
import { DiagnosticTab } from '@/components/diagnostic/DiagnosticTab';
import { DiaryEntryRow } from '@/components/diary/DiaryEntryRow';
import { DiaryTab } from '@/components/diary/DiaryTab';
import { GradingTab } from '@/components/grading/GradingTab';
import { StageBadge } from '@/components/grading/StageBadge';
import { Avatar, EmptyState, ErrorBox, Loading } from '@/components/ui';
import { formatDate } from '@/lib/dates';
import { shortName } from '@/lib/params';
import { colors, font, spacing } from '@/theme';

type Tab = 'overview' | 'diary' | 'grading' | 'diagnostic';

/** Schülerprofil mit Übersicht, Tagebuch, Graduierung und (mit Recht) Diagnose. */
export default function StudentScreen() {
  const { id, name, tab: initialTab } = useLocalSearchParams<{ id: string; name?: string; tab?: Tab }>();
  const studentId = Number(id);
  const { data, isLoading, error, refetch, isRefetching } = useStudentView(studentId);
  const [tab, setTab] = useState<Tab>(initialTab ?? 'overview');

  if (isLoading) return <Loading />;
  if (!data) {
    return (
      <View style={styles.pad}>
        <ErrorBox message={error?.message ?? 'Schüler nicht gefunden.'} onRetry={refetch} />
      </View>
    );
  }

  const { student } = data;
  const fullName = `${student.firstname} ${student.lastname}`;
  const tabs: { value: Tab; label: string }[] = [
    { value: 'overview', label: 'Übersicht' },
    { value: 'diary', label: 'Tagebuch' },
    { value: 'grading', label: 'Graduierung' },
    ...(data.permissions.can_view_diagnostics ? [{ value: 'diagnostic' as Tab, label: 'Diagnose' }] : []),
  ];

  const header = (
    <View style={styles.header}>
      <View style={styles.hero}>
        <Avatar firstname={student.firstname} lastname={student.lastname} size={64} />
        <View style={styles.heroText}>
          <Text style={styles.name}>{fullName}</Text>
          <Text style={styles.muted}>{student.class_name}</Text>
        </View>
      </View>
      <Segmented options={tabs} value={tab} onChange={setTab} />
    </View>
  );

  const newEntry = () =>
    router.push({
      pathname: '/eintrag/neu',
      params: {
        studentIds: String(student.id),
        names: shortName(student.firstname, student.lastname),
        classIds: String(student.class_id),
      },
    });

  return (
    <View style={styles.flex}>
      <Stack.Screen
        options={{
          title: fullName || name || '',
          headerRight: () => (
            <LinkButton
              label="Dossier"
              onPress={() =>
                router.push({
                  pathname: '/dossier/[studentId]',
                  params: { studentId: String(student.id), name: fullName },
                })
              }
            />
          ),
        }}
      />
      {tab === 'overview' ? (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        >
          {header}
          <Overview view={data} onTab={setTab} />
        </ScrollView>
      ) : null}
      {tab === 'diary' ? <DiaryTab studentId={student.id} header={header} /> : null}
      {tab === 'grading' ? <GradingTab view={data} header={header} /> : null}
      {tab === 'diagnostic' ? <DiagnosticTab view={data} header={header} /> : null}

      {tab === 'overview' || tab === 'diary' ? <Fab label="Eintrag" onPress={newEntry} /> : null}
    </View>
  );
}

function Overview({ view, onTab }: { view: StudentView; onTab: (t: Tab) => void }) {
  const stage = view.grading_overview.current_stage;
  const diagnostic = view.diagnostic_overview;

  return (
    <>
      <View style={styles.cards}>
        <Pressable style={styles.cardWrap} onPress={() => onTab('grading')} accessibilityRole="button">
          <Card>
            <Text style={styles.cardLabel}>Graduierung</Text>
            <View style={styles.stageRow}>
              <StageBadge stage={stage} size={40} />
              <Text style={styles.cardValue}>{stage?.title ?? 'Noch keine Stufe'}</Text>
            </View>
            {stage?.achieved_at ? <Text style={styles.muted}>seit {formatDate(stage.achieved_at)}</Text> : null}
            {view.grading_overview.has_open_session ? (
              <Text style={styles.note}>Offene Bewertung vorhanden</Text>
            ) : null}
          </Card>
        </Pressable>

        {diagnostic ? (
          <Pressable style={styles.cardWrap} onPress={() => onTab('diagnostic')} accessibilityRole="button">
            <Card>
              <Text style={styles.cardLabel}>Diagnose</Text>
              <Text style={styles.cardValue}>{diagnostic.active_goals_count} aktive Ziele</Text>
              {diagnostic.active_goals.slice(0, 3).map((g) => (
                <Text key={g.id} style={styles.goal} numberOfLines={2}>
                  • {g.title}
                </Text>
              ))}
              {diagnostic.last_assessment_date ? (
                <Text style={styles.muted}>Letzte Diagnose {formatDate(diagnostic.last_assessment_date)}</Text>
              ) : null}
            </Card>
          </Pressable>
        ) : null}
      </View>

      <SectionTitle action={<LinkButton label="Alle" onPress={() => onTab('diary')} />}>Letzte Einträge</SectionTitle>
      {view.recent_paed_diary_entries.length ? (
        view.recent_paed_diary_entries.map((e) => <DiaryEntryRow key={e.id} entry={e} numberOfLines={4} />)
      ) : (
        <EmptyState title="Noch keine Einträge." />
      )}
      <View style={styles.fabSpace} />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pad: { padding: spacing.lg },
  content: { padding: spacing.lg, gap: spacing.lg, width: '100%', maxWidth: 900, alignSelf: 'center' },
  header: { gap: spacing.lg },
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  heroText: { flex: 1, gap: spacing.xs },
  name: { fontSize: font.size.xxl, fontWeight: font.weight.bold, color: colors.text },
  muted: { fontSize: font.size.sm, color: colors.textMuted },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  cardWrap: { flexGrow: 1, flexBasis: 260 },
  cardLabel: { fontSize: font.size.xs, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  stageRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cardValue: { fontSize: font.size.lg, fontWeight: font.weight.semibold, color: colors.primary, flexShrink: 1 },
  note: { fontSize: font.size.sm, color: colors.warning },
  goal: { fontSize: font.size.sm, color: colors.text },
  fabSpace: { height: 96 },
});
