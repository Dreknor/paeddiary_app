import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { fetchStudentSession, submitSelfRating } from '@/api/endpoints';
import type { StudentSession } from '@/api/types';
import { SmileyPicker } from '@/components/grading/SmileyPicker';
import { Button, Loading } from '@/components/ui';
import { clearStudentSession, loadStudentSession, type StudentDeviceSession } from '@/student/studentSession';
import { colors, font, spacing } from '@/theme';

/** Schüler-iPad: freigegebene Fragen nacheinander mit Smileys beantworten. */
export default function StudentRatingScreen() {
  useKeepAwake();
  const queryClient = useQueryClient();
  const [device, setDevice] = useState<StudentDeviceSession | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [finished, setFinished] = useState(false);
  const [reviewId, setReviewId] = useState<number | null>(null);

  useEffect(() => {
    loadStudentSession().then((s) => {
      if (!s) router.replace('/schueler-modus');
      setDevice(s);
    });
  }, []);

  const query = useQuery({
    queryKey: ['student-session', device?.token],
    queryFn: () => fetchStudentSession(device!.serverUrl, device!.token),
    enabled: !!device && !finished,
    refetchInterval: 3000,
    retry: (count, e) => !(e instanceof ApiError && (e.status === 401 || e.status === 403)) && count < 3,
    meta: { persist: false },
  });

  // Bewertung beendet oder Codes widerrufen → Token verwerfen.
  const ended =
    finished || (query.error instanceof ApiError && (query.error.status === 401 || query.error.status === 403));
  useEffect(() => {
    if (ended) void clearStudentSession();
  }, [ended]);

  async function finish() {
    setFinished(true);
    await clearStudentSession();
    queryClient.removeQueries({ queryKey: ['student-session'] });
    router.replace('/schueler-modus');
  }

  if (device === undefined || (query.isLoading && !ended)) return <Loading />;

  if (ended || !device) {
    return (
      <Screen>
        <Text style={styles.big}>👍</Text>
        <Text style={styles.title}>Die Bewertung ist beendet.</Text>
        <Text style={styles.subtitle}>Danke fürs Mitmachen!</Text>
        <Button title="Fertig" onPress={finish} />
      </Screen>
    );
  }

  const data = query.data;
  if (!data) {
    return (
      <Screen>
        <Text style={styles.subtitle}>{query.error?.message ?? 'Verbindung wird hergestellt …'}</Text>
        <Button title="Erneut versuchen" onPress={() => query.refetch()} />
      </Screen>
    );
  }

  const rated = new Map(data.self_ratings.map((r) => [r.question_id, r.self_rating]));
  const questions = [...data.questions].sort((a, b) => a.sort_order - b.sort_order);
  const open = questions.find((q) => !rated.has(q.id));
  const current = questions.find((q) => q.id === reviewId) ?? open;

  async function pick(questionId: number, value: number) {
    setSaving(true);
    try {
      await submitSelfRating(device!.serverUrl, device!.token, questionId, value);
      queryClient.setQueryData<StudentSession>(['student-session', device!.token], (prev) =>
        prev
          ? {
              ...prev,
              self_ratings: [
                ...prev.self_ratings.filter((r) => r.question_id !== questionId),
                { question_id: questionId, self_rating: value },
              ],
            }
          : prev,
      );
      setReviewId(null);
    } catch (e) {
      Alert.alert(
        'Nicht gespeichert',
        e instanceof ApiError && e.isNetworkError
          ? 'Keine Verbindung. Bitte noch einmal tippen.'
          : String((e as Error).message),
      );
    } finally {
      setSaving(false);
    }
  }

  if (current) {
    const index = questions.indexOf(current);
    return (
      <Screen>
        <Text style={styles.name}>{data.student.firstname}</Text>
        <Text style={styles.counter}>
          Frage {index + 1}
          {data.session.answer_order_mode === 'by_student' ? ` von ${questions.length}` : ''}
        </Text>
        <Text style={styles.question}>{current.question}</Text>
        <SmileyPicker value={rated.get(current.id) ?? null} onPick={(v) => pick(current.id, v)} disabled={saving} />
        {index > 0 ? (
          <Button title="‹ Vorherige Frage" variant="ghost" onPress={() => setReviewId(questions[index - 1].id)} />
        ) : null}
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={styles.big}>{data.waiting ? '⏳' : '🎉'}</Text>
      <Text style={styles.title}>{data.waiting ? 'Gleich geht es weiter …' : 'Geschafft!'}</Text>
      <Text style={styles.subtitle}>
        {data.waiting ? 'Warte, bis deine Lehrkraft die nächste Frage freigibt.' : 'Du hast alle Fragen beantwortet.'}
      </Text>
      {questions.length ? (
        <Button title="Antworten ansehen" variant="ghost" onPress={() => setReviewId(questions[0].id)} />
      ) : null}
    </Screen>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFDF7' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.xl },
  big: { fontSize: 72 },
  title: { fontSize: 30, fontWeight: font.weight.bold, color: colors.primary, textAlign: 'center' },
  subtitle: { fontSize: font.size.lg, color: colors.textMuted, textAlign: 'center' },
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
