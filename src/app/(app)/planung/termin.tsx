import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { createAppointment, updateAppointment } from '@/api/mutations';
import type { AppointmentInput } from '@/api/types';
import { Chip, SwitchRow } from '@/components/controls';
import { DateField } from '@/components/DateField';
import { StudentPicker, type PickedStudent } from '@/components/StudentPicker';
import { showToast } from '@/components/Toast';
import { Button, ErrorBox, TextField } from '@/components/ui';
import { addDays, todayIso } from '@/lib/dates';
import { parseIdList, parseNameList } from '@/lib/params';
import { colors, font, spacing } from '@/theme';

const TITLE_PRESETS = ['Elterngespräch', 'Förderplangespräch', 'Entwicklungsgespräch', 'Hospitation'];
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Termin anlegen oder bearbeiten – vor allem schülerbezogen (z. B. Elterngespräch), optional für die ganze
 * Klasse/Lerngruppe. Wiederkehrende Termine werden im Web bearbeitet.
 * Parameter: `studentIds`, `names`, `classIds`, `groupId`, `date`; zum Bearbeiten `id`, `title`, `description`,
 * `start`, `end`, `pause`, `whole` („1“ = ganze Klasse/Gruppe).
 */
export default function AppointmentScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    studentIds?: string;
    names?: string;
    classIds?: string;
    groupId?: string;
    date?: string;
    title?: string;
    description?: string;
    start?: string;
    end?: string;
    pause?: string;
    whole?: string;
  }>();
  const id = params.id ? Number(params.id) : null;
  const classIds = useMemo(() => parseIdList(params.classIds), [params.classIds]);
  const groupId = params.groupId ? Number(params.groupId) : null;

  const [students, setStudents] = useState<PickedStudent[]>(() => {
    const names = parseNameList(params.names);
    return parseIdList(params.studentIds).map((sid, i) => ({ id: sid, name: names[i] ?? `Schüler ${sid}` }));
  });
  const [whole, setWhole] = useState(params.whole === '1');
  const [title, setTitle] = useState(params.title ?? '');
  const [description, setDescription] = useState(params.description ?? '');
  // Neue Termine nicht in der Vergangenheit; beim Bearbeiten das bisherige Datum behalten.
  const [date, setDate] = useState(params.date && (id || params.date >= todayIso()) ? params.date : todayIso());
  const [start, setStart] = useState(params.start ?? '');
  const [end, setEnd] = useState(params.end ?? '');
  const [weekly, setWeekly] = useState(false);
  const [pauseEntries, setPauseEntries] = useState(params.pause === '1');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timeError =
    (start && !TIME.test(start)) || (end && !TIME.test(end))
      ? 'Uhrzeit bitte als SS:MM, z. B. 14:30.'
      : start && end && end < start
        ? 'Das Ende liegt vor dem Beginn.'
        : null;
  const hasTarget = whole ? classIds.length > 0 || groupId !== null : students.length > 0;
  const canSave = title.trim().length > 0 && hasTarget && !timeError;

  async function save() {
    setBusy(true);
    setError(null);
    const input: AppointmentInput = {
      title: title.trim(),
      description: description.trim() || null,
      start_date: date,
      start_time: start || null,
      end_time: start && end ? end : null,
      is_recurring: weekly,
      recurring_type: weekly ? 'weekly' : null,
      pause_entries: pauseEntries,
      class_ids: whole && groupId === null ? classIds : [],
      group_ids: whole && groupId !== null ? [groupId] : [],
      schueler_ids: whole ? [] : students.map((s) => s.id),
    };
    try {
      const result = id ? await updateAppointment(id, input) : await createAppointment(input);
      showToast(
        result.status === 'sent' ? 'Termin gespeichert' : 'Offline gespeichert – wird automatisch übertragen',
        result.status === 'sent' ? 'success' : 'info',
      );
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  const canWhole = classIds.length > 0 || groupId !== null;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: id ? 'Termin bearbeiten' : 'Neuer Termin' }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {canWhole ? (
          <SwitchRow
            label={groupId !== null ? 'Ganze Lerngruppe' : 'Ganze Klasse'}
            hint="Aus: nur für die ausgewählten Schüler (z. B. Elterngespräch)."
            value={whole}
            onValueChange={setWhole}
          />
        ) : null}
        {!whole ? <StudentPicker selected={students} onChange={setStudents} classIds={classIds} /> : null}

        <View style={styles.block}>
          <TextField label="Titel" value={title} onChangeText={setTitle} maxLength={150} />
          <View style={styles.chips}>
            {TITLE_PRESETS.map((t) => (
              <Chip key={t} label={t} selected={title === t} onPress={() => setTitle(t)} />
            ))}
          </View>
        </View>

        <DateField
          label="Datum"
          value={date}
          onChange={(d) => d && setDate(d)}
          minimumDate={id ? undefined : todayIso()}
          presets={[
            { label: 'Heute', value: todayIso() },
            { label: 'Morgen', value: addDays(todayIso(), 1) },
          ]}
        />

        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField
              label="Beginn"
              value={start}
              onChangeText={setStart}
              placeholder="14:00"
              keyboardType="numbers-and-punctuation"
              maxLength={5}
            />
          </View>
          <View style={styles.flex}>
            <TextField
              label="Ende"
              value={end}
              onChangeText={setEnd}
              placeholder="14:30"
              keyboardType="numbers-and-punctuation"
              maxLength={5}
            />
          </View>
        </View>
        {timeError ? <Text style={styles.error}>{timeError}</Text> : null}

        <TextField
          label="Notiz (optional)"
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={2000}
          style={styles.multiline}
        />

        {!id ? (
          <SwitchRow label="Jede Woche" hint="Wöchentlich wiederholen." value={weekly} onValueChange={setWeekly} />
        ) : null}
        <SwitchRow
          label="Offene Einträge ausblenden"
          hint="Pausiert offene Einträge der Betroffenen am Termin."
          value={pauseEntries}
          onValueChange={setPauseEntries}
        />

        {error ? <ErrorBox message={error} /> : null}
        <Button title="Speichern" onPress={save} loading={busy} disabled={!canSave} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.lg, width: '100%', maxWidth: 760, alignSelf: 'center' },
  block: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  error: { color: colors.danger, fontSize: font.size.sm },
});
