import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { useClasses, useStudentsOfClasses } from '@/api/queries';
import { useAuth } from '@/auth/AuthContext';
import { Fab, LinkButton } from '@/components/controls';
import { StudentGrid } from '@/components/StudentGrid';
import { openNewEntry, openNewNote, openWeek, showClassMenu, showSelectionMenu } from '@/lib/navigation';
import { parseIdList } from '@/lib/params';
import { spacing } from '@/theme';

/**
 * Jahrgangsgemischte Lerngruppe = zusammengeführte Schülerlisten ihrer Klassen.
 * Gruppeneinträge gehen klassenübergreifend (die API legt je Klasse einen Eintrag an);
 * Gruppen-Graduierungen sind laut Datenmodell nur je Klasse möglich.
 */
export default function LearningGroupScreen() {
  const { id, name, classIds } = useLocalSearchParams<{ id: string; name?: string; classIds?: string }>();
  const ids = useMemo(() => parseIdList(classIds), [classIds]);
  const { students, isLoading, isRefetching, error, refetch } = useStudentsOfClasses(ids);
  const { user } = useAuth();
  const { data: classes } = useClasses();
  const groupClasses = ids.map((cid) => ({
    id: cid,
    name: classes?.data.find((c) => c.id === cid)?.name ?? `Klasse ${cid}`,
  }));

  return (
    <View style={styles.flex}>
      <Stack.Screen
        options={{
          title: name ?? 'Lerngruppe',
          headerRight: () => (
            <View style={styles.headerButtons}>
              <LinkButton label="Woche" onPress={() => openWeek({ groupId: Number(id) }, name)} />
              <LinkButton
                label="Mehr"
                onPress={() =>
                  showClassMenu({
                    title: name ?? 'Lerngruppe',
                    classes: groupClasses,
                    canViewDiagnostics: !!user?.permissions.view_diagnostics,
                  })
                }
              />
            </View>
          ),
        }}
      />
      <StudentGrid
        students={students}
        isLoading={isLoading}
        isRefetching={isRefetching}
        error={error}
        onRefresh={refetch}
        fab={<Fab label="Eintrag" onPress={() => openNewEntry([], ids)} />}
        selectionActions={[
          { label: 'Eintrag', primary: true, onPress: (selected) => openNewEntry(selected, ids) },
          { label: 'Notiz', onPress: (selected) => openNewNote(selected, ids) },
          {
            label: 'Mehr …',
            onPress: (selected) => showSelectionMenu(selected, { classIds: ids, groupId: Number(id) }),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerButtons: { flexDirection: 'row', gap: spacing.lg },
});
