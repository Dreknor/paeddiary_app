import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { DiaryEntry } from '@/api/types';
import { formatDate } from '@/lib/dates';
import { colors, font, radius, shadow, spacing } from '@/theme';

export function DiaryEntryRow({ entry, numberOfLines }: { entry: DiaryEntry; numberOfLines?: number }) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/eintrag/[id]', params: { id: String(entry.id) } })}
      style={({ pressed }) => [styles.entry, pressed && { opacity: 0.8 }]}
      accessibilityRole="button"
    >
      <View style={[styles.bar, { backgroundColor: entry.category_color || colors.border }]} />
      <View style={styles.body}>
        <View style={styles.metaRow}>
          <Text style={styles.meta} numberOfLines={1}>
            {formatDate(entry.entry_date)}
            {entry.category_name ? ` · ${entry.category_name}` : ''} · {entry.created_by_name}
          </Text>
          {entry.is_dossier_only ? <Text style={styles.tag}>🔒 vertraulich</Text> : null}
          {!entry.is_completed ? <Text style={[styles.tag, styles.openTag]}>offen</Text> : null}
          {entry.schueler_ids.length > 1 ? <Text style={styles.tag}>Gruppe ({entry.schueler_ids.length})</Text> : null}
        </View>
        <Text style={styles.text} numberOfLines={numberOfLines}>
          {entry.content}
        </Text>
      </View>
    </Pressable>
  );
}

/** Noch nicht übertragener Eintrag aus der Warteschlange. */
export function PendingEntryRow({
  preview,
  date,
  failed,
  error,
}: {
  preview: string;
  date?: string;
  failed: boolean;
  error?: string;
}) {
  return (
    <View style={[styles.entry, styles.pending]}>
      <View style={[styles.bar, { backgroundColor: failed ? colors.danger : colors.warning }]} />
      <View style={styles.body}>
        <Text style={[styles.meta, failed && { color: colors.danger }]}>
          {date ? `${formatDate(date)} · ` : ''}
          {failed ? `⚠ Nicht gespeichert: ${error ?? ''}` : '⟳ wird übertragen …'}
        </Text>
        <Text style={styles.text} numberOfLines={3}>
          {preview}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  entry: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: 'hidden',
    ...shadow,
  },
  pending: { opacity: 0.85 },
  bar: { width: 5 },
  body: { flex: 1, padding: spacing.md, gap: spacing.xs },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  meta: { fontSize: font.size.xs, color: colors.textMuted, flexShrink: 1 },
  tag: {
    fontSize: font.size.xs,
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  openTag: { color: colors.warning, backgroundColor: colors.warningSoft },
  text: { fontSize: font.size.md, color: colors.text, lineHeight: 22 },
});
