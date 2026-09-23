import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchInstance } from '@/api/endpoints';
import { useAuth } from '@/auth/AuthContext';
import { QrScanner } from '@/components/QrScanner';
import { SchoolLogo } from '@/components/SchoolLogo';
import { Button, ErrorBox, TextField } from '@/components/ui';
import { normalizeServerUrl } from '@/lib/server';
import { colors, font, spacing } from '@/theme';

/** Erster Start: Mit dem Server der eigenen Schule verbinden. */
export default function ServerScreen() {
  const { selectServer } = useAuth();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  function onScanned(data: string) {
    setScanning(false);
    // QR aus dem Web-Profil: paeddiary://connect?server=https://…
    const match = /^paeddiary:\/\/connect\?(?:.*&)?server=([^&]+)/i.exec(data.trim());
    const server = match ? decodeURIComponent(match[1]) : /^https?:\/\//i.test(data.trim()) ? data.trim() : null;
    if (!server) {
      setError('Dieser QR-Code gehört nicht zur App.');
      return;
    }
    setInput(server);
    void connect(server);
  }

  async function connect(value = input) {
    const url = normalizeServerUrl(value);
    if (!url) {
      setError('Bitte gib eine gültige Adresse ein, z. B. mitarbeiter.meine-schule.de');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const instance = await fetchInstance(url);
      await selectServer(url, instance);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verbindung fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.header}>
              <SchoolLogo size={88} />
              <Text style={styles.title}>Mit deiner Schule verbinden</Text>
              <Text style={styles.subtitle}>
                Gib die Adresse ein, unter der du das Mitarbeiterboard im Browser öffnest.
              </Text>
            </View>

            <TextField
              label="Adresse der Schule"
              placeholder="mitarbeiter.meine-schule.de"
              value={input}
              onChangeText={setInput}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              textContentType="URL"
              returnKeyType="go"
              onSubmitEditing={() => connect()}
            />
            {error ? <ErrorBox message={error} /> : null}
            <Button title="Verbinden" onPress={() => connect()} loading={busy} disabled={!input.trim()} />
            <Button title="QR-Code scannen" variant="secondary" onPress={() => setScanning(true)} />

            <Button title="Ich bin Schüler/in" variant="ghost" onPress={() => router.push('/schueler-modus')} />

            <Text style={styles.hint}>
              Tipp: Im Mitarbeiterboard findest du im Profil unter „App“ einen QR-Code zum Verbinden.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <QrScanner
        visible={scanning}
        onScanned={onScanned}
        onClose={() => setScanning(false)}
        hint="QR-Code aus dem Profil scannen"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
  card: { width: '100%', maxWidth: 440, alignSelf: 'center', gap: spacing.lg },
  header: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  title: { fontSize: font.size.xl, fontWeight: font.weight.bold, color: colors.primary, textAlign: 'center' },
  subtitle: { fontSize: font.size.md, color: colors.textMuted, textAlign: 'center' },
  hint: { fontSize: font.size.sm, color: colors.textMuted, textAlign: 'center', marginTop: spacing.md },
});
