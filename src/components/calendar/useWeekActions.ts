import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';

import {
  closeTask,
  completeWeekEntry,
  deleteAppointment,
  setAbsence,
  setColumnValue,
  setDayPause,
  setEntryPause,
  setResubmission,
} from '@/api/mutations';
import type { DiaryWeek, WeekAppointment, WeekEntry, WeekStudent } from '@/api/types';
import { showActionSheet } from '@/components/ActionSheet';
import { showToast } from '@/components/Toast';
import { addDays, formatDayMonth, formatRelativeDay, nextSchoolDayIso, shiftSchoolDay } from '@/lib/dates';
import { openEditAppointment, openEditTask, openNewAppointment, openNewEntry, openNewTask } from '@/lib/navigation';
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
    run(completeWeekEntry(queryClient, weekKey, entry, student.id, date), 'Eintrag abgeschlossen');

  const pause = (entry: WeekEntry, student: WeekStudent, date: string, paused: boolean) =>
    run(setEntryPause(queryClient, weekKey, entry.id, student.id, date, paused));

  const toggleAbsence = (student: WeekStudent, date: string, absent: boolean) =>
    run(setAbsence(queryClient, weekKey, student.id, date, absent));

  const setColumn = (columnId: number, student: WeekStudent, date: string, value: string | null) =>
    run(setColumnValue(queryClient, weekKey, columnId, student.id, date, value));

  const finishTask = (taskId: number, student: WeekStudent) =>
    run(closeTask(queryClient, weekKey, taskId, student.id), 'Aufgabe erledigt');

  const newEntry = (students: WeekStudent[], date: string) => openNewEntry(students, classIds, date);

  const groupId = 'group_id' in scope ? scope.group_id : null;
  const newTask = (students: WeekStudent[]) => openNewTask(students, classIds);
  const newAppointment = (students: WeekStudent[], date: string) =>
    openNewAppointment(students, { classIds, groupId }, date);

  /** Wiedervorlage: ab `date` ausblenden bis `resumeOn` (null = aufheben). */
  const resubmit = (entry: WeekEntry, student: WeekStudent, date: string, resumeOn: string | null) =>
    run(
      setResubmission(queryClient, weekKey, entry, entry.schueler_ids.length > 1 ? student.id : null, date, resumeOn),
      resumeOn ? `Wird ab ${formatRelativeDay(resumeOn)} wieder angezeigt` : 'Wiedervorlage aufgehoben',
    );

  function resubmissionMenu(entry: WeekEntry, student: WeekStudent, date: string) {
    const nextMonday = addDays(date, 8 - (new Date(`${date}T12:00:00`).getDay() || 7));
    const presets = [
      { label: 'Morgen', value: shiftSchoolDay(date, 1) },
      { label: `Montag, ${formatDayMonth(nextMonday)}`, value: nextMonday },
      { label: 'In 2 Wochen', value: nextSchoolDayIso(addDays(date, 14)) },
      { label: 'In 4 Wochen', value: nextSchoolDayIso(addDays(date, 28)) },
    ].filter((p, i, all) => all.findIndex((x) => x.value === p.value) === i);
    showActionSheet({
      title: 'Wieder anzeigen ab …',
      message: `Bis dahin ist der Eintrag${entry.schueler_ids.length > 1 ? ` für ${student.firstname}` : ''} ausgeblendet.`,
      options: presets.map((p) => ({ label: p.label, onPress: () => resubmit(entry, student, date, p.value) })),
    });
  }

  /** Aufgabe: erledigen oder bearbeiten. */
  function taskMenu(task: DiaryWeek['tasks'][number], student: WeekStudent) {
    showActionSheet({
      title: task.title,
      message: [student.firstname, task.due_date ? `bis ${formatDayMonth(task.due_date)}` : null, task.description]
        .filter(Boolean)
        .join(' · '),
      options: [
        { label: 'Erledigt', onPress: () => finishTask(task.id, student) },
        { label: 'Bearbeiten', onPress: () => openEditTask(task) },
      ],
    });
  }

  /** Termin: bearbeiten/löschen (Serien: nur dieses Vorkommen oder ab hier löschen). */
  function appointmentMenu(appointment: WeekAppointment) {
    const students = (week?.students ?? []).filter((s) => appointment.schueler_ids.includes(s.id));
    const remove = (mode: 'all' | 'only_this' | 'this_and_future') =>
      run(deleteAppointment(appointment.id, mode, appointment.date), 'Termin gelöscht');
    showActionSheet({
      title: appointment.title,
      message: [formatRelativeDay(appointment.date), appointment.description].filter(Boolean).join(' · '),
      options: appointment.is_recurring
        ? [
            { label: 'Nur diesen Termin löschen', destructive: true, onPress: () => remove('only_this') },
            { label: 'Diesen und alle folgenden löschen', destructive: true, onPress: () => remove('this_and_future') },
          ]
        : [
            { label: 'Bearbeiten', onPress: () => openEditAppointment(appointment, students, { classIds, groupId }) },
            { label: 'Löschen', destructive: true, onPress: () => remove('all') },
          ],
    });
  }

  const openEntry = (entry: WeekEntry) => router.push({ pathname: '/eintrag/[id]', params: { id: String(entry.id) } });

  /** Menü für einen Eintrag in einer Zelle. */
  function entryMenu(entry: WeekEntry, student: WeekStudent, date: string, paused = false, resubmitted = false) {
    if (entry.is_completed) {
      openEntry(entry);
      return;
    }
    const others = entry.schueler_ids.length - 1;
    showActionSheet({
      title: entry.content.slice(0, 80),
      message: others > 0 ? `Offener Eintrag für ${student.firstname} und ${others} weitere` : 'Offener Eintrag',
      options: paused
        ? [
            resubmitted
              ? {
                  label: 'Wiedervorlage aufheben',
                  onPress: () => resubmit(entry, student, date, null),
                }
              : {
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
            { label: 'Wiedervorlage …', onPress: () => resubmissionMenu(entry, student, date) },
            { label: 'Öffnen', onPress: () => openEntry(entry) },
          ],
    });
  }

  /** Menü für eine Zelle (Schüler × Tag). */
  function cellMenu(student: WeekStudent, date: string, absent: boolean) {
    showActionSheet({
      title: `${student.firstname} · ${formatRelativeDay(date)}`,
      options: [
        { label: 'Neuer Eintrag', onPress: () => newEntry([student], date) },
        { label: 'Neue Aufgabe', onPress: () => newTask([student]) },
        { label: 'Neuer Termin', onPress: () => newAppointment([student], date) },
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
        message: 'Offene Einträge werden an diesem Tag wieder angezeigt.',
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
      message: 'Alle offenen Einträge werden an diesem Tag ausgeblendet. Grund:',
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
    newTask,
    newAppointment,
    resubmit,
    resubmissionMenu,
    taskMenu,
    appointmentMenu,
    entryMenu,
    cellMenu,
    dayPauseMenu,
  };
}

export type WeekActions = ReturnType<typeof useWeekActions>;
