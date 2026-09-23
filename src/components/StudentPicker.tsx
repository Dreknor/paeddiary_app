import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useStudentsOfClasses } from '@/api/queries';
import { colors, font, radius, spacing } from '@/theme';

import { Chip } from './controls';

export type PickedStudent = { id: number; name: string };

type Props = {
  selected: PickedStudent[];
  onChange: (students: PickedStudent[]) => void;
  /** Klassen, aus denen weitere Schüler hinzugefügt werden können. */
  classIds: number[];
};

/** Ausgewählte Schüler als Chips; „+ Schüler“ klappt die Klassenliste zum Hinzufügen auf. */
export function StudentPicker({ selected, onChange, classIds }: Props) {
  const [open, setOpen] = useState(selected.length === 0);
  const { students } = useStudentsOfClasses(open ? classIds : []);
  const selectedIds = new Set(selected.map((s) => s.id));

  const toggle = (s: PickedStudent) =>
    onChange(selectedIds.has(s.id) ? selected.filter((x) => x.id !== s.id) : [...selected, s]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        {selected.length === 0 ? 'Schüler auswählen' : selected.length === 1 ? 'Schüler' : `${selected.length} Schüler`}
      </Text>
      <View style={styles.chips}>
        {selected.map((s) => (
          <Pressable
            key={s.id}
            onPress={() => selected.length > 1 && toggle(s)}
            style={styles.selected}
            accessibilityRole="button"
            accessibilityLabel={selected.length > 1 ? `${s.name} entfernen` : s.name}
          >
            <Text style={styles.selectedText}>{s.name}</Text>
            {selected.length > 1 ? <Text style={styles.remove}>×</Text> : null}
          </Pressable>
        ))}
        {classIds.length ? <Chip label={open ? 'Fertig' : '+ Schüler'} onPress={() => setOpen((o) => !o)} /> : null}
      </View>

      {open ? (
        <View style={styles.list}>
          {students.map((s) => {
            const name = `${s.firstname} ${s.lastname.charAt(0)}.`;
            return (
              <Chip
                key={s.id}
                label={name}
                selected={selectedIds.has(s.id)}
                onPress={() => toggle({ id: s.id, name })}
              />
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  label: { fontSize: font.size.sm, fontWeight: font.weight.medium, color: colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  selected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  selectedText: { color: colors.primary, fontSize: font.size.sm, fontWeight: font.weight.semibold },
  remove: { color: colors.primary, fontSize: font.size.lg, lineHeight: 20 },
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.divider,
  },
});
