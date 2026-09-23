import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { fetchDiaryEntry } from '@/api/endpoints';
import { deleteDiaryEntry, updateDiaryEntry } from '@/api/mutations';
import type { DiaryEntry } from '@/api/types';
import { EntryForm } from '@/components/diary/EntryForm';
import { showToast } from '@/components/Toast';
import { Button, ErrorBox, Loading } from '@/components/ui';
import { formatDateTime } from '@/lib/dates';
import { colors, font, spacing } from '@/theme';

/** Tagebucheintrag ansehen/bearbeiten. Fremde Einträge sind nur lesbar. */
export default function EditEntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const entryId = Number(id);
  const {
    data: entry,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['diary-entry', entryId],
    queryFn: () => fetchDiaryEntry(entryId),
    meta: { persist: false },
  });

  if (isLoading) return <Loading />;
  if (error || !entry) {
    return (
      <View style={styles.pad}>
        <ErrorBox message={error?.message ?? 'Eintrag nicht gefunden.'} onRetry={refetch} />
      </View>
    );
  }

  function handleConflict(e: unknown): never {
    if (e instanceof ApiError && e.status === 409) {
      const current = (e.body as { data?: DiaryEntry } | null)?.data;
      if (current) queryClient.setQueryData(['diary-entry', entryId], current);
      throw new Error(
        'Der Eintrag wurde inzwischen geändert. Die aktuelle Fassung ist jetzt geladen – bitte erneut bearbeiten.',
      );
    }
    throw e;
  }

  function confirmDelete(target: DiaryEntry) {
    Alert.alert('Eintrag löschen?', 'Der Eintrag wird für alle zugeordneten Schüler gelöscht.', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: async () => {
          try {
            const r = await deleteDiaryEntry(target);
            showToast(
              r.status === 'sent' ? 'Eintrag gelöscht' : 'Löschen wird übertragen, sobald Netz da ist',
              r.status === 'sent' ? 'success' : 'info',
            );
            router.back();
          } catch (e) {
            Alert.alert('Löschen fehlgeschlagen', e instanceof Error ? e.message : String(e));
          }
        },
      },
    ]);
  }

  const meta = (
    <Text style={styles.meta}>
      Von {entry.created_by_name} · erstellt {formatDateTime(entry.created_at)}
      {entry.updated_at !== entry.created_at ? ` · geändert ${formatDateTime(entry.updated_at)}` : ''}
    </Text>
  );

  if (!entry.is_own) {
    return (
      <>
        <Stack.Screen options={{ title: 'Eintrag' }} />
        <View style={styles.pad}>
          {meta}
          <Text style={styles.readonly}>{entry.content}</Text>
          <Text style={styles.hint}>Nur die Verfasserin bzw. der Verfasser kann diesen Eintrag ändern.</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Eintrag bearbeiten' }} />
      <EntryForm
        key={entry.updated_at}
        initial={{
          category_id: entry.category_id,
          entry_date: entry.entry_date,
          content: entry.content,
          is_dossier_only: entry.is_dossier_only,
          is_completed: entry.is_completed,
        }}
        header={meta}
        submitLabel="Änderungen speichern"
        onSubmit={async (values) => {
          const result = await updateDiaryEntry(entry, values).catch(handleConflict);
          showToast(
            result.status === 'sent' ? 'Gespeichert' : 'Offline gespeichert – wird übertragen',
            result.status === 'sent' ? 'success' : 'info',
          );
          router.back();
        }}
        footer={<Button title="Eintrag löschen" variant="ghost" onPress={() => confirmDelete(entry)} />}
      />
    </>
  );
}

const styles = StyleSheet.create({
  pad: { padding: spacing.lg, gap: spacing.lg, width: '100%', maxWidth: 760, alignSelf: 'center' },
  meta: { fontSize: font.size.xs, color: colors.textMuted },
  readonly: { fontSize: font.size.md, lineHeight: 24, color: colors.text },
  hint: { fontSize: font.size.sm, color: colors.textMuted },
});
