import { router } from 'expo-router';

import type { ClassStudent } from '@/api/types';

import { shortName } from './params';

/**
 * Formular „Neuer Eintrag“ für die übergebenen Schüler öffnen (leer = Auswahl im Formular).
 * Optional mit vorbelegtem Datum (z. B. aus der Wochenansicht).
 */
export const openNewEntry = (
  students: Pick<ClassStudent, 'id' | 'firstname' | 'lastname'>[],
  classIds: number[],
  date?: string,
) =>
  router.push({
    pathname: '/eintrag/neu',
    params: {
      studentIds: students.map((s) => s.id).join(','),
      names: students.map((s) => shortName(s.firstname, s.lastname)).join('|'),
      classIds: classIds.join(','),
      ...(date ? { date } : {}),
    },
  });

/** Wochenansicht (Kalender) einer Klasse bzw. Lerngruppe öffnen. */
export const openWeek = (scope: { classId: number } | { groupId: number }, name?: string) =>
  router.push({
    pathname: '/kalender',
    params: {
      ...('classId' in scope ? { classId: String(scope.classId) } : { groupId: String(scope.groupId) }),
      ...(name ? { name } : {}),
    },
  });
