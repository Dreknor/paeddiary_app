import { useQueryClient } from '@tanstack/react-query';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { archiveGoal, updateGoal } from '@/api/mutations';
import { queryKeys } from '@/api/queries';
import type { DevelopmentGoalFull, GoalStatus } from '@/api/types';
import { showActionSheet } from '@/components/ActionSheet';
import { showToast } from '@/components/Toast';
import { formatDate, todayIso } from '@/lib/dates';
import { colors, font, radius, shadow, spacing } from '@/theme';

import { GOAL_STATUS } from './rating';

/** Entwicklungsziel mit Status; Tippen öffnet die Statusauswahl. */
export function GoalCard({ goal }: { goal: DevelopmentGoalFull }) {
  const queryClient = useQueryClient();
  const status = GOAL_STATUS[goal.status];
  const overdue = goal.is_active && goal.target_date && goal.target_date < todayIso();

  async function run(action: () => Promise<{ status: 'sent' | 'queued' }>, done: string) {
    try {
      const r = await action();
      showToast(
        r.status === 'sent' ? done : 'Offline gespeichert – wird übertragen',
        r.status === 'sent' ? 'success' : 'info',
      );
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.diagnosticHistory(goal.schueler_id) });
        Alert.alert(
          'Ziel wurde geändert',
          'Jemand hat das Ziel inzwischen bearbeitet. Die aktuelle Fassung wird geladen.',
        );
      } else {
        Alert.alert('Nicht gespeichert', e instanceof Error ? e.message : String(e));
      }
    }
  }

  const setStatus = (next: Exclude<GoalStatus, 'archived'>) =>
    run(() => updateGoal(goal, { status: next }), `Ziel: ${GOAL_STATUS[next].label}`);

  function openActions() {
    if (!goal.is_active && goal.status === 'archived') return;
    showActionSheet({
      title: goal.title,
      message: 'Status ändern',
      options: [
        { label: 'Erreicht ✓', onPress: () => setStatus('achieved') },
        { label: 'In Arbeit', onPress: () => setStatus('in_progress') },
        { label: 'Nicht erreicht', onPress: () => setStatus('not_achieved') },
        { label: 'Offen', onPress: () => setStatus('open') },
        { label: 'Archivieren', destructive: true, onPress: () => run(() => archiveGoal(goal), 'Ziel archiviert') },
      ],
    });
  }

  return (
    <Pressable
      onPress={openActions}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}
      accessibilityRole="button"
    >
      <View style={styles.row}>
        <Text style={[styles.status, { color: status.color, backgroundColor: status.background }]}>{status.label}</Text>
        {goal.area_title ? <Text style={styles.area}>{goal.area_title}</Text> : null}
      </View>
      <Text style={styles.title}>{goal.title}</Text>
      <Text style={[styles.meta, overdue ? styles.overdue : null]}>
        {goal.target_date
          ? `Ziel bis ${formatDate(goal.target_date)}${overdue ? ' (überfällig)' : ''}`
          : 'Ohne Zieldatum'}
        {goal.completed_at ? ` · abgeschlossen ${formatDate(goal.completed_at)}` : ''}
      </Text>
      {goal.completion_notes ? <Text style={styles.notes}>{goal.completion_notes}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs, ...shadow },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  status: {
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  area: { fontSize: font.size.xs, color: colors.textMuted },
  title: { fontSize: font.size.md, color: colors.text, fontWeight: font.weight.medium },
  meta: { fontSize: font.size.xs, color: colors.textMuted },
  overdue: { color: colors.danger },
  notes: { fontSize: font.size.sm, color: colors.textMuted, fontStyle: 'italic' },
});
