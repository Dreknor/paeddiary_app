import { router, Stack, useNavigation } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { saveDiagnosticSession } from '@/api/mutations';
import type { DiagnosticArea, DiagnosticHistory, DiagnosticRating } from '@/api/types';
import { BottomBar, Card, Chip, LinkButton } from '@/components/controls';
import { DateField } from '@/components/DateField';
import { showToast } from '@/components/Toast';
import { Button, EmptyState } from '@/components/ui';
import { addDays, addMonths, formatDate, todayIso } from '@/lib/dates';
import { colors, font, radius, spacing } from '@/theme';

import { CriterionRow } from './CriterionRow';
import { RATINGS } from './rating';

type CriterionState = { rating: DiagnosticRating | null; is_current_goal: boolean };
type NewGoal = { key: number; title: string; target_date: string | null; criterion_id: number | null };

type Props = {
  studentId: number;
  area: DiagnosticArea;
  history: DiagnosticHistory;
  /** Zurück zur Bereichsauswahl (nur ohne offene Sitzung/Änderungen). */
  onChangeArea: () => void;
};

/**
 * Diagnosesitzung eines Bereichs: Stufe → Kriterien mit Ampel, ⭐ aktuelle Ziele, Notiz, Entwicklungsziele.
 * Wird per `key={area.id}` neu aufgebaut; Anfangszustand stammt aus einer offenen Sitzung (auch aus dem Web).
 * Gesendet werden nur geänderte Kriterien – der Server führt die Bewertungen zusammen.
 */
