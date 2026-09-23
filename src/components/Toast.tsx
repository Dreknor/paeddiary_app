import { useEffect, useState, useSyncExternalStore } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, font, radius, spacing } from '@/theme';

type ToastKind = 'success' | 'info' | 'error';
type ToastState = { id: number; message: string; kind: ToastKind } | null;

let current: ToastState = null;
let counter = 0;
const listeners = new Set<() => void>();

/** Kurze Rückmeldung am unteren Rand, z. B. „Gespeichert“ oder „Offline gespeichert“. */
export function showToast(message: string, kind: ToastKind = 'success') {
  current = { id: ++counter, message, kind };
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function ToastHost() {
  const toast = useSyncExternalStore(subscribe, () => current);
  const insets = useSafeAreaInsets();
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!toast) return;
    opacity.setValue(0);
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.delay(toast.kind === 'error' ? 4000 : 2200),
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [toast, opacity]);

  if (!toast) return null;
  const background = toast.kind === 'error' ? colors.danger : toast.kind === 'info' ? colors.warning : colors.success;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.toast, { bottom: insets.bottom + 96, opacity, backgroundColor: background }]}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <Text style={styles.text}>{toast.message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: 480,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  text: { color: colors.onPrimary, fontSize: font.size.md, fontWeight: font.weight.medium, textAlign: 'center' },
});
