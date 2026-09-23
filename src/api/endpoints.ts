import { api, ApiError } from './client';
import type {
  AnswerOrderMode,
  ClassesResponse,
  ClassStudentsResponse,
  CurrentUser,
  Device,
  DiagnosticArea,
  DiagnosticHistory,
  DiaryCategory,
  DiaryEntry,
  Dossier,
  GradingHistory,
  GradingSessionListItem,
  GradingSessionResponse,
  GradingStage,
  InstanceInfo,
  JoinCode,
  Paginated,
  StudentJoinResponse,
  StudentSession,
  StudentView,
  TokenResponse,
} from './types';

/**
 * Instanz-Info der Schule. Kennt der Server `GET /instance` noch nicht (Backend-Aufgabe B1),
 * prüfen wir über `GET /auth/me` (erwartet 401 als JSON), ob dort eine kompatible API läuft.
 */
export async function fetchInstance(serverUrl: string): Promise<InstanceInfo> {
  try {
    return await api.get<InstanceInfo>('/instance', { serverUrl, anonymous: true });
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404) throw error;
  }

  try {
    await api.get('/auth/me', { serverUrl, anonymous: true });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401 && error.body) {
      return {
        name: serverUrl.replace(/^https?:\/\//, ''),
        logo_url: null,
        primary_color: null,
        api_version: null,
        min_app_version: null,
        auth: { password: true, sso: false },
        legacy: true,
      };
    }
  }
  throw new ApiError('Unter dieser Adresse wurde kein kompatibler Server gefunden.', 404);
}

export const loginWithPassword = (serverUrl: string, email: string, password: string, deviceName: string) =>
  api.post<TokenResponse>('/auth/token', { email, password, device_name: deviceName }, { serverUrl, anonymous: true });

/** Backend-Aufgabe B2 */
export const exchangeSsoCode = (serverUrl: string, code: string, codeVerifier: string, deviceName: string) =>
  api.post<TokenResponse>(
    '/auth/sso/exchange',
    { code, code_verifier: codeVerifier, device_name: deviceName },
    { serverUrl, anonymous: true },
  );

export const revokeToken = () => api.del<void>('/auth/token');

export const fetchMe = () => api.get<{ data: CurrentUser }>('/auth/me').then((r) => r.data);

export const fetchClasses = (all = false) => api.get<ClassesResponse>('/classes', { query: { all: all || undefined } });

export const fetchClassStudents = (classId: number, recentDays = 14) =>
  api.get<ClassStudentsResponse>(`/classes/${classId}/students`, { query: { recent_days: recentDays } });

export const fetchStudentView = (studentId: number, diaryLimit = 10) =>
  api.get<StudentView>(`/students/${studentId}/view`, { query: { diary_limit: diaryLimit } });

// ---------------------------------------------------------------- Geräte

export const fetchDevices = () => api.get<{ data: Device[] }>('/auth/devices').then((r) => r.data);
export const deleteDevice = (id: number) => api.del<void>(`/auth/devices/${id}`);

// ---------------------------------------------------------------- Tagebuch

export const fetchDiaryCategories = () =>
  api.get<{ data: DiaryCategory[] }>('/paed-diary/categories').then((r) => r.data);

export const fetchDiaryEntries = (
  studentId: number,
  params: { page?: number; per_page?: number; category_id?: number | null; from_date?: string; to_date?: string },
) => api.get<Paginated<DiaryEntry>>(`/students/${studentId}/paed-diary/entries`, { query: params });

export const fetchDiaryEntry = (id: number) =>
  api.get<{ data: DiaryEntry }>(`/paed-diary/entries/${id}`).then((r) => r.data);

// ---------------------------------------------------------------- Graduierung

export const fetchGradingStages = (params: { class_id?: number; grading_system_id?: number }) =>
  api.get<{ data: GradingStage[] }>('/grading/stages', { query: params }).then((r) => r.data);

export const fetchGradingHistory = (studentId: number) =>
  api.get<{ data: GradingHistory }>(`/students/${studentId}/grading/history`).then((r) => r.data);

export const fetchClassGradingSessions = (
  classId: number,
  params: { status?: 'open' | 'completed'; type?: 'group' | 'individual'; mine?: boolean },
) => api.get<Paginated<GradingSessionListItem>>(`/classes/${classId}/grading/sessions`, { query: params });

export const startIndividualSession = (studentId: number) =>
  api.post<GradingSessionResponse>('/grading/sessions', { schueler_id: studentId });

export const startGroupSession = (input: {
  class_id: number;
  schueler_ids?: number[];
  answer_order_mode: AnswerOrderMode;
  group_id?: number | null;
}) => api.post<GradingSessionResponse>('/grading/sessions', { type: 'group', ...input });

export const fetchGradingSession = (sessionId: number) =>
  api.get<GradingSessionResponse>(`/grading/sessions/${sessionId}`);

export const updateAnswerOrderMode = (sessionId: number, mode: AnswerOrderMode) =>
  api.patch<GradingSessionResponse>(`/grading/sessions/${sessionId}`, { answer_order_mode: mode });

export const createJoinCodes = (sessionId: number) =>
  api.post<{ data: JoinCode[] }>(`/grading/sessions/${sessionId}/join-codes`).then((r) => r.data);

export const revokeJoinCodes = (sessionId: number) => api.del<void>(`/grading/sessions/${sessionId}/join-codes`);

export const releaseQuestion = (sessionId: number, questionId: number) =>
  api.post<{ data: { session_id: number; current_question_id: number } }>(
    `/grading/sessions/${sessionId}/current-question`,
    { question_id: questionId },
  );

// ---------------------------------------------------------------- Schüler-iPad (Schüler-Token)

export const joinAsStudent = (serverUrl: string, code: string, deviceName: string) =>
  api.post<StudentJoinResponse>('/student/join', { code, device_name: deviceName }, { serverUrl, anonymous: true });

export const fetchStudentSession = (serverUrl: string, token: string) =>
  api.get<{ data: StudentSession }>('/student/session', { serverUrl, authToken: token }).then((r) => r.data);

export const submitSelfRating = (serverUrl: string, token: string, questionId: number, rating: number) =>
  api.post(
    '/student/session/answers',
    { question_id: questionId, self_rating: rating },
    { serverUrl, authToken: token },
  );

// ---------------------------------------------------------------- Diagnose

export const fetchDiagnosticAreas = () => api.get<{ data: DiagnosticArea[] }>('/diagnostic/areas').then((r) => r.data);

export const fetchDiagnosticHistory = (studentId: number) =>
  api.get<{ data: DiagnosticHistory }>(`/students/${studentId}/diagnostic/history`).then((r) => r.data);

// ---------------------------------------------------------------- Dossier

export type DossierParams = { from_date?: string; to_date?: string; include_confidential?: boolean };

export const fetchDossier = (studentId: number, params: DossierParams) =>
  api.get<Dossier>(`/students/${studentId}/dossier`, { query: params });
