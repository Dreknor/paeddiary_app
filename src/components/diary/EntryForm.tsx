import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useDiaryCategories } from '@/api/queries';
import type { DiaryEntryInput } from '@/api/types';
import { Chip, SwitchRow } from '@/components/controls';
import { DateField, pastDayPresets } from '@/components/DateField';
import { DictationButton } from '@/components/DictationButton';
import { Button, ErrorBox } from '@/components/ui';
import { todayIso } from '@/lib/dates';
import { colors, font, radius, spacing } from '@/theme';

/** Wie im Web: neue Einträge sind offen und laufen in der Wochenansicht weiter, bis man sie abschließt. */
export const emptyEntry = (): DiaryEntryInput => ({
  category_id: null,
  entry_date: todayIso(),
  content: '',
  is_dossier_only: false,
  is_completed: false,
});

type Props = {
  initial: DiaryEntryInput;
  /** Oberer Bereich, z. B. Schülerauswahl. */
  header?: ReactNode;
  submitLabel: string;
  onSubmit: (values: DiaryEntryInput) => Promise<void>;
  canSubmit?: boolean;
  footer?: ReactNode;
};

/** Formular für Tagebucheinträge (Neu/Bearbeiten) mit Kategorie-Chips, Datum, Diktat. */
export function EntryForm({ initial, header, submitLabel, onSubmit, canSubmit = true, footer }: Props) {
  const { data: categories } = useDiaryCategories();
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const dictationBase = useRef('');
  const valuesRef = useRef(values);
  useEffect(() => {
    valuesRef.current = values;
  });

  const set = <K extends keyof DiaryEntryInput>(key: K, value: DiaryEntryInput[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const onListeningChange = useCallback((active: boolean) => {
    setListening(active);
    // Text vor Diktatbeginn merken; Diktat wird angehängt.
    if (active) dictationBase.current = valuesRef.current.content;
  }, []);

  const onDictation = useCallback((text: string, isFinal: boolean) => {
    const base = dictationBase.current;
    const merged = base && text ? `${base.replace(/\s+$/, '')} ${text}` : base || text;
    setValues((v) => ({ ...v, content: merged }));
    if (isFinal) dictationBase.current = merged;
  }, []);

  async function submit() {
    if (!values.content.trim()) {
      setError('Bitte gib einen Text ein.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ ...values, content: values.content.trim() });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  const visibleCategories = (categories ?? []).filter((c) => !c.is_hidden || c.id === values.category_id);

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {header}

        <View style={styles.block}>
          <Text style={styles.label}>Kategorie</Text>
          <View style={styles.chips}>
            <Chip label="Ohne" selected={values.category_id === null} onPress={() => set('category_id', null)} />
            {visibleCategories.map((c) => (
              <Chip
                key={c.id}
                label={c.name}
                color={c.color}
                selected={values.category_id === c.id}
                onPress={() => set('category_id', c.id)}
              />
            ))}
          </View>
        </View>

        <View style={styles.block}>
          <View style={styles.textHeader}>
            <Text style={styles.label}>Beobachtung</Text>
            <DictationButton onText={onDictation} onListeningChange={onListeningChange} />
          </View>
          <TextInput
            value={values.content}
            onChangeText={(t) => set('content', t)}
            placeholder="Was hast du beobachtet?"
            placeholderTextColor={colors.textSubtle}
            multiline
            textAlignVertical="top"
            style={[styles.textarea, listening && styles.textareaListening]}
            accessibilityLabel="Beobachtung"
            maxLength={20000}
            autoFocus={!initial.content}
          />
        </View>

        <DateField
          label="Datum"
          value={values.entry_date}
          onChange={(d) => d && set('entry_date', d)}
          presets={pastDayPresets()}
          maximumDate={todayIso()}
        />

        <View style={styles.switches}>
          <SwitchRow
            label="Abgeschlossen"
            hint="Aus: Der Eintrag bleibt in der Wochenansicht offen, bis du ihn abschließt."
            value={values.is_completed}
            onValueChange={(v) => set('is_completed', v)}
          />
          <SwitchRow
            label="🔒 Vertraulich (nur Dossier)"
            hint="Erscheint nur im Dossier. Andere sehen den Eintrag nur mit Sonderrecht."
            value={values.is_dossier_only}
            onValueChange={(v) => set('is_dossier_only', v)}
          />
        </View>

        {error ? <ErrorBox message={error} /> : null}
        <Button title={submitLabel} onPress={submit} loading={busy} disabled={!canSubmit || !values.content.trim()} />
        {footer}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.xl, width: '100%', maxWidth: 760, alignSelf: 'center' },
  block: { gap: spacing.sm },
  label: { fontSize: font.size.sm, fontWeight: font.weight.medium, color: colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  textHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  textarea: {
    minHeight: 160,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    fontSize: font.size.md,
    lineHeight: 22,
    color: colors.text,
  },
  textareaListening: { borderColor: colors.accent, borderWidth: 2 },
  switches: { gap: spacing.xs },
});
