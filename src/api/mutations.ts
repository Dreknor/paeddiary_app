import type { QueryClient } from '@tanstack/react-query';

import { sendViaOutbox, type NewOutboxItem, type SendResult } from '@/sync/outbox';

import { queryKeys } from './queries';
import type {
  DevelopmentGoalFull,
  DiagnosticSession,
  DiagnosticSessionInput,
  DiaryEntry,
  DiaryEntryInput,
  DiaryWeek,
  GoalStatus,
  GradingAnswerInput,
  GradingSessionResponse,
  Appointment,
  AppointmentInput,
  DiaryTask,
  TaskInput,
  WeekEntry,
} from './types';
import { RESUBMISSION_REASON } from './types';
import { addDays, parseIsoDate } from '@/lib/dates';

/**
 * Alle schreibenden Aktionen laufen über die Warteschlange (`sendViaOutbox`):
 * online sofort gesendet, bei Netzabbruch verschlüsselt gespeichert und nachgesendet.
 */

const studentKeys = (ids: number[]) => ids.map((id) => queryKeys.student(id));

// ---------------------------------------------------------------- Tagebuch

export function createDiaryEntry(
  students: { id: number; name: string }[],
  input: DiaryEntryInput,
): Promise<SendResult<{ data: DiaryEntry | DiaryEntry[] }>> {
  const ids = students.map((s) => s.id);
  const label =
    students.length === 1 ? `Tagebucheintrag · ${students[0].name}` : `Gruppeneintrag · ${students.length} Schüler`;
  const common = {
    kind: 'diary' as const,
    label,
    meta: { studentIds: ids, preview: input.content.slice(0, 120), entryDate: input.entry_date },
    invalidate: [...studentKeys(ids), queryKeys.classes, queryKeys.diaryWeeks],
  };
  return students.length === 1
    ? sendViaOutbox({ ...common, method: 'POST', path: '/paed-diary/entries', body: { schueler_id: ids[0], ...input } })
    : sendViaOutbox({
        ...common,
        method: 'POST',
        path: '/paed-diary/bulk-entries',
        body: { schueler_ids: ids, ...input },
      });
}

export function updateDiaryEntry(entry: DiaryEntry, patch: Partial<DiaryEntryInput>) {
  return sendViaOutbox<{ data: DiaryEntry }>({
    kind: 'diary',
    method: 'PUT',
    path: `/paed-diary/entries/${entry.id}`,
    // Konfliktschutz: 409, wenn jemand den Eintrag inzwischen geändert hat.
    body: { ...patch, expected_updated_at: entry.updated_at },
    label: 'Tagebucheintrag ändern',
    meta: { studentIds: entry.schueler_ids, entryId: entry.id },
    invalidate: [...studentKeys(entry.schueler_ids), queryKeys.diaryWeeks],
  });
}

export function deleteDiaryEntry(entry: DiaryEntry) {
  return sendViaOutbox<void>({
    kind: 'diary',
    method: 'DELETE',
    path: `/paed-diary/entries/${entry.id}`,
    label: 'Tagebucheintrag löschen',
    meta: { studentIds: entry.schueler_ids, entryId: entry.id, deleted: true },
    invalidate: [...studentKeys(entry.schueler_ids), queryKeys.classes, queryKeys.diaryWeeks],
  });
}

// ---------------------------------------------------------------- Wochenansicht (Kalender)

type WeekKey = readonly unknown[];

/**
 * Aktion der Wochenansicht: sofort im Cache anzeigen (optimistisch), dann über die Warteschlange senden.
 * Lehnt der Server ab (4xx), wird der vorherige Stand wiederhergestellt und der Fehler weitergegeben.
 */
async function weekAction(
  queryClient: QueryClient,
  weekKey: WeekKey,
  optimistic: (week: DiaryWeek) => DiaryWeek,
  item: Omit<NewOutboxItem, 'kind' | 'invalidate'> & { invalidate?: NewOutboxItem['invalidate'] },
) {
  // Laufendes Neuladen abbrechen, damit es den optimistischen Stand nicht überschreibt.
  await queryClient.cancelQueries({ queryKey: weekKey });
  const previous = queryClient.getQueryData<DiaryWeek>(weekKey);
  queryClient.setQueryData<DiaryWeek>(weekKey, (prev) => (prev ? optimistic(prev) : prev));
  try {
    return await sendViaOutbox({
      ...item,
      kind: 'diary',
      invalidate: [queryKeys.diaryWeeks, ...(item.invalidate ?? [])],
    });
  } catch (error) {
    queryClient.setQueryData(weekKey, previous);
    throw error;
  }
}

