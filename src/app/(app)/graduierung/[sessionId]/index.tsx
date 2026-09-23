import { useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { updateAnswerOrderMode } from '@/api/endpoints';
import { saveGradingAnswers } from '@/api/mutations';
import { queryKeys, useGradingSession } from '@/api/queries';
import type { AnswerOrderMode, GradingAnswerInput, GradingSessionResponse, SessionStudent } from '@/api/types';
import { showActionSheet } from '@/components/ActionSheet';
import { BottomBar, LinkButton, Segmented } from '@/components/controls';
import { QuestionRatingRow } from '@/components/grading/QuestionRatingRow';
import { answerFor, displayName, participants, sortedQuestions, studentProgress } from '@/components/grading/session';
import { showToast } from '@/components/Toast';
import { Button, ErrorBox, Loading } from '@/components/ui';
import { colors, font, radius, spacing, tabletBreakpoint } from '@/theme';

/** Bewertung durch die Lehrkraft – schülerweise oder fragenweise; Einstieg in Schülermodus und Schüler-iPads. */
export default function GradingSessionScreen() {
  const { sessionId: rawId } = useLocalSearchParams<{ sessionId: string }>();
  const sessionId = Number(rawId);
  const queryClient = useQueryClient();
  // Regelmäßig nachladen, damit Selbsteinschätzungen von Schüler-iPads erscheinen.
  const { data, isLoading, error, refetch } = useGradingSession(sessionId, 8000);
  const [view, setView] = useState<AnswerOrderMode | null>(null);
  const [studentId, setStudentId] = useState<number | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const { width } = useWindowDimensions();
  const isTablet = width >= tabletBreakpoint;

  const students = useMemo(() => (data ? participants(data) : []), [data]);
  const questions = useMemo(() => (data ? sortedQuestions(data) : []), [data]);

  if (isLoading) return <Loading />;
  if (!data) {
    return (
      <View style={styles.pad}>
        <ErrorBox message={error?.message ?? 'Bewertung nicht gefunden.'} onRetry={refetch} />
      </View>
    );
  }

  const session = data.data;
  const readOnly = session.is_completed || !session.is_owner;
  const isGroup = session.type === 'group';
  const currentView = view ?? session.answer_order_mode;

  function save(forStudent: number, answer: GradingAnswerInput) {
    saveGradingAnswers(queryClient, sessionId, forStudent, [answer]).then(
      (r) => r.status === 'queued' && showToast('Offline – Bewertung wird übertragen', 'info'),
      (e) => {
        Alert.alert('Nicht gespeichert', e instanceof Error ? e.message : String(e));
        void refetch();
      },
    );
  }

  async function changeMode(mode: AnswerOrderMode) {
    try {
      const response = await updateAnswerOrderMode(sessionId, mode);
      queryClient.setQueryData(queryKeys.gradingSession(sessionId), response);
      setView(mode);
      showToast(mode === 'by_student' ? 'Reihenfolge: schülerweise' : 'Reihenfolge: fragenweise');
    } catch (e) {
      Alert.alert('Nicht geändert', e instanceof Error ? e.message : String(e));
    }
  }

  function openMenu() {
    showActionSheet({
      title: 'Bewertung',
      options: [
        ...(!readOnly
          ? [
              {
                label: 'Selbsteinschätzung – iPad weitergeben',
                onPress: () =>
                  router.push({
                    pathname: '/graduierung/[sessionId]/selbst',
                    params: { sessionId: String(sessionId) },
                  }),
              },
              {
                label: 'Schüler-iPads verbinden (QR-Codes)',
                onPress: () =>
                  router.push({ pathname: '/graduierung/[sessionId]/codes', params: { sessionId: String(sessionId) } }),
              },
            ]
          : []),
        ...(!readOnly && isGroup
          ? [
              {
                label:
                  session.answer_order_mode === 'by_student'
                    ? 'Reihenfolge ändern → fragenweise'
                    : 'Reihenfolge ändern → schülerweise',
                onPress: () => changeMode(session.answer_order_mode === 'by_student' ? 'by_question' : 'by_student'),
              },
            ]
          : []),
        { label: 'Aktualisieren', onPress: () => void refetch() },
      ],
    });
  }

  // Standard: erster noch nicht abgeschlossener Schüler.
  const selected = students.find((s) => s.id === studentId) ?? students.find((s) => !s.finalized) ?? students[0];
  const question = questions[Math.min(questionIndex, questions.length - 1)];

  const studentList = (
    <StudentChooser
      students={students}
      data={data}
      selectedId={selected?.id}
      onSelect={setStudentId}
      vertical={isTablet}
    />
  );

  return (
    <View style={styles.flex}>
      <Stack.Screen
        options={{
          title: session.grading_system.name,
          headerRight: () => <LinkButton label="Mehr" onPress={openMenu} />,
        }}
      />

      {session.is_completed ? (
        <Text style={styles.banner}>Diese Bewertung ist abgeschlossen.</Text>
      ) : !session.is_owner ? (
        <Text style={styles.banner}>Nur {session.created_by_name} kann diese Bewertung bearbeiten.</Text>
      ) : null}

      {isGroup ? (
        <View style={styles.viewToggle}>
          <Segmented
            options={[
              { value: 'by_student', label: 'Schülerweise' },
              { value: 'by_question', label: 'Fragenweise' },
            ]}
            value={currentView}
            onChange={setView}
          />
        </View>
      ) : null}

      {currentView === 'by_student' || !isGroup ? (
        <View style={[styles.flex, isTablet && styles.split]}>
          {isGroup ? studentList : null}
          {selected ? (
            <FlatList
              style={styles.flex}
              data={questions}
              keyExtractor={(q) => String(q.id)}
              contentContainerStyle={styles.list}
              ListHeaderComponent={
                <Text style={styles.listTitle}>
                  {displayName(selected)}
                  {selected.finalized ? ' · abgeschlossen ✓' : ''}
                </Text>
              }
              renderItem={({ item, index }) => (
                <QuestionRatingRow
                  key={`${selected.id}-${item.id}`}
                  title={`${index + 1}. ${item.question}`}
                  answer={answerFor(data, selected.id, item.id)}
                  disabled={readOnly || selected.finalized}
                  onRate={(v) => save(selected.id, { question_id: item.id, rating_value: v })}
                  onComment={(c) => save(selected.id, { question_id: item.id, comment: c })}
                />
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          ) : null}
        </View>
      ) : question ? (
        <FlatList
          data={students}
          keyExtractor={(s) => String(s.id)}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.questionHeader}>
              <View style={styles.pager}>
                <Button
                  title="‹"
                  variant="secondary"
                  onPress={() => setQuestionIndex((i) => Math.max(0, i - 1))}
                  disabled={questionIndex === 0}
                />
                <Text style={styles.pagerText}>
                  Frage {questionIndex + 1} von {questions.length}
                  {data.meta.current_question_id === question.id ? ' · freigegeben' : ''}
                </Text>
                <Button
                  title="›"
                  variant="secondary"
                  onPress={() => setQuestionIndex((i) => Math.min(questions.length - 1, i + 1))}
                  disabled={questionIndex >= questions.length - 1}
                />
              </View>
              <Text style={styles.questionText}>{question.question}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <QuestionRatingRow
              key={`${item.id}-${question.id}`}
              title={displayName(item)}
              subtitle={item.finalized ? 'abgeschlossen' : undefined}
              answer={answerFor(data, item.id, question.id)}
              disabled={readOnly || item.finalized}
              onRate={(v) => save(item.id, { question_id: question.id, rating_value: v })}
              onComment={(c) => save(item.id, { question_id: question.id, comment: c })}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      ) : null}

      {!readOnly && selected && (currentView === 'by_student' || !isGroup) && !selected.finalized ? (
        <BottomBar>
          <Text style={styles.progress}>
            {studentProgress(data, selected.id).rated}/{questions.length} bewertet
          </Text>
          <View style={styles.flex} />
          <Button
            title={`Abschließen: ${selected.firstname}`}
            onPress={() =>
              router.push({
                pathname: '/graduierung/[sessionId]/abschluss',
                params: { sessionId: String(sessionId), studentId: String(selected.id) },
              })
            }
          />
        </BottomBar>
      ) : null}
    </View>
  );
}

function StudentChooser({
  students,
  data,
  selectedId,
  onSelect,
  vertical,
}: {
  students: SessionStudent[];
  data: GradingSessionResponse;
  selectedId: number | undefined;
  onSelect: (id: number) => void;
  vertical: boolean;
}) {
  return (
    <ScrollView
      horizontal={!vertical}
      style={vertical ? styles.sidebar : styles.chooser}
      contentContainerStyle={vertical ? styles.sidebarContent : styles.chooserContent}
      showsHorizontalScrollIndicator={false}
    >
      {students.map((s) => {
        const p = studentProgress(data, s.id);
        const active = s.id === selectedId;
        return (
          <Pressable
            key={s.id}
            onPress={() => onSelect(s.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.studentItem, active && styles.studentItemActive]}
          >
            <Text style={[styles.studentName, active && styles.studentNameActive]} numberOfLines={1}>
              {displayName(s)}
            </Text>
            <Text style={[styles.studentMeta, active && styles.studentNameActive]}>
              {s.finalized ? 'abgeschlossen ✓' : `${p.rated}/${p.total} · selbst ${p.self}`}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pad: { padding: spacing.lg },
  split: { flexDirection: 'row' },
  banner: {
    backgroundColor: colors.warningSoft,
    color: colors.warning,
    padding: spacing.md,
    textAlign: 'center',
    fontSize: font.size.sm,
  },
  viewToggle: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  list: { padding: spacing.lg, paddingBottom: 140, width: '100%', maxWidth: 900, alignSelf: 'center' },
  listTitle: { fontSize: font.size.xl, fontWeight: font.weight.bold, color: colors.text, marginBottom: spacing.md },
  separator: { height: spacing.md },
  questionHeader: { gap: spacing.md, marginBottom: spacing.lg },
  pager: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pagerText: { flex: 1, textAlign: 'center', fontSize: font.size.sm, color: colors.textMuted },
  questionText: { fontSize: font.size.xl, fontWeight: font.weight.semibold, color: colors.text, lineHeight: 28 },
  progress: { fontSize: font.size.sm, color: colors.textMuted },
  chooser: { flexGrow: 0, maxHeight: 80 },
  chooserContent: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  sidebar: { width: 240, flexGrow: 0, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.border },
  sidebarContent: { padding: spacing.md, gap: spacing.xs },
  studentItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    minWidth: 120,
  },
  studentItemActive: { backgroundColor: colors.primary },
  studentName: { fontSize: font.size.md, fontWeight: font.weight.semibold, color: colors.text },
  studentNameActive: { color: colors.onPrimary },
  studentMeta: { fontSize: font.size.xs, color: colors.textMuted },
});
