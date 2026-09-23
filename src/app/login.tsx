import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { SchoolLogo } from '@/components/SchoolLogo';
import { Button, ErrorBox, TextField } from '@/components/ui';
import { serverLabel } from '@/lib/server';
import { colors, font, spacing } from '@/theme';

export default function LoginScreen() {
  const { server, signInPassword, signInSso, forgetServer } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'password' | 'sso' | null>(null);
  const [error, setError] = useState<ApiError | Error | null>(null);

  if (!server) return null;
  const { instance } = server;

  async function run(kind: 'password' | 'sso', action: () => Promise<unknown>) {
    setBusy(kind);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Anmeldung fehlgeschlagen.'));
    } finally {
      setBusy(null);
    }
  }

  function changeSchool() {
    Alert.alert('Andere Schule wählen?', `Die Verbindung zu ${instance.name} wird getrennt.`, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Schule wechseln', style: 'destructive', onPress: () => void forgetServer() },
    ]);
  }

  const apiError = error instanceof ApiError ? error : null;
  const generalError =
    error && !(apiError && apiError.status === 422 && Object.keys(apiError.errors).length) ? error.message : null;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.header}>
              <SchoolLogo size={96} />
              <Text style={styles.title}>{instance.name}</Text>
              <Text style={styles.subtitle}>Pädagogisches Tagebuch · Diagnose · Graduierung</Text>
            </View>

            {generalError ? <ErrorBox message={generalError} /> : null}

            {instance.auth.sso ? (
              <Button
                title={instance.auth.sso_label || 'Mit Schulkonto anmelden'}
                onPress={() => run('sso', signInSso)}
                loading={busy === 'sso'}
                disabled={busy !== null}
              />
            ) : null}

            {instance.auth.sso && instance.auth.password ? (
              <View style={styles.divider}>
                <View style={styles.line} />
                <Text style={styles.dividerText}>oder mit Passwort</Text>
                <View style={styles.line} />
              </View>
            ) : null}

            {instance.auth.password ? (
              <View style={styles.form}>
                <TextField
                  label="E-Mail"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="username"
                  autoComplete="email"
                  error={apiError?.fieldError('email')}
                />
                <TextField
                  label="Passwort"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  textContentType="password"
                  autoComplete="current-password"
                  returnKeyType="go"
                  onSubmitEditing={() => run('password', () => signInPassword(email.trim(), password))}
                  error={apiError?.fieldError('password')}
                />
                <Button
                  title="Anmelden"
                  variant={instance.auth.sso ? 'secondary' : 'primary'}
                  onPress={() => run('password', () => signInPassword(email.trim(), password))}
                  loading={busy === 'password'}
                  disabled={busy !== null || !email.trim() || !password}
                />
              </View>
            ) : null}

            <Button title="Ich bin Schüler/in" variant="ghost" onPress={() => router.push('/schueler-modus')} />

            <View style={styles.footer}>
              <Text style={styles.server}>{serverLabel(server.url)}</Text>
              <Button title="Andere Schule wählen" variant="ghost" onPress={changeSchool} />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  subtitle: { fontSize: font.size.sm, color: colors.textMuted, textAlign: 'center' },
  form: { gap: spacing.md },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  dividerText: { fontSize: font.size.sm, color: colors.textSubtle },
  footer: { alignItems: 'center', marginTop: spacing.lg },
  server: { fontSize: font.size.xs, color: colors.textSubtle },
});