/** Offene Notiz abschließen – bei mehreren Schülern nur für `studentId`. */
export function completeWeekEntry(
  queryClient: QueryClient,
  weekKey: WeekKey,
  entry: WeekEntry,
  studentId: number,
  date: string,
) {
  const onlyThisStudent = entry.schueler_ids.length > 1;
  return weekAction(
    queryClient,
    weekKey,
    (week) => ({
      ...week,
      entries: week.entries.map((e) =>
        e.id !== entry.id
          ? e
          : onlyThisStudent
            ? { ...e, schueler_ids: e.schueler_ids.filter((id) => id !== studentId) }
            : { ...e, is_completed: true, completed_at: new Date().toISOString() },
      ),
    }),
    {
      method: 'POST',
      path: `/paed-diary/entries/${entry.id}/complete`,
      body: { date, schueler_id: onlyThisStudent ? studentId : undefined },
      label: 'Notiz abschließen',
      meta: { studentIds: [studentId], entryId: entry.id },
      invalidate: [queryKeys.student(studentId)],
    },
  );
}

/** Offene Notiz für einen Schüler an einem Tag ausblenden bzw. wieder anzeigen. */
export function setEntryPause(
  queryClient: QueryClient,
  weekKey: WeekKey,
  entryId: number,
  studentId: number,
  date: string,
  paused: boolean,
) {
  const same = (p: DiaryWeek['pauses'][number]) =>
    p.entry_id === entryId && p.schueler_id === studentId && p.date === date;
  return weekAction(
    queryClient,
    weekKey,
    (week) => ({
      ...week,
      pauses: paused
        ? [...week.pauses.filter((p) => !same(p)), { entry_id: entryId, schueler_id: studentId, date }]
        : week.pauses.filter((p) => !same(p)),
    }),
    {
      method: 'PUT',
      path: `/paed-diary/entries/${entryId}/pause`,
      body: { schueler_id: studentId, date, paused },
      label: paused ? 'Notiz pausieren' : 'Notiz fortsetzen',
      meta: { studentIds: [studentId], entryId },
    },
  );
}

export function setAbsence(
  queryClient: QueryClient,
  weekKey: WeekKey,
  studentId: number,
  date: string,
  absent: boolean,
) {
  const same = (a: DiaryWeek['absences'][number]) => a.schueler_id === studentId && a.date === date;
  return weekAction(
    queryClient,
    weekKey,
    (week) => ({
      ...week,
      absences: absent
        ? [...week.absences.filter((a) => !same(a)), { schueler_id: studentId, date }]
        : week.absences.filter((a) => !same(a)),
    }),
    {
      method: 'PUT',
      path: '/paed-diary/absences',
      body: { schueler_id: studentId, date, absent },
      label: absent ? 'Abwesenheit eintragen' : 'Abwesenheit aufheben',
      meta: { studentIds: [studentId] },
    },
  );
}

/** Tagespause für die ganze Klasse/Lerngruppe (z. B. Wandertag). */
export function setDayPause(
  queryClient: QueryClient,
  weekKey: WeekKey,
  scope: { class_id: number } | { group_id: number },
  classIds: number[],
  date: string,
  paused: boolean,
  reason?: string,
) {
  return weekAction(
    queryClient,
    weekKey,
    (week) => ({
      ...week,
      day_pauses: [
        ...week.day_pauses.filter((p) => p.date !== date || !classIds.includes(p.class_id)),
        ...(paused ? classIds.map((id) => ({ class_id: id, date, reason: reason || 'Veranstaltung' })) : []),
      ],
    }),
    {
      method: 'PUT',
      path: '/paed-diary/day-pauses',
      body: { ...scope, date, paused, reason },
      label: paused ? `Tagespause · ${reason || 'Veranstaltung'}` : 'Tagespause aufheben',
    },
  );
}

export function setColumnValue(
  queryClient: QueryClient,
  weekKey: WeekKey,
  columnId: number,
  studentId: number,
  date: string,
  value: string | null,
) {
  const same = (v: DiaryWeek['column_values'][number]) =>
    v.column_id === columnId && v.schueler_id === studentId && v.date === date;
  return weekAction(
    queryClient,
    weekKey,
    (week) => ({
      ...week,
      column_values: [
        ...week.column_values.filter((v) => !same(v)),
        { column_id: columnId, schueler_id: studentId, date, value },
      ],
    }),
    {
      method: 'PUT',
      path: '/paed-diary/column-values',
      body: { column_id: columnId, schueler_id: studentId, date, value },
      label: 'Spalte abhaken',
      meta: { studentIds: [studentId] },
    },
  );
}

