import { keepPreviousData, useInfiniteQuery, useQueries, useQuery } from '@tanstack/react-query';

import { useAuth } from '@/auth/AuthContext';

import {
  fetchClasses,
  fetchClassGradingSessions,
  fetchClassStudents,
  fetchDevices,
  fetchDiagnosticAreas,
  fetchDiagnosticHistory,
  fetchDiaryCategories,
  fetchDiaryEntries,
  fetchDiaryWeek,
  fetchDossier,
  fetchGradingHistory,
  fetchGradingSession,
  fetchStudentView,
  type DossierParams,
} from './endpoints';
import type { ClassStudent, WeekScope } from './types';

export const queryKeys = {
  classes: ['classes'] as const,
  classStudents: (classId: number) => ['classes', classId, 'students'] as const,
  classGradingSessions: (classId: number) => ['classes', classId, 'grading-sessions'] as const,
  student: (studentId: number) => ['students', studentId] as const,
  studentView: (studentId: number) => ['students', studentId, 'view'] as const,
  diaryEntries: (studentId: number, categoryId: number | null = null) =>
    ['students', studentId, 'diary', categoryId] as const,
  diaryAll: ['students'] as const,
  gradingHistory: (studentId: number) => ['students', studentId, 'grading'] as const,
  diagnosticHistory: (studentId: number) => ['students', studentId, 'diagnostic'] as const,
  dossier: (studentId: number, params: DossierParams) => ['students', studentId, 'dossier', params] as const,
  gradingSession: (sessionId: number) => ['grading-sessions', sessionId] as const,
  diaryWeeks: ['diary-week'] as const,
  diaryWeek: (scope: WeekScope, weekStart: string) =>
    ['diary-week', 'classId' in scope ? `c${scope.classId}` : `g${scope.groupId}`, weekStart] as const,
  categories: ['diary-categories'] as const,
  diagnosticAreas: ['diagnostic-areas'] as const,
  devices: ['devices'] as const,
};

export function useClasses() {
  return useQuery({ queryKey: queryKeys.classes, queryFn: () => fetchClasses() });
}

export function useClassStudents(classId: number) {
  return useQuery({
    queryKey: queryKeys.classStudents(classId),
    queryFn: () => fetchClassStudents(classId),
    enabled: Number.isFinite(classId),
  });
}

export type GroupStudent = ClassStudent & { classId: number; className: string };

/** Schüler mehrerer Klassen (Lerngruppe) zusammengeführt, alphabetisch sortiert. */
export function useStudentsOfClasses(classIds: number[]) {
  const results = useQueries({
    queries: classIds.map((id) => ({
      queryKey: queryKeys.classStudents(id),
      queryFn: () => fetchClassStudents(id),
    })),
  });

  const students: GroupStudent[] = results
    .flatMap((r) =>
      r.data
        ? r.data.data.map((s) => ({ ...s, classId: r.data.meta.class.id, className: r.data.meta.class.name }))
        : [],
    )
    .sort((a, b) => a.firstname.localeCompare(b.firstname, 'de') || a.lastname.localeCompare(b.lastname, 'de'));

  return {
    students,
    isLoading: results.some((r) => r.isLoading),
    isRefetching: results.some((r) => r.isRefetching),
    error: results.find((r) => r.error)?.error ?? null,
    refetch: () => Promise.all(results.map((r) => r.refetch())),
  };
}

export function useStudentView(studentId: number) {
  return useQuery({
    queryKey: queryKeys.studentView(studentId),
    queryFn: () => fetchStudentView(studentId),
    enabled: Number.isFinite(studentId),
  });
}

export function useDiaryCategories() {
  return useQuery({ queryKey: queryKeys.categories, queryFn: fetchDiaryCategories, staleTime: 60 * 60_000 });
}

export function useDiaryEntries(studentId: number, categoryId: number | null) {
  return useInfiniteQuery({
    queryKey: queryKeys.diaryEntries(studentId, categoryId),
    queryFn: ({ pageParam }) =>
      fetchDiaryEntries(studentId, { page: pageParam, per_page: 25, category_id: categoryId ?? undefined }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.current_page < last.meta.last_page ? last.meta.current_page + 1 : undefined),
    enabled: Number.isFinite(studentId),
  });
}

/** Wochenansicht; `weekStart` muss der Montag sein (ein Cache-Eintrag pro Woche). */
export function useDiaryWeek(scope: WeekScope, weekStart: string) {
  return useQuery({
    queryKey: queryKeys.diaryWeek(scope, weekStart),
    queryFn: () => fetchDiaryWeek(scope, weekStart),
    placeholderData: keepPreviousData,
  });
}

export function useGradingHistory(studentId: number) {
  return useQuery({ queryKey: queryKeys.gradingHistory(studentId), queryFn: () => fetchGradingHistory(studentId) });
}

export function useClassGradingSessions(classId: number) {
  return useQuery({
    queryKey: queryKeys.classGradingSessions(classId),
    queryFn: () => fetchClassGradingSessions(classId, { status: 'open' }).then((r) => r.data),
    enabled: Number.isFinite(classId),
  });
}

export function useGradingSession(sessionId: number, refetchInterval?: number) {
  return useQuery({
    queryKey: queryKeys.gradingSession(sessionId),
    queryFn: () => fetchGradingSession(sessionId),
    enabled: Number.isFinite(sessionId),
    refetchInterval,
  });
}

export function useDiagnosticAreas() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.diagnosticAreas,
    queryFn: fetchDiagnosticAreas,
    staleTime: 60 * 60_000,
    enabled: !!user?.permissions.view_diagnostics,
  });
}

export function useDiagnosticHistory(studentId: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.diagnosticHistory(studentId),
    queryFn: () => fetchDiagnosticHistory(studentId),
    enabled: Number.isFinite(studentId) && !!user?.permissions.view_diagnostics,
  });
}

export function useDossier(studentId: number, params: DossierParams) {
  return useQuery({
    queryKey: queryKeys.dossier(studentId, params),
    queryFn: () => fetchDossier(studentId, params),
    // Dossier enthält alles auf einmal – nicht dauerhaft auf dem Gerät ablegen.
    meta: { persist: false },
  });
}

export function useDevices() {
  return useQuery({ queryKey: queryKeys.devices, queryFn: fetchDevices, meta: { persist: false } });
}
