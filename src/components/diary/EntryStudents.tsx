import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { setEntryStudent } from '@/api/mutations';
import { useClassStudents } from '@/api/queries';
import type { DiaryEntry } from '@/api/types';
import { Chip } from '@/components/controls';
import { showToast } from '@/components/Toast';
import { colors, font, spacing } from '@/theme';

/**
 * Schüler eines Eintrags: antippen = entfernen, „+ Schüler“ = aus der Klasse des Eintrags hinzufügen.
 * Änderungen werden sofort gespeichert (unabhängig vom Text).
 */
export function EntryStudents({ entry }: { entry: DiaryEntry }) {
  const queryClient = useQueryClient();
  const { data } = useClassStudents(entry.class_id);
  const [adding, setAdding] = useState(false);
  const [ids, setIds] = useState(entry.schueler_ids);
  const students = data?.data ?? [];
  const nameOf = (id: number) => {
    const s = students.find((x) => x.id === id);
    return s ? `${s.firstname} ${s.lastname.charAt(0)}.` : `Schüler ${id}`;
  };

  async function change(studentId: number, attach: boolean) {
    const previous = ids;
    setIds(attach ? [...ids, studentId] : ids.filter((id) => id !== studentId));
    try {
      const result = await setEntryStudent({ ...entry, schueler_ids: previous }, studentId, attach);
      if (result.status === 'queued') showToast('Offline gespeichert – wird automatisch übertragen', 'info');
      queryClient.invalidateQueries({ queryKey: ['diary-entry', entry.id] });
    } catch (e) {
      setIds(previous);
      showToast(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.', 'error');
    }
  }

  const others = students.filter((s) => !ids.includes(s.id));

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Schüler ({ids.length}) – antippen zum Entfernen</Text>
      <View style={styles.chips}>
        {ids.map((id) => (
          <Chip
            key={id}
            label={`${nameOf(id)} ✕`}
            selected
            disabled={ids.length <= 1}
            onPress={() => change(id, false)}
          />
        ))}
        {others.length ? <Chip label={adding ? 'Fertig' : '+ Schüler'} onPress={() => setAdding((v) => !v)} /> : null}
      </View>
      {adding ? (
        <View style={styles.chips}>
          {others.map((s) => (
            <Chip key={s.id} label={`${s.firstname} ${s.lastname.charAt(0)}.`} onPress={() => change(s.id, true)} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  label: { fontSize: font.size.sm, fontWeight: font.weight.medium, color: colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
