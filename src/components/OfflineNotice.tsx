import { StyleSheet, Text, View } from 'react-native';

import { useIsOnline } from '@/sync/queryPersistence';
import { colors, font, radius, spacing } from '@/theme';

/** Hinweis im Offline-Betrieb: gespeicherter Stand wird angezeigt, Änderungen gehen später raus. */
export function OfflineNotice({ missing }: { missing?: boolean }) {
  const online = useIsOnline();
  if (online) return null;
  return (
    <View style={styles.box} accessibilityRole="alert">
      <Text style={styles.text}>
        {missing
          ? 'Offline – dafür ist auf diesem Gerät noch nichts gespeichert. Öffne es einmal mit Netz.'
          : 'Offline – du siehst den zuletzt gespeicherten Stand. Änderungen werden später übertragen.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.warningSoft, borderRadius: radius.md, padding: spacing.md },
  text: { color: colors.warning, fontSize: font.size.sm, fontWeight: font.weight.medium },
});
