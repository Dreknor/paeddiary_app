import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { SchoolLogo } from '@/components/SchoolLogo';
import { colors, font, spacing } from '@/theme';

/** Nach so langer Zeit im Hintergrund muss die App erneut entsperrt werden. */
const LOCK_AFTER_MS = 5 * 60 * 1000;

/**
 * Schützt den angemeldeten Bereich:
 * - Entsperren per Face ID / Touch ID / Fingerabdruck oder Geräte-Code beim Start
 *   und nach 5 Minuten im Hintergrund.
 * - Sichtschutz, sobald die App nicht aktiv ist (App-Umschalter zeigt keine Schülerdaten).
 */
export function AppLock({ children }: { children: ReactNode }) {
  const [locked, setLocked] = useState(true);
  const [covered, setCovered] = useState(false);
  const [noDeviceSecurity, setNoDeviceSecurity] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const backgroundSince = useRef<number | null>(null);
  const authenticating = useRef(false);

  const unlock = useCallback(async () => {
    if (authenticating.current) return;
    authenticating.current = true;
    setError(null);
    try {
      const level = await LocalAuthentication.getEnrolledLevelAsync();
      if (level === LocalAuthentication.SecurityLevel.NONE) {
        // Gerät ohne Code/Biometrie (z. B. Emulator): nicht aussperren, aber deutlich warnen.
        setNoDeviceSecurity(true);
        setLocked(false);
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Päd. Tagebuch entsperren',
        cancelLabel: 'Abbrechen',
      });
      if (result.success) setLocked(false);
      else if (result.error !== 'user_cancel' && result.error !== 'system_cancel') {
        setError('Entsperren fehlgeschlagen. Bitte erneut versuchen.');
      }
    } finally {
      authenticating.current = false;
    }
  }, []);

  useEffect(() => {
    void unlock();
  }, [unlock]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setCovered(false);
        const since = backgroundSince.current;
        backgroundSince.current = null;
        if (since && Date.now() - since > LOCK_AFTER_MS && !noDeviceSecurity) {
          setLocked(true);
          void unlock();
        }
      } else {
        setCovered(true);
        backgroundSince.current ??= Date.now();
      }
    });
    return () => sub.remove();
  }, [unlock, noDeviceSecurity]);

  if (locked || covered) {
    return (
      <View style={styles.cover}>
        <SchoolLogo size={96} />
        <Text style={styles.title}>Päd. Tagebuch</Text>
        {locked && !covered ? (
          <>
            <Text style={styles.hint}>Die App ist gesperrt, um Schülerdaten zu schützen.</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button title="Entsperren" onPress={unlock} style={styles.button} />
          </>
        ) : null}
      </View>
    );
  }

  return (
    <>
      {noDeviceSecurity ? (
        <View style={styles.warning}>
          <Text style={styles.warningText}>
            Auf diesem Gerät ist keine Displaysperre eingerichtet. Bitte richte einen Gerätecode ein.
          </Text>
        </View>
      ) : null}
      {children}
    </>
  );
}

const styles = StyleSheet.create({
  cover: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: { fontSize: font.size.xl, fontWeight: font.weight.bold, color: colors.primary },
  hint: { fontSize: font.size.md, color: colors.textMuted, textAlign: 'center' },
  error: { fontSize: font.size.sm, color: colors.danger, textAlign: 'center' },
  button: { marginTop: spacing.lg, minWidth: 220 },
  warning: { backgroundColor: colors.warningSoft, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  warningText: { color: colors.warning, fontSize: font.size.sm, textAlign: 'center' },
});
