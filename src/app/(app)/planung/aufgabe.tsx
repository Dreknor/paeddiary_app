import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';

import { createTasks, updateTask } from '@/api/mutations';
import { SwitchRow } from '@/components/controls';
import { DateField } from '@/components/DateField';
import { StudentPicker, type PickedStudent } from '@/components/StudentPicker';
import { showToast } from '@/components/Toast';
import { Button, ErrorBox, TextField } from '@/components/ui';
import { addDays, nextSchoolDayIso, shiftSchoolDay, todayIso } from '@/lib/dates';
import { parseIdList, parseNameList } from '@/lib/params';
import { spacing } from '@/theme';

/**
 * Aufgabe anlegen (je Schüler eine) oder bearbeiten.
 * Parameter: `studentIds`, `names`, `classIds`; zum Bearbeiten `taskId`, `title`, `description`, `due`, `highlighted`.
 */
export default function TaskScreen() {
  const params = useLocalSearchParams<{
    taskId?: string;
    studentIds?: string;
    names?: string;
    classIds?: string;
    title?: string;
    description?: string;
    due?: string;
    highlighted?: string;
  }>();
  const taskId = params.taskId ? Number(params.taskId) : null;
  const classIds = useMemo(() => parseIdList(params.classIds), [params.classIds]);
  const [students, setStudents] = useState<PickedStudent[]>(() => {
    const names = parseNameList(params.names);
    return parseIdList(params.studentIds).map((id, i) => ({ id, name: names[i] ?? `Schüler ${id}` }));
  });
  const [title, setTitle] = useState(params.title ?? '');
  const [description, setDescription] = useState(params.description ?? '');
  const [due, setDue] = useState<string | null>(params.due || null);
  const [highlighted, setHighlighted] = useState(params.highlighted === '1');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = todayIso();
  const canSave = title.trim().length > 0 && (taskId !== null || students.length > 0);

  async function save() {
    setBusy(true);
    setError(null);
    const input = { title: title.trim(), description: description.trim() || null, due_date: due, highlighted };
    try {
      const result = taskId ? await updateTask(taskId, input) : await createTasks(students, input);
      showToast(
        result.status === 'sent' ? 'Aufgabe gespeichert' : 'Offline gespeichert – wird automatisch übertragen',
        result.status === 'sent' ? 'success' : 'info',
      );
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: taskId ? 'Aufgabe bearbeiten' : 'Neue Aufgabe' }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {taskId ? null : <StudentPicker selected={students} onChange={setStudents} classIds={classIds} />}
        <TextField
          label="Aufgabe"
          value={title}
          onChangeText={setTitle}
          placeholder="z. B. Lesepass abgeben"
          maxLength={100}
          autoFocus={!taskId}
        />
        <TextField
          label="Beschreibung (optional)"
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={2000}
          style={styles.multiline}
        />
        <DateField
          label="Fällig bis (optional)"
          value={due}
          onChange={setDue}
          allowClear
          minimumDate={today}
          presets={[
            { label: 'Morgen', value: nextSchoolDayIso(addDays(today, 1)) },
            { label: 'Nächste Woche', value: shiftSchoolDay(addDays(today, 6), 1) },
          ]}
        />
        <SwitchRow
          label="Wichtig"
          hint="Wird in der Wochenansicht rot hervorgehoben."
          value={highlighted}
          onValueChange={setHighlighted}
        />
        {error ? <ErrorBox message={error} /> : null}
        <Button
          title={!taskId && students.length > 1 ? `Für ${students.length} Schüler speichern` : 'Speichern'}
          onPress={save}
          loading={busy}
          disabled={!canSave}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.lg, width: '100%', maxWidth: 760, alignSelf: 'center' },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
});
