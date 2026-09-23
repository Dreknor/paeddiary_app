import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { startGroupSession } from '@/api/endpoints';
import { useClassStudents } from '@/api/queries';
import type { AnswerOrderMode } from '@/api/types';
import { Card, Chip, Segmented } from '@/components/controls';
import { Button, ErrorBox, Loading } from '@/components/ui';
import { parseIdList, shortName } from '@/lib/params';
import { colors, font, spacing } from '@/theme';

/** Neue Gruppen-Graduierung für ausgewählte Schüler einer Klasse. */
export default function NewGroupSessionScreen() {
  const params = useLocalSearchParams<{ classId: string; studentIds?: string }>();
  const classId = Number(params.classId);
  const { data, isLoading } = useClassStudents(classId);
  const [selected, setSelected] = useState<Set<number>>(() => new Set(parseIdList(params.studentIds)));
  const [mode, setMode] = useState<AnswerOrderMode>('by_student');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const students = useMemo(() => data?.data ?? [], [data]);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const response = await startGroupSession({
        class_id: classId,
        schueler_ids: [...selected],
        answer_order_mode: mode,
      });
      router.replace({ pathname: '/graduierung/[sessionId]', params: { sessionId: String(response.data.id) } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Die Bewertung konnte nicht gestartet werden.');
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) return <Loading />;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Gruppenbewertung' }} />

      <Card>
        <Text style={styles.label}>Reihenfolge der Beantwortung</Text>
        <Segmented
          options={[
            { value: 'by_student', label: 'Schülerweise' },
            { value: 'by_question', label: 'Fragenweise' },
          ]}
          value={mode}
          onChange={setMode}
        />
        <Text style={styles.hint}>
          {mode === 'by_student'
            ? 'Ein Kind beantwortet alle Fragen, dann ist das nächste Kind dran.'
            : 'Alle Kinder beantworten Frage 1, dann folgt Frage 2 für alle – du gibst die Fragen frei.'}
        </Text>
      </Card>

      <Card>
        <View style={styles.row}>
          <Text style={styles.label}>Teilnehmende ({selected.size})</Text>
          <Chip
            label={selected.size === students.length ? 'Keine' : 'Alle'}
            onPress={() =>
              setSelected(selected.size === students.length ? new Set() : new Set(students.map((s) => s.id)))
            }
          />
        </View>
        <View style={styles.chips}>
          {students.map((s) => (
            <Chip
              key={s.id}
              label={shortName(s.firstname, s.lastname)}
              selected={selected.has(s.id)}
              onPress={() =>
                setSelected((prev) => {
                  const next = new Set(prev);
                  if (next.has(s.id)) next.delete(s.id);
                  else next.add(s.id);
                  return next;
                })
              }
            />
          ))}
        </View>
      </Card>

      {error ? <ErrorBox message={error} /> : null}
      <Button title="Bewertung starten" onPress={start} loading={busy} disabled={!selected.size} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, width: '100%', maxWidth: 760, alignSelf: 'center' },
  label: { fontSize: font.size.sm, fontWeight: font.weight.semibold, color: colors.textMuted },
  hint: { fontSize: font.size.sm, color: colors.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
