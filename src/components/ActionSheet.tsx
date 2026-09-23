import { useSyncExternalStore } from 'react';
import { Modal, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, font, radius, spacing, touchTarget } from '@/theme';

/**
 * Auswahlmenü mit beliebig vielen Optionen (Android-`Alert` erlaubt nur drei Knöpfe).
 * Aufruf: `showActionSheet({ title, options: [{ label, onPress, destructive }] })`.
 */

export type ActionOption = { label: string; onPress: () => void; destructive?: boolean };
type SheetState = { title?: string; message?: string; options: ActionOption[] } | null;

let state: SheetState = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function showActionSheet(next: NonNullable<SheetState>) {
  state = next;
  emit();
}

function close() {
  state = null;
  emit();
}

export function ActionSheetHost() {
  const sheet = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={!!sheet} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Schließen">
        <Pressable style={[styles.sheet, { paddingBottom: spacing.lg + insets.bottom }]} onPress={() => undefined}>
          {sheet?.title ? <Text style={styles.title}>{sheet.title}</Text> : null}
          {sheet?.message ? <Text style={styles.message}>{sheet.message}</Text> : null}
          {sheet?.options.map((o) => (
            <Pressable
              key={o.label}
              style={({ pressed }) => [styles.option, pressed && { backgroundColor: colors.divider }]}
              accessibilityRole="button"
              onPress={() => {
                close();
                o.onPress();
              }}
            >
              <Text style={[styles.optionText, o.destructive && { color: colors.danger }]}>{o.label}</Text>
            </Pressable>
          ))}
          <Pressable style={[styles.option, styles.cancel]} onPress={close} accessibilityRole="button">
            <Text style={[styles.optionText, styles.cancelText]}>Abbrechen</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  title: { fontSize: font.size.md, fontWeight: font.weight.semibold, color: colors.text, textAlign: 'center' },
  message: { fontSize: font.size.sm, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs },
  option: {
    minHeight: touchTarget + 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.md,
    marginTop: spacing.xs,
  },
  optionText: { fontSize: font.size.lg, color: colors.primary },
  cancel: { marginTop: spacing.md, backgroundColor: colors.divider },
  cancelText: { fontWeight: font.weight.semibold },
});
