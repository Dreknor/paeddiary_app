import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';

import { colors, font, radius, spacing } from '@/theme';

/**
 * Diktieren per Spracherkennung – ausschließlich auf dem Gerät (keine Cloud).
 * Benötigt einen Development-/Store-Build; in Expo Go fehlt das native Modul,
 * dann wird der Knopf nicht angezeigt. Ebenso auf Geräten ohne On-Device-Erkennung.
 */

type SpeechModule = typeof import('expo-speech-recognition').ExpoSpeechRecognitionModule;

let speech: SpeechModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  speech = require('expo-speech-recognition').ExpoSpeechRecognitionModule as SpeechModule;
  if (!speech?.isRecognitionAvailable?.()) speech = null;
} catch {
  speech = null;
}

export const dictationAvailable = () => !!speech && speech.supportsOnDeviceRecognition();

type Props = {
  /** Wird mit dem erkannten Text aufgerufen (Zwischenergebnisse ersetzen den vorherigen Teil). */
  onText: (text: string, isFinal: boolean) => void;
  onListeningChange?: (listening: boolean) => void;
};

export function DictationButton({ onText, onListeningChange }: Props) {
  const [listening, setListening] = useState(false);
  const onTextRef = useRef(onText);
  useEffect(() => {
    onTextRef.current = onText;
  });

  useEffect(() => {
    if (!speech) return;
    const subs = [
      speech.addListener('start', () => setListening(true)),
      speech.addListener('end', () => setListening(false)),
      speech.addListener('result', (e) => onTextRef.current(e.results[0]?.transcript ?? '', e.isFinal)),
      speech.addListener('error', (e) => {
        setListening(false);
        if (e.error === 'not-allowed') {
          Alert.alert('Kein Zugriff', 'Bitte erlaube Mikrofon und Spracherkennung in den Einstellungen.');
        } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
          Alert.alert('Diktieren nicht möglich', e.message);
        }
      }),
    ];
    return () => {
      subs.forEach((s) => s.remove());
      speech?.abort();
    };
  }, []);

  useEffect(() => onListeningChange?.(listening), [listening, onListeningChange]);

  if (!dictationAvailable()) return null;

  async function toggle() {
    if (!speech) return;
    if (listening) {
      speech.stop();
      return;
    }
    const permission = await speech.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Kein Zugriff', 'Bitte erlaube Mikrofon und Spracherkennung in den Einstellungen.');
      return;
    }
    speech.start({
      lang: 'de-DE',
      interimResults: true,
      continuous: true,
      addsPunctuation: true,
      requiresOnDeviceRecognition: true,
    });
  }

  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="button"
      accessibilityLabel={listening ? 'Diktieren beenden' : 'Diktieren'}
      style={({ pressed }) => [styles.button, listening && styles.active, pressed && { opacity: 0.8 }]}
    >
      <Text style={[styles.icon, listening && styles.iconActive]}>{listening ? '■' : '🎙'}</Text>
      <Text style={[styles.label, listening && styles.iconActive]}>{listening ? 'Stopp' : 'Diktieren'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  active: { backgroundColor: colors.accent },
  icon: { fontSize: font.size.md, color: colors.primary },
  iconActive: { color: colors.onPrimary },
  label: { fontSize: font.size.sm, color: colors.primary, fontWeight: font.weight.semibold },
});
