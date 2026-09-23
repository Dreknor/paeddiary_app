import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthContext';
import { QrScanner } from '@/components/QrScanner';
import { Button, ErrorBox, TextField } from '@/components/ui';
import { normalizeServerUrl } from '@/lib/server';
import { joinStudentSession, loadStudentSession, parseJoinPayload } from '@/student/studentSession';
import { colors, font, spacing } from '@/theme';

/** Schüler-iPad: Beitritt zu einer Selbsteinschätzung per QR-Code oder Code. */
export default function StudentJoinScreen() {
  const params = useLocalSearchParams<{ server?: string; code?: string }>();
  const { server } = useAuth();
  const [serverInput, setServerInput] = useState(params.server ?? server?.url ?? '');
  const [code, setCode] = useState(params.code ?? '');
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = useCallback(async (serverValue: string, codeValue: string) => {
    const url = normalizeServerUrl(serverValue);
    if (!url) {
      setError('Bitte die Adresse der Schule eingeben.');
      return;
    }
    if (codeValue.replace(/[^a-z0-9]/gi, '').length < 6) {
      setError('Der Code hat 6 Zeichen.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await joinStudentSession(url, codeValue);
      router.replace('/schueler-modus/bewertung');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Beitritt nicht möglich.');
    } finally {
      setBusy(false);
    }
  }, []);

  // Laufende Sitzung fortsetzen bzw. Deep Link mit Code direkt einlösen.
  useEffect(() => {
    loadStudentSession().then((s) => {
      if (s) router.replace('/schueler-modus/bewertung');
      else if (params.server && params.code) void join(params.server, params.code);
    });
  }, [params.server, params.code, join]);

  function onScanned(data: string) {
    setScanning(false);
    const payload = parseJoinPayload(data);
    if (!payload) {
      setError('Das ist kein Beitritts-Code für die Selbsteinschätzung.');
      return;
    }
    setServerInput(payload.server);
    setCode(payload.code);
    void join(payload.server, payload.code);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.emoji}>🙋</Text>
            <Text style={styles.title}>Selbsteinschätzung</Text>
            <Text style={styles.subtitle}>Scanne den QR-Code, den dir deine Lehrkraft gibt.</Text>

            <Button title="QR-Code scannen" onPress={() => setScanning(true)} loading={busy} style={styles.big} />

            <Text style={styles.or}>oder Code eintippen</Text>
            <TextField
              label="Code"
              value={code}
              onChangeText={(t) => setCode(t.toUpperCase())}
              placeholder="K7M-4QX"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={7}
              style={styles.codeInput}
            />
            {!server ? (
              <TextField
                label="Adresse der Schule"
                value={serverInput}
                onChangeText={setServerInput}
                placeholder="mitarbeiter.meine-schule.de"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            ) : null}
            {error ? <ErrorBox message={error} /> : null}
            <Button title="Los geht's" variant="secondary" onPress={() => join(serverInput, code)} loading={busy} />
            <Button
              title="Zurück"
              variant="ghost"
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <QrScanner
        visible={scanning}
        onScanned={onScanned}
        onClose={() => setScanning(false)}
        hint="QR-Code in den Rahmen halten"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFDF7' },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
  card: { width: '100%', maxWidth: 440, alignSelf: 'center', gap: spacing.lg },
  emoji: { fontSize: 64, textAlign: 'center' },
  title: { fontSize: 30, fontWeight: font.weight.bold, color: colors.primary, textAlign: 'center' },
  subtitle: { fontSize: font.size.lg, color: colors.textMuted, textAlign: 'center' },
  big: { minHeight: 64 },
  or: { textAlign: 'center', color: colors.textSubtle, fontSize: font.size.sm },
  codeInput: { fontSize: 28, letterSpacing: 4, textAlign: 'center', minHeight: 60 },
});
