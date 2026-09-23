import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, font, radius, spacing } from '@/theme';

import { Button } from './ui';

/** Vollbild-QR-Scanner. Liefert den ersten gelesenen Inhalt und schließt sich. */
export function QrScanner({
  visible,
  onScanned,
  onClose,
  hint,
}: {
  visible: boolean;
  onScanned: (data: string) => void;
  onClose: () => void;
  hint?: string;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const handled = useRef(false);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} onShow={() => (handled.current = false)}>
      <SafeAreaView style={styles.safe}>
        {!permission ? null : !permission.granted ? (
          <View style={styles.center}>
            <Text style={styles.text}>Für das Scannen wird die Kamera benötigt.</Text>
            <Button title="Kamera erlauben" onPress={requestPermission} />
          </View>
        ) : (
          <View style={styles.flex}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={({ data }) => {
                if (handled.current) return;
                handled.current = true;
                onScanned(data);
              }}
            />
            <View style={styles.frame} pointerEvents="none" />
            {hint ? <Text style={styles.hint}>{hint}</Text> : null}
          </View>
        )}
        <View style={styles.footer}>
          <Button title="Abbrechen" variant="secondary" onPress={onClose} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  flex: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl },
  text: { color: '#fff', fontSize: font.size.md, textAlign: 'center' },
  frame: { width: 240, height: 240, borderWidth: 3, borderColor: '#fff', borderRadius: radius.lg },
  hint: {
    position: 'absolute',
    bottom: spacing.xl,
    color: '#fff',
    fontSize: font.size.md,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
  footer: { padding: spacing.lg, backgroundColor: colors.surface },
});
