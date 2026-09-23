import { useQueryClient } from '@tanstack/react-query';
import { useKeepAwake } from 'expo-keep-awake';
import * as LocalAuthentication from 'expo-local-authentication';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { saveGradingAnswers } from '@/api/mutations';
import { useGradingSession } from '@/api/queries';
import type { GradingQuestion, SessionStudent } from '@/api/types';
import { answerFor, participants, sortedQuestions } from '@/components/grading/session';
import { SmileyPicker } from '@/components/grading/SmileyPicker';
import { Button, Loading } from '@/components/ui';
import { colors, font, radius, spacing } from '@/theme';

type Step = { student: SessionStudent; question: GradingQuestion; index: number; total: number };

/**
 * Schülermodus „iPad weitergeben“: Kinder geben reihum ihre Selbsteinschätzung ab.
 * Sie sehen nur ihren Vornamen und die aktuelle Frage – keine Bewertungen, keine anderen Kinder.
 * Beenden nur mit Face ID / Code der Lehrkraft.
 */
export default function PassAroundScreen() {
  useKeepAwake();
  const { sessionId: rawId } = useLocalSearchParams<{ sessionId: string }>();
  const sessionId = Number(rawId);
  const queryClient = useQueryClient();
  const { data, isLoading } = useGradingSession(sessionId);
  const [manualPosition, setPosition] = useState<number | null>(null);
  // Schüler, der die Übergabe bestätigt hat („Ich bin …“). Anderer Schüler → Übergabebildschirm.
  const [confirmedStudent, setConfirmedStudent] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Schritte in der Reihenfolge der Session: schülerweise oder fragenweise.
  const steps = useMemo<Step[]>(() => {
    if (!data) return [];
    const students = participants(data).filter((s) => !s.finalized);
    const questions = sortedQuestions(data);
    const out: Step[] = [];
    if (data.data.answer_order_mode === 'by_question') {
      questions.forEach((question, qi) =>
        students.forEach((student) => out.push({ student, question, index: qi, total: questions.length })),
      );
    } else {
      students.forEach((student) =>
        questions.forEach((question, qi) => out.push({ student, question, index: qi, total: questions.length })),
      );
    }
    return out;
  }, [data]);

  // Beim Start zum ersten Schritt ohne Selbsteinschätzung springen.
  const startPosition = useMemo(() => {
    if (!data) return null;
    const first = steps.findIndex((s) => answerFor(data, s.student.id, s.question.id)?.self_rating == null);
    return first === -1 ? steps.length : first;
    // Nur einmalig beim Laden bestimmen, nicht bei jeder Antwort.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps]);
  const position = manualPosition ?? startPosition;

  // Android-Zurück-Taste sperren.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  async function exit() {
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    if (level === LocalAuthentication.SecurityLevel.NONE) {
      Alert.alert('Schülermodus beenden?', undefined, [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Beenden', onPress: () => router.back() },
      ]);
      return;
    }
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Schülermodus beenden (Lehrkraft)' });
    if (result.success) router.back();
  }

  if (isLoading || !data || position === null) return <Loading />;

  const step = steps[position];
  const done = position >= steps.length;
  const handoverTo: SessionStudent | null = step && step.student.id !== confirmedStudent ? step.student : null;

  async function pick(value: number) {
    if (!step || saving) return;
    setSaving(true);
    try {
      await saveGradingAnswers(queryClient, sessionId, step.student.id, [
        { question_id: step.question.id, self_rating: value },
      ]);
    } catch (e) {
      Alert.alert('Nicht gespeichert', e instanceof Error ? e.message : String(e));
      setSaving(false);
      return;
    }
    setSaving(false);
    setPosition(position! + 1);
  }

  function back() {
    if (position! > 0 && steps[position! - 1].student.id === step?.student.id) setPosition(position! - 1);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <View style={styles.top}>
        <Text style={styles.progress}>{done ? '' : `${position + 1} / ${steps.length}`}</Text>
        <Pressable onPress={exit} hitSlop={16} accessibilityRole="button" accessibilityLabel="Schülermodus beenden">
          <Text style={styles.exit}>Beenden 🔒</Text>
        </Pressable>
      </View>

      {done ? (
        <View style={styles.center}>
          <Text style={styles.big}>🎉</Text>
          <Text style={styles.title}>Geschafft!</Text>
          <Text style={styles.subtitle}>Bitte gib das iPad an deine Lehrkraft zurück.</Text>
        </View>
      ) : handoverTo ? (
        <View style={styles.center}>
          <Text style={styles.big}>👋</Text>
          <Text style={styles.title}>Jetzt ist {handoverTo.firstname} dran!</Text>
          <Text style={styles.subtitle}>Gib das iPad bitte an {handoverTo.firstname} weiter.</Text>
          <Button
            title={`Ich bin ${handoverTo.firstname} – los geht's`}
            onPress={() => setConfirmedStudent(handoverTo.id)}
            style={styles.start}
          />
        </View>
      ) : step ? (
        <View style={styles.center}>
          <Text style={styles.name}>{step.student.firstname}</Text>
          <Text style={styles.counter}>
            Frage {step.index + 1} von {step.total}
          </Text>
          <Text style={styles.question}>{step.question.question}</Text>
          <SmileyPicker
            value={answerFor(data, step.student.id, step.question.id)?.self_rating ?? null}
            onPick={pick}
            disabled={saving}
          />
          {position > 0 && steps[position - 1].student.id === step.student.id ? (
            <Button title="‹ Vorherige Frage" variant="ghost" onPress={back} />
          ) : null}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFDF7' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg },
  progress: { fontSize: font.size.sm, color: colors.textSubtle },
  exit: { fontSize: font.size.sm, color: colors.textMuted, padding: spacing.sm, borderRadius: radius.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.xl },
  big: { fontSize: 72 },
  title: { fontSize: 32, fontWeight: font.weight.bold, color: colors.primary, textAlign: 'center' },
  subtitle: { fontSize: font.size.lg, color: colors.textMuted, textAlign: 'center' },
  start: { minWidth: 280, minHeight: 64 },
  name: { fontSize: font.size.xl, fontWeight: font.weight.bold, color: colors.accent },
  counter: { fontSize: font.size.sm, color: colors.textMuted, marginTop: -spacing.lg },
  question: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: font.weight.semibold,
    color: colors.text,
    textAlign: 'center',
    maxWidth: 800,
  },
});
