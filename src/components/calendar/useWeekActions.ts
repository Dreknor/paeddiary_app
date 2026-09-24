import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';

import { closeTask, completeWeekEntry, setAbsence, setColumnValue, setDayPause, setEntryPause } from '@/api/mutations';
import type { DiaryWeek, WeekEntry, WeekStudent } from '@/api/types';
import { showActionSheet } from '@/components/ActionSheet';
import { showToast } from '@/components/Toast';
import { formatRelativeDay } from '@/lib/dates';
import { openNewEntry, openNewNote } from '@/lib/navigation';
import type { SendResult } from '@/sync/outbox';

const DAY_PAUSE_REASONS = ['Veranstaltung', 'Wandertag', 'Exkursion', 'Projekttag', 'Klassenfahrt'];

type Scope = { class_id: number } | { group_id: number };

/** Alle Aktionen der Wochenansicht mit Rückmeldung (gespeichert / offline / Fehler). */
export function useWeekActions(weekKey: readonly unknown[], week: DiaryWeek | undefined, scope: Scope) {
  const queryClient = useQueryClient();
  const classIds = week?.classes.map((c) => c.id) ?? [];

  async function run(action: Promise<SendResult<unknown>>, success?: string) {
    try {
      const result = await action;
      if (result.status === 'queued') showToast('Offline gespeichert – wird automatisch übertragen', 'info');
      else if (success) showToast(success);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.', 'error');
    }
  }

  const complete = (entry: WeekEntry, student: WeekStudent, date: string) =>
    run(completeWeekEntry(queryClient, weekKey, entry, student.id, date), 'Notiz abgeschlossen');

  const pause = (entry: WeekEntry, student: WeekStudent, date: string, paused: boolean) =>
    run(setEntryPause(queryClient, weekKey, entry.id, student.id, date, paused));

  const toggleAbsence = (student: WeekStudent, date: string, absent: boolean) =>
    run(setAbsence(queryClient, weekKey, student.id, date, absent));

  const setColumn = (columnId: number, student: WeekStudent, date: string, value: string | null) =>
    run(setColumnValue(queryClient, weekKey, columnId, student.id, date, value));

  const finishTask = (taskId: number, student: WeekStudent) =>
    run(closeTask(queryClient, weekKey, taskId, student.id), 'Aufgabe erledigt');

  const newEntry = (students: WeekStudent[], date: string) => openNewEntry(students, classIds, date);

  const newNote = (students: WeekStudent[], date: string) => openNewNote(students, classIds, date);

  const openEntry = (entry: WeekEntry) => router.push({ pathname: '/eintrag/[id]', params: { id: String(entry.id) } });

  /** Menü für einen Eintrag in einer Zelle. */
  function entryMenu(entry: WeekEntry, student: WeekStudent, date: string, paused = false) {
    if (entry.is_completed) {
      openEntry(entry);
      return;
    }
    const others = entry.schueler_ids.length - 1;
    showActionSheet({
      title: entry.content.slice(0, 80),
      message: others > 0 ? `Offene Notiz für ${student.firstname} und ${others} weitere` : 'Offene Notiz',
      options: paused
        ? [
            {
              label: `Am ${formatRelativeDay(date)} wieder anzeigen`,
              onPress: () => pause(entry, student, date, false),
            },
            { label: 'Öffnen', onPress: () => openEntry(entry) },
          ]
        : [
            {
              label: others > 0 ? `Für ${student.firstname} abschließen` : 'Abschließen',
              onPress: () => complete(entry, student, date),
            },
            { label: `Am ${formatRelativeDay(date)} pausieren`, onPress: () => pause(entry, student, date, true) },
            { label: 'Öffnen', onPress: () => openEntry(entry) },
          ],
    });
  }

  /** Menü für eine Zelle (Schüler × Tag). */
  function cellMenu(student: WeekStudent, date: string, absent: boolean) {
    showActionSheet({
      title: `${student.firstname} · ${formatRelativeDay(date)}`,
      options: [
        { label: 'Neue Notiz', onPress: () => newNote([student], date) },
        { label: 'Neuer Eintrag', onPress: () => newEntry([student], date) },
        absent
          ? { label: 'Abwesenheit aufheben', onPress: () => toggleAbsence(student, date, false) }
          : { label: 'Als abwesend markieren', onPress: () => toggleAbsence(student, date, true) },
      ],
    });
  }

  /** Tagespause für die ganze Klasse/Lerngruppe setzen oder aufheben. */
  function dayPauseMenu(date: string, currentReason: string | null) {
    if (currentReason) {
      showActionSheet({
        title: `Tagespause ${formatRelativeDay(date)}: ${currentReason}`,
        message: 'Offene Notizen werden an diesem Tag wieder angezeigt.',
        options: [
          {
            label: 'Tagespause aufheben',
            onPress: () => run(setDayPause(queryClient, weekKey, scope, classIds, date, false)),
          },
        ],
      });
      return;
    }
    showActionSheet({
      title: `${formatRelativeDay(date)} pausieren`,
      message: 'Alle offenen Notizen werden an diesem Tag ausgeblendet. Grund:',
      options: DAY_PAUSE_REASONS.map((reason) => ({
        label: reason,
        onPress: () => run(setDayPause(queryClient, weekKey, scope, classIds, date, true, reason), 'Tag pausiert'),
      })),
    });
  }

  return {
    complete,
    pause,
    toggleAbsence,
    setColumn,
    finishTask,
    newEntry,
    newNote,
    entryMenu,
    cellMenu,
    dayPauseMenu,
  };
}

export type WeekActions = ReturnType<typeof useWeekActions>;
