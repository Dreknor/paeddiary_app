import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { useStudentsOfClasses } from '@/api/queries';
import { Fab } from '@/components/controls';
import { StudentGrid } from '@/components/StudentGrid';
import { openNewEntry } from '@/lib/navigation';
import { parseIdList } from '@/lib/params';

/**
 * Jahrgangsgemischte Lerngruppe = zusammengeführte Schülerlisten ihrer Klassen.
 * Gruppeneinträge gehen klassenübergreifend (die API legt je Klasse einen Eintrag an);
 * Gruppen-Graduierungen sind laut Datenmodell nur je Klasse möglich.
 */
export default function LearningGroupScreen() {
  const { name, classIds } = useLocalSearchParams<{ id: string; name?: string; classIds?: string }>();
  const ids = useMemo(() => parseIdList(classIds), [classIds]);
  const { students, isLoading, isRefetching, error, refetch } = useStudentsOfClasses(ids);

  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ title: name ?? 'Lerngruppe' }} />
      <StudentGrid
        students={students}
        isLoading={isLoading}
        isRefetching={isRefetching}
        error={error}
        onRefresh={refetch}
        selectionActions={[{ label: 'Eintrag', primary: true, onPress: (selected) => openNewEntry(selected, ids) }]}
      />
      <Fab label="Eintrag" onPress={() => openNewEntry([], ids)} />
    </View>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
