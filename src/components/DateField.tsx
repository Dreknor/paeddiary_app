import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { addDays, formatDate, formatRelativeDay, parseIsoDate, toIsoDate, todayIso } from '@/lib/dates';
import { colors, font, radius, spacing } from '@/theme';

import { Chip } from './controls';
import { Button } from './ui';

type Props = {
  label?: string;
  value: string | null;
  onChange: (iso: string | null) => void;
  /** Schnellwahl, z. B. [{label:'Heute', value: todayIso()}] */
  presets?: { label: string; value: string }[];
  allowClear?: boolean;
  maximumDate?: string;
  minimumDate?: string;
};

export const pastDayPresets = () => [
  { label: 'Heute', value: todayIso() },
  { label: 'Gestern', value: addDays(todayIso(), -1) },
];

/** Datumsauswahl mit Schnellwahl-Chips und nativem Kalender. */
export function DateField({ label, value, onChange, presets = [], allowClear, maximumDate, minimumDate }: Props) {
  const [iosOpen, setIosOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(value ? parseIsoDate(value) : new Date());
  const isPreset = presets.some((p) => p.value === value);

  function openPicker() {
    const current = value ? parseIsoDate(value) : new Date();
    const limits = {
      maximumDate: maximumDate ? parseIsoDate(maximumDate) : undefined,
      minimumDate: minimumDate ? parseIsoDate(minimumDate) : undefined,
    };
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode: 'date',
        ...limits,
        onChange: (event, date) => {
          if (event.type === 'set' && date) onChange(toIsoDate(date));
        },
      });
    } else {
      setDraft(current);
      setIosOpen(true);
    }
  }

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.row}>
        {presets.map((p) => (
          <Chip key={p.label} label={p.label} selected={value === p.value} onPress={() => onChange(p.value)} />
        ))}
        <Chip
          label={value && !isPreset ? formatRelativeDay(value) : 'Datum wählen…'}
          selected={!!value && !isPreset}
          onPress={openPicker}
        />
        {allowClear && value ? <Chip label="Kein Datum" onPress={() => onChange(null)} /> : null}
      </View>
      {value && !isPreset ? <Text style={styles.hint}>{formatDate(value)}</Text> : null}

      {Platform.OS === 'ios' ? (
        <Modal visible={iosOpen} transparent animationType="fade" onRequestClose={() => setIosOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setIosOpen(false)}>
            <Pressable style={styles.sheet} onPress={() => undefined}>
              <DateTimePicker
                value={draft}
                mode="date"
                display="inline"
                locale="de-DE"
                maximumDate={maximumDate ? parseIsoDate(maximumDate) : undefined}
                minimumDate={minimumDate ? parseIsoDate(minimumDate) : undefined}
                onChange={(_, date) => date && setDraft(date)}
                accentColor={colors.primary}
              />
              <Button
                title="Übernehmen"
                onPress={() => {
                  onChange(toIsoDate(draft));
                  setIosOpen(false);
                }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  label: { fontSize: font.size.sm, fontWeight: font.weight.medium, color: colors.textMuted },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  hint: { fontSize: font.size.xs, color: colors.textMuted },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: spacing.xl },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
});
