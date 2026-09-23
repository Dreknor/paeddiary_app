import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { Stack } from 'expo-router';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { deleteDevice } from '@/api/endpoints';
import { queryKeys, useDevices } from '@/api/queries';
import { useAuth } from '@/auth/AuthContext';
import { Card, LinkButton, SectionTitle } from '@/components/controls';
import { dictationAvailable } from '@/components/DictationButton';
import { Button, ErrorBox } from '@/components/ui';
import { formatDateTime } from '@/lib/dates';
import { serverLabel } from '@/lib/server';
import { discardOutboxItem, flushOutbox, retryOutboxItem, useOutbox } from '@/sync/outbox';
import { colors, font, spacing } from '@/theme';

export default function SettingsScreen() {
  const { user, server, signOut } = useAuth();
  const queryClient = useQueryClient();
  const devices = useDevices();
  const outbox = useOutbox().filter((i) => i.userId === user?.id);

  function confirmSignOut() {
    const pending = outbox.length;
    Alert.alert(
      'Abmelden?',
      pending
        ? `${pending} Änderung(en) wurden noch nicht übertragen und gehen beim Abmelden verloren.`
        : 'Zwischengespeicherte Daten werden von diesem Gerät gelöscht.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Abmelden', style: 'destructive', onPress: () => void signOut() },
      ],
    );
  }

  function removeDevice(id: number, name: string) {
    Alert.alert('Gerät abmelden?', `„${name}“ wird abgemeldet und muss sich neu anmelden.`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Abmelden',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDevice(id);
            void queryClient.invalidateQueries({ queryKey: queryKeys.devices });
          } catch (e) {
            Alert.alert('Fehler', e instanceof Error ? e.message : String(e));
          }
        },
      },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Einstellungen' }} />

      <Card>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.muted}>{user?.email}</Text>
        <Text style={styles.muted}>
          {server?.instance.name} · {server ? serverLabel(server.url) : ''}
        </Text>
        <View style={styles.perms}>
          {user?.permissions.view_diagnostics ? <Text style={styles.perm}>Diagnose</Text> : null}
          {user?.permissions.manage_grading ? <Text style={styles.perm}>Stufenvergabe</Text> : null}
          {user?.permissions.view_all_students ? <Text style={styles.perm}>Alle Schüler</Text> : null}
          {user?.permissions.view_confidential_entries ? <Text style={styles.perm}>Vertrauliche Einträge</Text> : null}
        </View>
      </Card>

      <SectionTitle
        action={outbox.length ? <LinkButton label="Jetzt senden" onPress={() => void flushOutbox()} /> : undefined}
      >
        Nicht übertragen ({outbox.length})
      </SectionTitle>
      {outbox.length ? (
        outbox.map((item) => (
          <Card key={item.id}>
            <Text style={styles.item}>{item.label}</Text>
            <Text style={[styles.muted, item.status === 'failed' && { color: colors.danger }]}>
              {formatDateTime(item.createdAt)} ·{' '}
              {item.status === 'failed' ? `Fehler: ${item.error}` : `wartet auf Netz (${item.attempts} Versuche)`}
            </Text>
            {item.meta?.preview ? (
              <Text style={styles.preview} numberOfLines={2}>
                {String(item.meta.preview)}
              </Text>
            ) : null}
            <View style={styles.actions}>
              {item.status === 'failed' ? (
                <LinkButton label="Erneut versuchen" onPress={() => retryOutboxItem(item.id)} />
              ) : null}
              <LinkButton
                label="Verwerfen"
                onPress={() =>
                  Alert.alert('Änderung verwerfen?', 'Sie wird nicht mehr übertragen.', [
                    { text: 'Abbrechen', style: 'cancel' },
                    { text: 'Verwerfen', style: 'destructive', onPress: () => discardOutboxItem(item.id) },
                  ])
                }
              />
            </View>
          </Card>
        ))
      ) : (
        <Text style={styles.muted}>Alles ist mit dem Server abgeglichen.</Text>
      )}

      <SectionTitle>Meine Geräte</SectionTitle>
      {devices.error ? <ErrorBox message={devices.error.message} onRetry={devices.refetch} /> : null}
      {devices.data?.map((d) => (
        <Card key={d.id}>
          <Text style={styles.item}>
            {d.device_name}
            {d.is_current ? ' (dieses Gerät)' : ''}
          </Text>
          <Text style={styles.muted}>
            {d.last_used_at
              ? `zuletzt aktiv ${formatDateTime(d.last_used_at)}`
              : `angemeldet ${formatDateTime(d.created_at)}`}
            {d.expires_at ? ` · läuft ab ${formatDateTime(d.expires_at)}` : ''}
          </Text>
          {!d.is_current ? <LinkButton label="Abmelden" onPress={() => removeDevice(d.id, d.device_name)} /> : null}
        </Card>
      ))}

      <SectionTitle>Über die App</SectionTitle>
      <Card>
        <Text style={styles.muted}>Version {Constants.expoConfig?.version ?? '–'}</Text>
        <Text style={styles.muted}>
          Diktieren: {dictationAvailable() ? 'verfügbar (auf dem Gerät)' : 'auf diesem Gerät nicht verfügbar'}
        </Text>
        <Text style={styles.muted}>Daten werden verschlüsselt zwischengespeichert und beim Abmelden gelöscht.</Text>
      </Card>

      <Button title="Abmelden" variant="secondary" onPress={confirmSignOut} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingBottom: 60,
  },
  name: { fontSize: font.size.lg, fontWeight: font.weight.bold, color: colors.text },
  muted: { fontSize: font.size.sm, color: colors.textMuted },
  perms: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  perm: {
    fontSize: font.size.xs,
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  item: { fontSize: font.size.md, fontWeight: font.weight.semibold, color: colors.text },
  preview: { fontSize: font.size.sm, color: colors.text },
  actions: { flexDirection: 'row', gap: spacing.lg },
});
