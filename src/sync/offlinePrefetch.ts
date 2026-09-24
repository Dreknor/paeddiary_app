import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { fetchClassStudents, fetchDiaryWeek } from '@/api/endpoints';
import { queryKeys, useClasses } from '@/api/queries';
import { nextSchoolDayIso, startOfWeekIso } from '@/lib/dates';

import { useIsOnline } from './queryPersistence';

const MAX_CLASSES = 12;
const MAX_GROUPS = 8;
/** Nicht bei jedem Öffnen neu laden – was jünger ist, gilt als aktuell. */
const FRESH_MS = 10 * 60_000;

/**
 * Lädt bei Netz im Hintergrund Schülerlisten und die aktuelle Woche aller eigenen Klassen und
 * Lerngruppen in den (verschlüsselt gespeicherten) Cache – damit die App auch offline vollständig ist,
 * nicht nur mit den zuletzt geöffneten Ansichten.
 */
export function useOfflinePrefetch() {
  const queryClient = useQueryClient();
  const online = useIsOnline();
  const { data } = useClasses();

  const classIds = (data?.data ?? []).slice(0, MAX_CLASSES).map((c) => c.id);
  const groupIds = (data?.learning_groups ?? []).slice(0, MAX_GROUPS).map((g) => g.id);
  const signature = `${classIds.join(',')}|${groupIds.join(',')}`;

  useEffect(() => {
    if (!online || !signature.replace('|', '')) return;
    const weekStart = startOfWeekIso(nextSchoolDayIso());
    const [classPart, groupPart] = signature.split('|');
    const ids = (part: string) => (part ? part.split(',').map(Number) : []);

    // Nacheinander, um den Schulserver nicht mit vielen parallelen Abrufen zu belasten.
    let cancelled = false;
    (async () => {
      for (const classId of ids(classPart)) {
        if (cancelled) return;
        await queryClient
          .prefetchQuery({
            queryKey: queryKeys.classStudents(classId),
            queryFn: () => fetchClassStudents(classId),
            staleTime: FRESH_MS,
          })
          .catch(() => {});
        await queryClient
          .prefetchQuery({
            queryKey: queryKeys.diaryWeek({ classId }, weekStart),
            queryFn: () => fetchDiaryWeek({ classId }, weekStart),
            staleTime: FRESH_MS,
          })
          .catch(() => {});
      }
      for (const groupId of ids(groupPart)) {
        if (cancelled) return;
        await queryClient
          .prefetchQuery({
            queryKey: queryKeys.diaryWeek({ groupId }, weekStart),
            queryFn: () => fetchDiaryWeek({ groupId }, weekStart),
            staleTime: FRESH_MS,
          })
          .catch(() => {});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [online, signature, queryClient]);
}
