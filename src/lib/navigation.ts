import { router } from 'expo-router';

import type { ClassStudent } from '@/api/types';

import { shortName } from './params';

/** Formular „Neuer Eintrag“ für die übergebenen Schüler öffnen (leer = Auswahl im Formular). */
export const openNewEntry = (students: Pick<ClassStudent, 'id' | 'firstname' | 'lastname'>[], classIds: number[]) =>
  router.push({
    pathname: '/eintrag/neu',
    params: {
      studentIds: students.map((s) => s.id).join(','),
      names: students.map((s) => shortName(s.firstname, s.lastname)).join('|'),
      classIds: classIds.join(','),
    },
  });
