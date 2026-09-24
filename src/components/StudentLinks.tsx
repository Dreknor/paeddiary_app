import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { StudentBrief } from '@/api/types';
import { colors, font, radius, spacing } from '@/theme';

/** Namen als Links zum Schülerprofil. */
export function StudentLinks({ students }: { students: StudentBrief[] }) {
  if (!students.length) return null;
  return (
    <View style={styles.names}>
      {students.map((s) => (
        <Pressable
          key={s.id}
          onPress={() =>
            router.push({
              pathname: '/schueler/[id]',
              params: { id: String(s.id), name: `${s.firstname} ${s.lastname}` },
            })
          }
          hitSlop={6}
          style={({ pressed }) => [styles.name, pressed && styles.pressed]}
          accessibilityRole="link"
        >
          <Text style={styles.nameText}>
            {s.firstname} {s.lastname.charAt(0)}.
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  names: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  name: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  nameText: { color: colors.primary, fontSize: font.size.sm, fontWeight: font.weight.medium },
});
