import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { useDiagnosticAreas, useDiagnosticHistory } from '@/api/queries';
import { Card } from '@/components/controls';
import { DiagnosisEditor } from '@/components/diagnostic/DiagnosisEditor';
import { Button, EmptyState, ErrorBox, Loading } from '@/components/ui';
import { colors, font, spacing } from '@/theme';

/** Diagnose erfassen: zuerst Bereich wählen (offene Sitzungen hervorgehoben), dann bewerten. */
export default function DiagnosisScreen() {
  const params = useLocalSearchParams<{ studentId: string; name?: string; areaId?: string }>();
  const studentId = Number(params.studentId);
  const areas = useDiagnosticAreas();
  const history = useDiagnosticHistory(studentId);
  const [areaId, setAreaId] = useState<number | null>(params.areaId ? Number(params.areaId) : null);

  if (areas.isLoading || history.isLoading) return <Loading />;
  if (areas.error || history.error) {
    const error = areas.error ?? history.error;
    return (
      <ErrorBox
        message={error?.message ?? 'Fehler'}
        onRetry={() => (areas.error ? areas.refetch() : history.refetch())}
      />
    );
  }
  if (!areas.data?.length || !history.data) return <EmptyState title="Es sind keine Diagnosebereiche hinterlegt." />;

  const area = areas.data.find((a) => a.id === areaId);
  if (area) {
    return (
      <DiagnosisEditor
        key={area.id}
        studentId={studentId}
        area={area}
        history={history.data}
        onChangeArea={() => setAreaId(null)}
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: `Diagnose · ${params.name ?? ''}` }} />
      <Text style={styles.heading}>Welchen Bereich möchtest du diagnostizieren?</Text>
      {[...areas.data]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((a) => {
          const open = history.data.sessions.some((s) => s.area_id === a.id && !s.is_completed);
          return (
            <Card key={a.id}>
              <Text style={styles.areaTitle}>{a.title}</Text>
              {a.description ? <Text style={styles.muted}>{a.description}</Text> : null}
              <Button
                title={open ? 'Offene Sitzung fortsetzen' : 'Auswählen'}
                variant={open ? 'primary' : 'secondary'}
                onPress={() => setAreaId(a.id)}
              />
            </Card>
          );
        })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, width: '100%', maxWidth: 760, alignSelf: 'center' },
  heading: { fontSize: font.size.lg, fontWeight: font.weight.semibold, color: colors.text },
  areaTitle: { fontSize: font.size.lg, fontWeight: font.weight.semibold, color: colors.text },
  muted: { fontSize: font.size.sm, color: colors.textMuted },
});
