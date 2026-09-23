import type { GradingAnswer, GradingSessionResponse, SessionStudent } from '@/api/types';

/** Hilfsfunktionen rund um eine Graduierungs-Session. */

export function participants(response: GradingSessionResponse): SessionStudent[] {
  if (response.meta.students?.length) return response.meta.students;
  const id = response.data.schueler_id;
  return id
    ? [{ id, firstname: 'Schüler', lastname_initial: null, finalized: response.data.is_completed, finalized_at: null }]
    : [];
}

export const displayName = (s: SessionStudent) => `${s.firstname}${s.lastname_initial ? ` ${s.lastname_initial}` : ''}`;

export function answerFor(
  response: GradingSessionResponse,
  studentId: number,
  questionId: number,
): GradingAnswer | undefined {
  return response.data.answers.find((a) => a.schueler_id === studentId && a.question_id === questionId);
}

export function studentProgress(response: GradingSessionResponse, studentId: number) {
  const answers = response.data.answers.filter((a) => a.schueler_id === studentId);
  return {
    rated: answers.filter((a) => a.rating_value !== null).length,
    self: answers.filter((a) => a.self_rating !== null).length,
    total: response.data.questions.length,
  };
}

export const sortedQuestions = (response: GradingSessionResponse) =>
  [...response.data.questions].sort((a, b) => a.sort_order - b.sort_order);
