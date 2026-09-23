import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { finalizeGradingStudent } from '@/api/mutations';
import { useGradingSession } from '@/api/queries';
import { useAuth } from '@/auth/AuthContext';
import { Card, Chip } from '@/components/controls';
import { scaleInfo } from '@/components/grading/scale';
import { answerFor, displayName, participants, sortedQuestions, studentProgress } from '@/components/grading/session';
import { StageBadge } from '@/components/grading/StageBadge';
import { showToast } from '@/components/Toast';
import { Button, ErrorBox, Loading } from '@/components/ui';
import { colors, font, radius, spacing } from '@/theme';

const KEEP_STAGE = 'keep';

/** Bewertung eines Schülers abschließen: Einschätzung der Lehrkraft und ggf. neue Stufe. */
export default function FinalizeScreen() {
  const params = useLocalSearchParams<{ sessionId: string; studentId: string }>();
  const sessionId = Number(params.sessionId);
  const studentId = Number(params.studentId);
  const { user } = useAuth();
  const { data, isLoading } = useGradingSession(sessionId);
  const existingNote = data?.data.teacher_assessments?.find((t) => t.schueler_id === studentId)?.note ?? '';
  const [note, setNote] = useState<string | null>(null);
  const [stage, setStage] = useState<number | typeof KEEP_STAGE | null>(KEEP_STAGE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isLoading || !data) return <Loading />;

  const student = participants(data).find((s) => s.id === studentId);
  const questions = sortedQuestions(data);
  const progress = studentProgress(data, studentId);
  const canChangeStage = !!user?.permissions.manage_grading;
  const text = note ?? existingNote;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const result = await finalizeGradingStudent(sessionId, studentId, {
        teacher_assessment: text.trim() || null,
        ...(canChangeStage && stage !== KEEP_STAGE ? { grading_stage_id: stage } : {}),
      });
      showToast(
        result.status === 'sent'
          ? `Bewertung für ${student?.firstname ?? 'Schüler'} abgeschlossen`
          : 'Offline – Abschluss wird übertragen',
        result.status === 'sent' ? 'success' : 'info',
      );
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Abschluss fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  function confirm() {
    if (progress.rated < progress.total) {
      Alert.alert(
        'Nicht alle Fragen bewertet',
        `${progress.total - progress.rated} Fragen sind noch ohne Bewertung. Trotzdem abschließen?`,
        [
          { text: 'Zurück', style: 'cancel' },
          { text: 'Abschließen', onPress: () => void submit() },
        ],
      );
    } else void submit();
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: `Abschluss: ${student ? displayName(student) : ''}` }} />

      <Card>
        <Text style={styles.label}>Zusammenfassung</Text>
        {questions.map((q, i) => {
          const a = answerFor(data, studentId, q.id);
          return (
            <View key={q.id} style={styles.summaryRow}>
              <Text style={styles.summaryQuestion} numberOfLines={2}>
                {i + 1}. {q.question}
              </Text>
              <Text style={styles.summaryValue}>{scaleInfo(a?.self_rating)?.emoji ?? '–'}</Text>
              <Text style={[styles.summaryValue, styles.teacherValue]}>{a?.rating_value ?? '–'}</Text>
            </View>
          );
        })}
        <Text style={styles.hint}>Smiley = Selbsteinschätzung · Zahl = deine Bewertung</Text>
      </Card>

      <Card>
        <Text style={styles.label}>Pädagogische Einschätzung</Text>
        <TextInput
          value={text}
          onChangeText={setNote}
          multiline
          placeholder="z. B. Die Kriterien für die nächste Stufe sind vollumfänglich erfüllt."
          placeholderTextColor={colors.textSubtle}
          style={styles.textarea}
          textAlignVertical="top"
        />
      </Card>

      {canChangeStage ? (
        <Card>
          <Text style={styles.label}>Stufe vergeben</Text>
          <View style={styles.chips}>
            <Chip label="Unverändert" selected={stage === KEEP_STAGE} onPress={() => setStage(KEEP_STAGE)} />
            {[...data.meta.available_stages]
              .sort((a, b) => a.level - b.level)
              .map((s) => (
                <Chip
                  key={s.id}
                  label={`${s.symbol ? `${s.symbol} ` : ''}${s.title}`}
                  selected={stage === s.id}
                  onPress={() => setStage(s.id)}
                />
              ))}
            <Chip label="Stufe entfernen" selected={stage === null} onPress={() => setStage(null)} />
          </View>
          {typeof stage === 'number' ? (
            <View style={styles.stagePreview}>
              <StageBadge stage={data.meta.available_stages.find((s) => s.id === stage)} size={48} />
              <Text style={styles.hint}>Der Stufenwechsel wird in der Historie und im Tagebuch vermerkt.</Text>
            </View>
          ) : null}
        </Card>
      ) : (
        <Text style={styles.hint}>Stufen vergeben kann nur, wer das Recht „Graduierungssysteme verwalten“ hat.</Text>
      )}

      {error ? <ErrorBox message={error} /> : null}
      <Button title="Bewertung abschließen" onPress={confirm} loading={busy} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingBottom: 60,
  },
  label: { fontSize: font.size.sm, fontWeight: font.weight.semibold, color: colors.textMuted },
  hint: { fontSize: font.size.xs, color: colors.textMuted, flexShrink: 1 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 2 },
  summaryQuestion: { flex: 1, fontSize: font.size.sm, color: colors.text },
  summaryValue: { width: 32, textAlign: 'center', fontSize: font.size.lg },
  teacherValue: { fontWeight: font.weight.bold, color: colors.primary },
  textarea: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: font.size.md,
    color: colors.text,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stagePreview: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
