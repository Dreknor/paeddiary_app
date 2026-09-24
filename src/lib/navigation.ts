import { router } from 'expo-router';

import { showActionSheet } from '@/components/ActionSheet';

import type { ClassStudent, DiaryWeek, WeekAppointment } from '@/api/types';
import type { EntryKind } from '@/components/diary/EntryForm';

import { shortName } from './params';

/**
 * Formular „Neuer Eintrag“ bzw. „Neue Notiz“ für die übergebenen Schüler öffnen (leer = Auswahl im Formular).
 * Optional mit vorbelegtem Datum (z. B. aus der Wochenansicht).
 */
export const openNewEntry = (
  students: Pick<ClassStudent, 'id' | 'firstname' | 'lastname'>[],
  classIds: number[],
  date?: string,
  kind: EntryKind = 'eintrag',
) =>
  router.push({
    pathname: '/eintrag/neu',
    params: {
      studentIds: students.map((s) => s.id).join(','),
      names: students.map((s) => shortName(s.firstname, s.lastname)).join('|'),
      classIds: classIds.join(','),
      ...(date ? { date } : {}),
      art: kind,
    },
  });

/** Neue offene Notiz – Kurzform von `openNewEntry`. */
export const openNewNote = (
  students: Pick<ClassStudent, 'id' | 'firstname' | 'lastname'>[],
  classIds: number[],
  date?: string,
) => openNewEntry(students, classIds, date, 'notiz');

/** Wochenansicht (Kalender) einer Klasse bzw. Lerngruppe öffnen. */
export const openWeek = (scope: { classId: number } | { groupId: number }, name?: string) =>
  router.push({
    pathname: '/kalender',
    params: {
      ...('classId' in scope ? { classId: String(scope.classId) } : { groupId: String(scope.groupId) }),
      ...(name ? { name } : {}),
    },
  });

type StudentRef = Pick<ClassStudent, 'id' | 'firstname' | 'lastname'>;

const studentParams = (students: StudentRef[]) => ({
  studentIds: students.map((s) => s.id).join(','),
  names: students.map((s) => shortName(s.firstname, s.lastname)).join('|'),
});

/** Aufgabe für Schüler anlegen. */
export const openNewTask = (students: StudentRef[], classIds: number[]) =>
  router.push({ pathname: '/planung/aufgabe', params: { ...studentParams(students), classIds: classIds.join(',') } });

/** Aufgabe bearbeiten. */
export const openEditTask = (task: DiaryWeek['tasks'][number]) =>
  router.push({
    pathname: '/planung/aufgabe',
    params: {
      taskId: String(task.id),
      title: task.title,
      description: task.description ?? '',
      due: task.due_date ?? '',
      highlighted: task.highlighted ? '1' : '0',
    },
  });

/** Termin anlegen – für Schüler (Elterngespräch) oder, mit leerer Auswahl, für die Klasse/Lerngruppe. */
export const openNewAppointment = (
  students: StudentRef[],
  scope: { classIds: number[]; groupId?: number | null },
  date?: string,
) =>
  router.push({
    pathname: '/planung/termin',
    params: {
      ...studentParams(students),
      classIds: scope.classIds.join(','),
      ...(scope.groupId ? { groupId: String(scope.groupId) } : {}),
      ...(date ? { date } : {}),
      whole: students.length ? '0' : '1',
    },
  });

/** Einmaligen Termin bearbeiten (Serien im Web). `students` = Schüler des Termins (für die Anzeige). */
export const openEditAppointment = (
  appointment: WeekAppointment,
  students: StudentRef[],
  scope: { classIds: number[]; groupId?: number | null },
) =>
  router.push({
    pathname: '/planung/termin',
    params: {
      id: String(appointment.id),
      ...studentParams(students),
      classIds: (appointment.class_ids.length ? appointment.class_ids : scope.classIds).join(','),
      ...(appointment.group_ids.length ? { groupId: String(appointment.group_ids[0]) } : {}),
      whole: appointment.schueler_ids.length ? '0' : '1',
      date: appointment.date,
      title: appointment.title,
      description: appointment.description ?? '',
      start: appointment.start_time ?? '',
      end: appointment.end_time ?? '',
      pause: appointment.pause_entries ? '1' : '0',
    },
  });

/** Klassen-Feed (eine Klasse oder die Klassen einer Lerngruppe). */
export const openFeed = (classIds: number[], name?: string) =>
  router.push({ pathname: '/planung/feed', params: { classIds: classIds.join(','), ...(name ? { name } : {}) } });

/** Stufenverteilung bzw. Diagnose-Übersicht einer Klasse. */
export const openClassOverview = (kind: 'stufen' | 'diagnose', classId: number, name?: string) =>
  router.push({
    pathname: kind === 'stufen' ? '/planung/stufen' : '/planung/diagnose',
    params: { classId: String(classId), ...(name ? { name } : {}) },
  });

/**
 * „Mehr“-Menü einer Klasse bzw. Lerngruppe: Feed, Stufenverteilung, Förderbedarf (Diagnose) je Klasse.
 */
export function showClassMenu(opts: {
  title: string;
  classes: { id: number; name: string }[];
  canViewDiagnostics: boolean;
}) {
  const multi = opts.classes.length > 1;
  showActionSheet({
    title: opts.title,
    options: [
      {
        label: 'Feed – was Kolleg*innen notiert haben',
        onPress: () =>
          openFeed(
            opts.classes.map((c) => c.id),
            opts.title,
          ),
      },
      ...opts.classes.flatMap((c) => [
        {
          label: multi ? `Stufenverteilung ${c.name}` : 'Stufenverteilung',
          onPress: () => openClassOverview('stufen', c.id, c.name),
        },
        ...(opts.canViewDiagnostics
          ? [
              {
                label: multi ? `Förderbedarf ${c.name}` : 'Förderbedarf (Diagnose)',
                onPress: () => openClassOverview('diagnose', c.id, c.name),
              },
            ]
          : []),
      ]),
    ],
  });
}

/** Weitere Aktionen für ausgewählte Schüler (Aufgabe, Termin). */
export function showSelectionMenu(
  students: StudentRef[],
  scope: { classIds: number[]; groupId?: number | null },
  extra: { label: string; onPress: () => void }[] = [],
) {
  showActionSheet({
    title: students.length === 1 ? students[0].firstname : `${students.length} Schüler`,
    options: [
      { label: 'Aufgabe', onPress: () => openNewTask(students, scope.classIds) },
      { label: 'Termin (z. B. Elterngespräch)', onPress: () => openNewAppointment(students, scope) },
      ...extra,
    ],
  });
}
