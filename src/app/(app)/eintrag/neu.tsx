import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';

import { createDiaryEntry } from '@/api/mutations';
import { EntryForm, emptyEntry } from '@/components/diary/EntryForm';
import { StudentPicker, type PickedStudent } from '@/components/StudentPicker';
import { showToast } from '@/components/Toast';
import { parseIdList, parseNameList } from '@/lib/params';

/**
 * Neuer Tagebucheintrag für einen oder mehrere Schüler.
 * Parameter: `studentIds=1,2`, `names=Max M.|Lisa K.`, optional `classIds=3,4` zum Hinzufügen.
 */
export default function NewEntryScreen() {
  const params = useLocalSearchParams<{ studentIds?: string; names?: string; classIds?: string }>();
  const classIds = useMemo(() => parseIdList(params.classIds), [params.classIds]);
  const [students, setStudents] = useState<PickedStudent[]>(() => {
    const ids = parseIdList(params.studentIds);
    const names = parseNameList(params.names);
    return ids.map((id, i) => ({ id, name: names[i] ?? `Schüler ${id}` }));
  });

  return (
    <>
      <Stack.Screen options={{ title: students.length > 1 ? 'Gruppeneintrag' : 'Neuer Eintrag' }} />
      <EntryForm
        initial={emptyEntry()}
        canSubmit={students.length > 0}
        header={<StudentPicker selected={students} onChange={setStudents} classIds={classIds} />}
        submitLabel={students.length > 1 ? `Für ${students.length} Schüler speichern` : 'Speichern'}
        onSubmit={async (values) => {
          const result = await createDiaryEntry(students, values);
          showToast(
            result.status === 'sent' ? 'Eintrag gespeichert' : 'Offline gespeichert – wird automatisch übertragen',
            result.status === 'sent' ? 'success' : 'info',
          );
          router.back();
        }}
      />
    </>
  );
}