export function DiagnosisEditor({ studentId, area, history, onChangeArea }: Props) {
  const navigation = useNavigation();
  const openSession = history.sessions.find((s) => s.area_id === area.id && !s.is_completed);
  const lastCompleted = history.sessions
    .filter((s) => s.area_id === area.id && s.is_completed)
    .sort((a, b) => b.session_date.localeCompare(a.session_date))[0];

  const stages = useMemo(() => [...area.stages].sort((a, b) => a.sort_order - b.sort_order), [area]);
  const previous = useMemo(
    () => new Map(lastCompleted?.assessments.map((a) => [a.criterion_id, a.rating]) ?? []),
    [lastCompleted],
  );

  const [stageId, setStageId] = useState<number | null>(stages[0]?.id ?? null);
  const [states, setStates] = useState<Map<number, CriterionState>>(
    () =>
      new Map(
        openSession?.assessments.map((a) => [
          a.criterion_id,
          { rating: a.rating, is_current_goal: a.is_current_goal },
        ]) ?? [],
      ),
  );
  const [dirty, setDirty] = useState<Set<number>>(new Set());
  const [notes, setNotes] = useState<Record<number, string>>(() =>
    Object.fromEntries(openSession?.stage_notes.map((n) => [n.stage_id, n.notes]) ?? []),
  );
  const [noteDirty, setNoteDirty] = useState(false);
  const [goals, setGoals] = useState<NewGoal[]>([]);
  const [saving, setSaving] = useState(false);
  const leaving = useRef(false);

  const stage = stages.find((s) => s.id === stageId) ?? null;
  const note = stageId ? (notes[stageId] ?? '') : '';
  const hasChanges = dirty.size > 0 || goals.length > 0 || noteDirty;

  const get = (id: number): CriterionState => states.get(id) ?? { rating: null, is_current_goal: false };
  const update = (id: number, patch: Partial<CriterionState>) => {
    setStates((prev) => new Map(prev).set(id, { ...get(id), ...patch }));
    setDirty((prev) => new Set(prev).add(id));
  };

  function addGoal(title = '', criterionId: number | null = null) {
    setGoals((g) => [
      ...g,
      {
        key: Math.max(0, ...g.map((x) => x.key)) + 1,
        title,
        target_date: addMonths(todayIso(), 3),
        criterion_id: criterionId,
      },
    ]);
  }

  async function save(complete: boolean): Promise<boolean> {
    if (goals.some((g) => !g.title.trim())) {
      Alert.alert('Ziel ohne Titel', 'Bitte gib jedem neuen Ziel einen Titel oder entferne es.');
      return false;
    }
    setSaving(true);
    try {
      const result = await saveDiagnosticSession(
        {
          schueler_id: studentId,
          area_id: area.id,
          stage_id: stage?.id ?? null,
          complete,
          ...(noteDirty ? { assessment_notes: note.trim() || null } : {}),
          assessments: [...dirty].map((id) => ({ criterion_id: id, ...get(id) })),
          goals: goals.map((g) => ({
            title: g.title.trim(),
            target_date: g.target_date,
            criterion_id: g.criterion_id,
          })),
        },
        area.title,
      );
      // Gesendetes nicht erneut senden (Ziele würden sonst doppelt angelegt).
      setDirty(new Set());
      setGoals([]);
      setNoteDirty(false);
      showToast(
        result.status === 'queued'
          ? 'Offline gespeichert – wird übertragen'
          : complete
            ? 'Diagnose abgeschlossen'
            : 'Zwischenstand gespeichert',
        result.status === 'queued' ? 'info' : 'success',
      );
      if (complete) {
        leaving.current = true;
        router.back();
      }
      return true;
    } catch (e) {
      Alert.alert('Nicht gespeichert', e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function switchStage(id: number) {
    // Die API speichert je Aufruf eine Stufen-Notiz → vor dem Wechsel sichern.
    if (noteDirty && !(await save(false))) return;
    setStageId(id);
  }

  // Beim Verlassen mit ungespeicherten Änderungen nachfragen.
  useEffect(() => {
    return navigation.addListener('beforeRemove', (e) => {
      if (leaving.current || !hasChanges || saving) return;
      e.preventDefault();
      Alert.alert('Ungespeicherte Änderungen', 'Möchtest du den Zwischenstand speichern?', [
        { text: 'Verwerfen', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
        { text: 'Zurück', style: 'cancel' },
        { text: 'Speichern', onPress: () => void save(false).then((ok) => ok && navigation.dispatch(e.data.action)) },
      ]);
    });
  });

  const criteria = [...(stage?.criteria ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const summary = RATINGS.map((r) => ({ ...r, count: criteria.filter((c) => get(c.id).rating === r.value).length }));

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          title: area.title,
          headerRight: () =>
            !openSession && !hasChanges ? <LinkButton label="Bereich" onPress={onChangeArea} /> : null,
        }}
      />
      <FlatList
        data={criteria}
        keyExtractor={(c) => String(c.id)}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.header}>
            {openSession ? (
              <Text style={styles.banner}>
                Offene Sitzung vom {formatDate(openSession.session_date)} wird fortgesetzt
                {openSession.created_by_name ? ` (${openSession.created_by_name})` : ''}.
              </Text>
            ) : null}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stageChips}>
              {stages.map((s) => (
                <Chip key={s.id} label={s.title} selected={s.id === stageId} onPress={() => void switchStage(s.id)} />
              ))}
            </ScrollView>
            {stage?.goal_description ? <Text style={styles.muted}>{stage.goal_description}</Text> : null}
            <View style={styles.summary}>
              {summary.map((r) => (
                <View key={r.value} style={styles.summaryItem}>
                  <View style={[styles.swatch, { backgroundColor: r.color, borderColor: r.border }]} />
                  <Text style={styles.muted}>
                    {r.label}: {r.count}
                  </Text>
                </View>
              ))}
              <Text style={styles.muted}>
                · {criteria.filter((c) => get(c.id).rating).length}/{criteria.length} bewertet
              </Text>
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const st = get(item.id);
          return (
            <CriterionRow
              criterion={item}
              rating={st.rating}
              isCurrentGoal={st.is_current_goal}
              previous={previous.get(item.id)}
              changed={dirty.has(item.id)}
              onRate={(r) => update(item.id, { rating: r })}
              onToggleGoal={() => update(item.id, { is_current_goal: !st.is_current_goal })}
              onCreateGoal={() => addGoal(item.description, item.id)}
            />
          );
        }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={<EmptyState title="Für diese Stufe sind keine Kriterien hinterlegt." />}
        ListFooterComponent={
          <View style={styles.footer}>
            <Card>
              <Text style={styles.label}>Notiz{stage ? ` zu ${stage.title}` : ''}</Text>
              <TextInput
                value={note}
                onChangeText={(t) => {
                  if (!stageId) return;
                  setNotes((n) => ({ ...n, [stageId]: t }));
                  setNoteDirty(true);
                }}
                multiline
                placeholder="Beobachtungen zur Stufe (optional)"
                placeholderTextColor={colors.textSubtle}
                style={styles.textarea}
                textAlignVertical="top"
              />
            </Card>

            <Card>
              <View style={styles.goalHeader}>
                <Text style={styles.label}>Neue Entwicklungsziele</Text>
                <LinkButton label="+ Ziel" onPress={() => addGoal()} />
              </View>
              {goals.length === 0 ? (
                <Text style={styles.muted}>Über „+ Ziel“ bei einem Kriterium oder hier ein Ziel anlegen.</Text>
              ) : null}
              {goals.map((g) => (
                <View key={g.key} style={styles.goal}>
                  <TextInput
                    value={g.title}
                    onChangeText={(t) => setGoals((all) => all.map((x) => (x.key === g.key ? { ...x, title: t } : x)))}
                    placeholder="Was soll das Kind erreichen?"
                    placeholderTextColor={colors.textSubtle}
                    multiline
                    maxLength={500}
                    style={styles.goalInput}
                  />
                  <DateField
                    value={g.target_date}
                    onChange={(d) =>
                      setGoals((all) => all.map((x) => (x.key === g.key ? { ...x, target_date: d } : x)))
                    }
                    presets={[
                      { label: '+4 Wochen', value: addDays(todayIso(), 28) },
                      { label: '+3 Monate', value: addMonths(todayIso(), 3) },
                      { label: '+6 Monate', value: addMonths(todayIso(), 6) },
                    ]}
                    allowClear
                    minimumDate={todayIso()}
                  />
                  <LinkButton label="Entfernen" onPress={() => setGoals((all) => all.filter((x) => x.key !== g.key))} />
                </View>
              ))}
            </Card>
          </View>
        }
      />
      <BottomBar>
        <Text style={styles.muted}>{hasChanges ? 'Ungespeicherte Änderungen' : 'Alles gespeichert'}</Text>
        <View style={styles.flex} />
        <Button
          title="Zwischenspeichern"
          variant="secondary"
          onPress={() => save(false)}
          disabled={!hasChanges || saving}
        />
        <Button title="Abschließen" onPress={() => save(true)} loading={saving} />
      </BottomBar>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  muted: { fontSize: font.size.sm, color: colors.textMuted },
  list: { padding: spacing.lg, width: '100%', maxWidth: 900, alignSelf: 'center' },
  header: { gap: spacing.md, marginBottom: spacing.md },
  banner: {
    backgroundColor: colors.warningSoft,
    color: colors.warning,
    padding: spacing.sm,
    borderRadius: radius.sm,
    fontSize: font.size.sm,
  },
  stageChips: { gap: spacing.sm },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, alignItems: 'center' },
  summaryItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  swatch: { width: 14, height: 14, borderRadius: 3, borderWidth: 1 },
  separator: { height: spacing.sm },
  footer: { gap: spacing.lg, marginTop: spacing.lg, paddingBottom: 140 },
  label: { fontSize: font.size.sm, fontWeight: font.weight.semibold, color: colors.textMuted },
  textarea: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: font.size.md,
    color: colors.text,
  },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  goal: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  goalInput: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: font.size.md,
    color: colors.text,
  },
});
