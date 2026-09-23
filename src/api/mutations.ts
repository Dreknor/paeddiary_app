import type { QueryClient } from '@tanstack/react-query';

import { sendViaOutbox, type SendResult } from '@/sync/outbox';

import { queryKeys } from './queries';
import type {
  DevelopmentGoalFull,
  DiagnosticSession,
  DiagnosticSessionInput,
  DiaryEntry,
  DiaryEntryInput,
  GoalStatus,
  GradingAnswerInput,
  GradingSessionResponse,
} from './types';

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
    invalidate: [...studentKeys(ids), queryKeys.classes],
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
    invalidate: studentKeys(entry.schueler_ids),
  });
}

export function deleteDiaryEntry(entry: DiaryEntry) {
  return sendViaOutbox<void>({
    kind: 'diary',
    method: 'DELETE',
    path: `/paed-diary/entries/${entry.id}`,
    label: 'Tagebucheintrag löschen',
    meta: { studentIds: entry.schueler_ids, entryId: entry.id, deleted: true },
    invalidate: [...studentKeys(entry.schueler_ids), queryKeys.classes],
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