export function closeTask(queryClient: QueryClient, weekKey: WeekKey, taskId: number, studentId: number) {
  return weekAction(queryClient, weekKey, (week) => ({ ...week, tasks: week.tasks.filter((t) => t.id !== taskId) }), {
    method: 'POST',
    path: `/paed-diary/tasks/${taskId}/close`,
    label: 'Aufgabe erledigt',
    meta: { studentIds: [studentId] },
  });
}

/**
 * Wiedervorlage: Notiz an allen Schultagen von `from` bis zum Vortag von `resumeOn` ausblenden
 * (`resumeOn = null` hebt auf). Ohne `studentId` für alle Schüler der Notiz.
 */
export function setResubmission(
  queryClient: QueryClient,
  weekKey: WeekKey,
  entry: WeekEntry,
  studentId: number | null,
  from: string,
  resumeOn: string | null,
) {
  const students = studentId ? [studentId] : entry.schueler_ids;
  const dates: string[] = [];
  for (let d = from; resumeOn && d < resumeOn; d = addDays(d, 1)) {
    if (![0, 6].includes(parseIsoDate(d).getDay())) dates.push(d);
  }
  const isOld = (p: DiaryWeek['pauses'][number]) =>
    p.entry_id === entry.id && students.includes(p.schueler_id) && p.date >= from && p.reason === RESUBMISSION_REASON;
  return weekAction(
    queryClient,
    weekKey,
    (week) => ({
      ...week,
      pauses: [
        ...week.pauses.filter((p) => !isOld(p)),
        ...dates.flatMap((date) =>
          students.map((id) => ({ entry_id: entry.id, schueler_id: id, date, reason: RESUBMISSION_REASON })),
        ),
      ],
    }),
    {
      method: 'PUT',
      path: `/paed-diary/entries/${entry.id}/resubmission`,
      body: { from, resume_on: resumeOn, schueler_id: studentId ?? undefined },
      label: resumeOn ? 'Wiedervorlage' : 'Wiedervorlage aufheben',
      meta: { studentIds: students, entryId: entry.id },
    },
  );
}

// ---------------------------------------------------------------- Aufgaben & Termine

export function createTasks(students: { id: number; name: string }[], input: TaskInput) {
  const ids = students.map((s) => s.id);
  return sendViaOutbox<{ data: DiaryTask[] }>({
    kind: 'diary',
    method: 'POST',
    path: '/paed-diary/tasks',
    body: { schueler_ids: ids, ...input },
    label: students.length === 1 ? `Aufgabe · ${students[0].name}` : `Aufgabe · ${students.length} Schüler`,
    meta: { studentIds: ids },
    invalidate: [queryKeys.diaryWeeks],
  });
}

export function updateTask(taskId: number, input: TaskInput) {
  return sendViaOutbox<{ data: DiaryTask }>({
    kind: 'diary',
    method: 'PUT',
    path: `/paed-diary/tasks/${taskId}`,
    body: input,
    label: 'Aufgabe ändern',
    invalidate: [queryKeys.diaryWeeks],
  });
}

export function createAppointment(input: AppointmentInput) {
  return sendViaOutbox<{ data: Appointment }>({
    kind: 'diary',
    method: 'POST',
    path: '/paed-diary/appointments',
    body: input,
    label: `Termin · ${input.title}`,
    meta: { studentIds: input.schueler_ids },
    invalidate: [queryKeys.diaryWeeks],
  });
}

export function updateAppointment(id: number, input: AppointmentInput) {
  return sendViaOutbox<{ data: Appointment }>({
    kind: 'diary',
    method: 'PUT',
    path: `/paed-diary/appointments/${id}`,
    body: input,
    label: `Termin ändern · ${input.title}`,
    meta: { studentIds: input.schueler_ids },
    invalidate: [queryKeys.diaryWeeks],
  });
}

/** Termin löschen: ganz oder (Serie) nur ein Vorkommen bzw. ab einem Vorkommen. */
export function deleteAppointment(id: number, mode: 'all' | 'only_this' | 'this_and_future' = 'all', date?: string) {
  const query = mode === 'all' ? '' : `?mode=${mode}&date=${date}`;
  return sendViaOutbox<void>({
    kind: 'diary',
    method: 'DELETE',
    path: `/paed-diary/appointments/${id}${query}`,
    label: 'Termin löschen',
    invalidate: [queryKeys.diaryWeeks],
  });
}

