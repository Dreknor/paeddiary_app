import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';

import { createDiaryEntry } from '@/api/mutations';
import { EntryForm, emptyEntry, type EntryKind } from '@/components/diary/EntryForm';
import { StudentPicker, type PickedStudent } from '@/components/StudentPicker';
import { showToast } from '@/components/Toast';
import { todayIso } from '@/lib/dates';
import { parseIdList, parseNameList } from '@/lib/params';

/**
 * Neuer Tagebucheintrag für einen oder mehrere Schüler.
 * Parameter: `studentIds=1,2`, `names=Max M.|Lisa K.`, optional `classIds=3,4` zum Hinzufügen
 * `date=YYYY-MM-DD` (nicht in der Zukunft) und `art=notiz` für eine offene Notiz.
 */
export default function NewEntryScreen() {
  const params = useLocalSearchParams<{
    studentIds?: string;
    names?: string;
    classIds?: string;
    date?: string;
    art?: string;
  }>();
  const classIds = useMemo(() => parseIdList(params.classIds), [params.classIds]);
  const [students, setStudents] = useState<PickedStudent[]>(() => {
    const ids = parseIdList(params.studentIds);
    const names = parseNameList(params.names);
    return ids.map((id, i) => ({ id, name: names[i] ?? `Schüler ${id}` }));
  });

  const [kind, setKind] = useState<EntryKind>(params.art === 'notiz' ? 'notiz' : 'eintrag');
  const [initial] = useState(() => {
    const entry = emptyEntry(kind);
    const date = params.date;
    return date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= todayIso() ? { ...entry, entry_date: date } : entry;
  });

  return (
    <>
      <Stack.Screen options={{ title: screenTitle(kind, students.length) }} />
      <EntryForm
        initial={initial}
        canSubmit={students.length > 0}
        header={<StudentPicker selected={students} onChange={setStudents} classIds={classIds} />}
        onKindChange={setKind}
        submitLabel={students.length > 1 ? `Für ${students.length} Schüler speichern` : 'Speichern'}
        onSubmit={async (values) => {
          const result = await createDiaryEntry(students, values);
          showToast(
            result.status === 'sent'
              ? `${kind === 'notiz' ? 'Notiz' : 'Eintrag'} gespeichert`
              : 'Offline gespeichert – wird automatisch übertragen',
            result.status === 'sent' ? 'success' : 'info',
          );
          router.back();
        }}
      />
    </>
  );
}

function screenTitle(kind: EntryKind, count: number) {
  if (kind === 'notiz') return count > 1 ? 'Gruppennotiz' : 'Neue Notiz';
  return count > 1 ? 'Gruppeneintrag' : 'Neuer Eintrag';
}