/** Schüler zu einem Eintrag hinzufügen bzw. daraus entfernen (nur Schüler der Klasse des Eintrags). */
export function setEntryStudent(entry: DiaryEntry, studentId: number, attached: boolean) {
  return sendViaOutbox<{ data: { entry_id: number; schueler_ids: number[]; updated_at: string } }>({
    kind: 'diary',
    method: attached ? 'PUT' : 'DELETE',
    path: `/paed-diary/entries/${entry.id}/students/${studentId}`,
    label: attached ? 'Schüler hinzufügen' : 'Schüler entfernen',
    meta: { studentIds: [studentId], entryId: entry.id },
    invalidate: [...studentKeys([...entry.schueler_ids, studentId]), queryKeys.diaryWeeks, ['diary-entry', entry.id]],
  });
}

// ---------------------------------------------------------------- Graduierung

/** Antworten sofort im Cache anzeigen (optimistisch), dann speichern. */
export function saveGradingAnswers(
  queryClient: QueryClient,
  sessionId: number,
  studentId: number,
  answers: GradingAnswerInput[],
) {
  queryClient.setQueryData<GradingSessionResponse>(queryKeys.gradingSession(sessionId), (prev) => {
    if (!prev) return prev;
    const next = [...prev.data.answers];
    for (const a of answers) {
      const idx = next.findIndex((x) => x.schueler_id === studentId && x.question_id === a.question_id);
      const base =
        idx >= 0
          ? next[idx]
          : {
              schueler_id: studentId,
              question_id: a.question_id,
              rating_value: null,
              self_rating: null,
              comment: null,
              assessed_at: null,
            };
      const merged = {
        ...base,
        ...(a.rating_value !== undefined ? { rating_value: a.rating_value } : {}),
        ...(a.self_rating !== undefined ? { self_rating: a.self_rating } : {}),
        ...(a.comment !== undefined ? { comment: a.comment } : {}),
      };
      if (idx >= 0) next[idx] = merged;
      else next.push(merged);
    }
    return { ...prev, data: { ...prev.data, answers: next } };
  });

  return sendViaOutbox({
    kind: 'grading',
    method: 'POST',
    path: `/grading/sessions/${sessionId}/assessments`,
    body: { schueler_id: studentId, answers },
    label: 'Graduierung · Bewertung',
    meta: { sessionId, studentId },
    // Kein sofortiges Neuladen der Session (würde optimistische Werte flackern lassen).
    invalidate: [],
  });
}

export function finalizeGradingStudent(
  sessionId: number,
  studentId: number,
  input: { teacher_assessment: string | null; grading_stage_id?: number | null },
) {
  return sendViaOutbox<GradingSessionResponse>({
    kind: 'grading',
    method: 'POST',
    path: `/grading/sessions/${sessionId}/assessments`,
    body: { schueler_id: studentId, finalize: true, ...input },
    label: 'Graduierung · Abschluss',
    meta: { sessionId, studentId },
    invalidate: [queryKeys.gradingSession(sessionId), queryKeys.student(studentId), queryKeys.classes],
  });
}

// ---------------------------------------------------------------- Diagnose

export function saveDiagnosticSession(input: DiagnosticSessionInput, areaTitle: string) {
  return sendViaOutbox<{ data: DiagnosticSession }>({
    kind: 'diagnostic',
    method: 'POST',
    path: '/diagnostic/sessions',
    body: input,
    label: `Diagnose · ${areaTitle}${input.complete ? '' : ' (Zwischenstand)'}`,
    meta: { studentIds: [input.schueler_id] },
    invalidate: [queryKeys.student(input.schueler_id), queryKeys.classes],
  });
}

export function updateGoal(
  goal: DevelopmentGoalFull,
  patch: {
    status?: Exclude<GoalStatus, 'archived'>;
    title?: string;
    target_date?: string | null;
    completion_notes?: string | null;
  },
) {
  return sendViaOutbox<{ data: DevelopmentGoalFull }>({
    kind: 'diagnostic',
    method: 'PUT',
    path: `/diagnostic/goals/${goal.id}`,
    body: { ...patch, expected_updated_at: goal.updated_at },
    label: `Ziel · ${goal.title.slice(0, 40)}`,
    meta: { studentIds: [goal.schueler_id] },
    invalidate: [queryKeys.student(goal.schueler_id), queryKeys.classes],
  });
}

export function archiveGoal(goal: DevelopmentGoalFull) {
  return sendViaOutbox({
    kind: 'diagnostic',
    method: 'DELETE',
    path: `/diagnostic/goals/${goal.id}`,
    label: `Ziel archivieren · ${goal.title.slice(0, 40)}`,
    meta: { studentIds: [goal.schueler_id] },
    invalidate: [queryKeys.student(goal.schueler_id), queryKeys.classes],
  });
}
