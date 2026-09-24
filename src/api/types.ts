/**
 * Typen gemäß `mitarbeiter.local/resources/api-docs/openapi-v1.yaml`.
 * Nur was die App bereits nutzt – bei neuen Endpunkten hier ergänzen.
 */

export type InstanceInfo = {
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  api_version: string | null;
  min_app_version: string | null;
  auth: { password: boolean; sso: boolean; sso_label?: string | null };
  /** true, wenn der Server `GET /instance` (Backend-Aufgabe B1) noch nicht kennt. */
  legacy?: boolean;
};

export type Permissions = {
  view_diagnostics: boolean;
  manage_grading: boolean;
  view_all_students: boolean;
  view_confidential_entries: boolean;
};

export type CurrentUser = {
  id: number;
  name: string;
  email: string;
  permissions: Permissions;
};

export type TokenResponse = {
  token_type: 'Bearer';
  access_token: string;
  expires_at: string | null;
  user: CurrentUser;
};

export type SchoolClass = {
  id: number;
  name: string;
  short_name: string | null;
  color: string | null;
  school_year: string;
  grading_system_id: number | null;
  students_count: number;
};

export type LearningGroup = {
  id: number;
  name: string;
  class_ids: number[];
};

export type ClassesResponse = {
  data: SchoolClass[];
  learning_groups: LearningGroup[];
};

export type ClassStudent = {
  id: number;
  firstname: string;
  lastname: string;
  current_grading: {
    stage_id: number;
    stage_title: string;
    symbol: string | null;
    badge_url: string | null;
  } | null;
  active_diagnostic_goals_count?: number;
  recent_diary_entries_count: number;
};

export type ClassStudentsResponse = {
  data: ClassStudent[];
  meta: { class: { id: number; name: string }; recent_days: number };
};

export type CurrentStage = {
  id: number;
  title: string;
  level: number;
  symbol: string | null;
  badge_image_url: string | null;
  achieved_at: string | null;
} | null;

export type DiaryEntry = {
  id: number;
  class_id: number;
  schueler_ids: number[];
  category_id: number | null;
  category_name: string | null;
  category_color: string | null;
  entry_date: string;
  content: string;
  is_dossier_only: boolean;
  is_completed: boolean;
  completed_at: string | null;
  created_by_id: number;
  created_by_name: string;
  is_own: boolean;
  created_at: string;
  updated_at: string;
  /** Nur im Klassen-Feed: Schüler des Eintrags (Vorname + Initial). */
  students?: { id: number; firstname: string; lastname_initial: string | null }[];
};

export type DevelopmentGoal = {
  id: number;
  title: string;
  area_title: string | null;
  target_date: string | null;
  status: 'open' | 'in_progress' | 'achieved' | 'not_achieved' | 'archived';
  is_active: boolean;
};

export type StudentView = {
  student: {
    id: number;
    firstname: string;
    lastname: string;
    class_id: number;
    class_name: string;
    date_of_birth: string | null;
  };
  grading_overview: {
    grading_system: { id: number; name: string } | null;
    current_stage: CurrentStage;
    has_open_session: boolean;
    open_session_id: number | null;
    open_session_is_own: boolean;
  };
  diagnostic_overview: {
    active_goals_count: number;
    active_goals: DevelopmentGoal[];
    last_assessment_date: string | null;
  } | null;
  recent_paed_diary_entries: DiaryEntry[];
  permissions: {
    can_edit: boolean;
    can_view_diagnostics: boolean;
    can_change_grading_stage: boolean;
    can_view_confidential_entries: boolean;
  };
};

// ---------------------------------------------------------------- Tagebuch

export type DiaryCategory = {
  id: number;
  name: string;
  color: string | null;
  is_global: boolean;
  is_hidden: boolean;
};

export type Paginated<T> = {
  data: T[];
  links: { next: string | null; prev: string | null };
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    /** Nur bei Volltextsuche: verwendete Suchwörter bzw. ob ältere Einträge nicht durchsucht wurden. */
    search_terms?: string[];
    search_truncated?: boolean;
  };
};

export type DiaryEntryInput = {
  category_id: number | null;
  entry_date: string;
  content: string;
  is_dossier_only: boolean;
  is_completed: boolean;
};

// ---------------------------------------------------------------- Graduierung

export type GradingStage = {
  id: number;
  grading_system_id: number;
  title: string;
  slug: string;
  symbol: string | null;
  level: number;
  is_default: boolean;
  badge_image_url: string | null;
};

export type StageHistoryItem = {
  id: number;
  changed_at: string;
  stage_id: number | null;
  stage_title: string | null;
  stage_badge_url: string | null;
  previous_stage_id: number | null;
  previous_stage_title: string | null;
  changed_by_name: string | null;
  paed_diary_entry_id: number | null;
};

export type AnswerOrderMode = 'by_student' | 'by_question';

export type GradingQuestion = { id: number; question: string; sort_order: number };

export type GradingAnswer = {
  schueler_id: number;
  question_id: number;
  rating_value: number | null;
  self_rating: number | null;
  comment: string | null;
  assessed_at: string | null;
};

export type GradingSession = {
  id: number;
  type: 'individual' | 'group';
  answer_order_mode: AnswerOrderMode;
  class_id: number;
  schueler_id: number | null;
  group_id?: number | null;
  grading_system: { id: number; name: string };
  created_by_id: number;
  created_by_name: string;
  is_owner: boolean;
  started_at: string;
  completed_at: string | null;
  is_completed: boolean;
  /** Fehlen in Listen (z. B. Historie), wenn das Backend die Relation nicht lädt. */
  questions: GradingQuestion[];
  answers: GradingAnswer[];
  teacher_assessments?: { schueler_id: number; note: string; noted_at: string }[];
};

export type SessionStudent = {
  id: number;
  firstname: string;
  lastname_initial: string | null;
  finalized: boolean;
  finalized_at: string | null;
};

export type GradingSessionResponse = {
  data: GradingSession;
  meta: {
    resumed?: boolean;
    available_stages: GradingStage[];
    students: SessionStudent[];
    current_question_id: number | null;
    finalized?: boolean;
    session_completed?: boolean;
    current_stage?: CurrentStage;
  };
};

export type GradingSessionListItem = {
  id: number;
  type: 'individual' | 'group';
  answer_order_mode: AnswerOrderMode;
  class_id: number;
  schueler_id: number | null;
  schueler_name: string | null;
  group_id: number | null;
  grading_system: { id: number; name: string };
  created_by_id: number;
  created_by_name: string;
  is_owner: boolean;
  started_at: string;
  completed_at: string | null;
  is_completed: boolean;
  progress: { answered: number; total: number; students_total: number; students_finalized: number };
};

export type GradingHistory = {
  current_stage: CurrentStage;
  stage_history: StageHistoryItem[];
  completed_sessions: GradingSession[];
};

export type GradingAnswerInput = {
  question_id: number;
  rating_value?: number | null;
  self_rating?: number | null;
  comment?: string | null;
};

export type JoinCode = {
  schueler_id: number;
  firstname: string;
  code: string;
  qr_payload: string;
  expires_at: string;
};

// ---------------------------------------------------------------- Schüler-iPad

export type StudentJoinResponse = {
  token: string;
  expires_at: string;
  student: { firstname: string };
  session: { id: number; answer_order_mode: AnswerOrderMode };
};

export type StudentSession = {
  session: { id: number; answer_order_mode: AnswerOrderMode; current_question_id: number | null };
  student: { firstname: string };
  questions: GradingQuestion[];
  self_ratings: { question_id: number; self_rating: number }[];
  waiting: boolean;
};

// ---------------------------------------------------------------- Diagnose

export type DiagnosticRating = 'white' | 'gray' | 'dark_gray';

export type DiagnosticCriterion = { id: number; code: string; description: string; sort_order: number };

export type DiagnosticStage = {
  id: number;
  title: string;
  code: string;
  goal_description: string | null;
  sort_order: number;
  criteria: DiagnosticCriterion[];
};

export type DiagnosticArea = {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  sort_order: number;
  stages: DiagnosticStage[];
};

export type GoalStatus = 'open' | 'in_progress' | 'achieved' | 'not_achieved' | 'archived';

export type DevelopmentGoalFull = {
  id: number;
  schueler_id: number;
  diagnostic_session_id: number | null;
  area_id: number | null;
  area_title: string | null;
  stage_id: number | null;
  criterion_id: number | null;
  title: string;
  target_date: string | null;
  status: GoalStatus;
  is_active: boolean;
  completion_notes: string | null;
  completed_at: string | null;
  archived_at: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
};

export type CurrentCriterionGoal = {
  assessment_id: number;
  criterion_id: number;
  code: string;
  description: string;
  stage_title: string;
  area_id: number;
  area_title: string;
  rating: DiagnosticRating | null;
  session_id: number;
  session_date: string;
};

export type DiagnosticSession = {
  id: number;
  schueler_id: number;
  area_id: number;
  area_title: string;
  session_date: string;
  is_completed: boolean;
  completed_at: string | null;
  notes: string | null;
  created_by_name: string | null;
  stage_notes: { stage_id: number; stage_title: string; notes: string }[];
  assessments: { criterion_id: number; rating: DiagnosticRating | null; is_current_goal: boolean }[];
  rating_summary: { white: number; gray: number; dark_gray: number; total: number };
  development_goals: DevelopmentGoalFull[];
};

export type DiagnosticHistory = {
  sessions: DiagnosticSession[];
  development_goals: DevelopmentGoalFull[];
  current_criterion_goals: CurrentCriterionGoal[];
};

export type DiagnosticSessionInput = {
  schueler_id: number;
  area_id: number;
  stage_id?: number | null;
  session_date?: string;
  assessment_notes?: string | null;
  complete: boolean;
  assessments?: { criterion_id: number; rating: DiagnosticRating | null; is_current_goal?: boolean }[];
  goals?: { title: string; target_date: string | null; criterion_id: number | null }[];
};

// ---------------------------------------------------------------- Dossier & Geräte

export type Dossier = {
  student: { id: number; firstname: string; lastname: string; class_name?: string };
  period: { from_date: string; to_date: string };
  paed_diary: {
    entries_count: number;
    by_category: { category_id: number | null; category_name: string; category_color: string | null; count: number }[];
    entries: DiaryEntry[];
  };
  grading: GradingHistory;
  diagnostic: DiagnosticHistory | null;
  meta: { generated_at: string; generated_by: string; includes_confidential: boolean; includes_diagnostics: boolean };
};

export type Device = {
  id: number;
  device_name: string;
  last_used_at: string | null;
  created_at: string;
  expires_at: string | null;
  is_current: boolean;
};

// ---------------------------------------------------------------- Wochenansicht (Kalender)

export type WeekColumnType = 'boolean' | 'ampel' | 'text';

export type WeekEntry = {
  id: number;
  class_id: number;
  schueler_ids: number[];
  entry_date: string;
  content: string;
  category_id: number | null;
  category_name: string | null;
  category_color: string | null;
  created_by_name: string | null;
  is_own: boolean;
  is_completed: boolean;
  completed_at: string | null;
};

export type WeekStudent = {
  id: number;
  firstname: string;
  lastname: string;
  class_id: number;
  current_grading: ClassStudent['current_grading'];
  absence_alerts: { type: string | null; label: string; severity: string; summary: string }[];
};

export type WeekAppointment = {
  id: number;
  title: string;
  description: string | null;
  date: string;
  start_time: string | null;
  end_time: string | null;
  is_recurring: boolean;
  recurring_type?: 'daily' | 'weekly' | 'monthly' | null;
  pause_entries?: boolean;
  /** Selbst angelegt. */
  is_own?: boolean;
  class_ids: number[];
  group_ids: number[];
  schueler_ids: number[];
};

export type WeekPause = {
  entry_id: number;
  schueler_id: number;
  date: string;
  /** z. B. „Ferien“, „Termin“, „Wiedervorlage“; null = einzeln pausiert. */
  reason?: string | null;
};

export type DiaryWeek = {
  week_start: string;
  week_end: string;
  group: { id: number; name: string } | null;
  classes: { id: number; name: string; short_name: string | null; color: string | null }[];
  days: { date: string; is_holiday: boolean; holiday_name: string | null }[];
  students: WeekStudent[];
  entries: WeekEntry[];
  pauses: WeekPause[];
  absences: { schueler_id: number; date: string }[];
  day_pauses: { class_id: number; date: string; reason: string }[];
  columns: { id: number; class_id: number; name: string; type: WeekColumnType; category: string | null }[];
  column_values: { column_id: number; schueler_id: number; date: string; value: string | null }[];
  tasks: {
    id: number;
    schueler_id: number;
    title: string;
    description: string | null;
    due_date: string | null;
    highlighted: boolean;
  }[];
  appointments: WeekAppointment[];
  hidden_category_ids: number[];
};

/** Klasse oder Lerngruppe, für die die Wochenansicht geladen wird. */
export type WeekScope = { classId: number } | { groupId: number };

/** Grund der Pausen, die eine Wiedervorlage anlegt. */
export const RESUBMISSION_REASON = 'Wiedervorlage';

// ---------------------------------------------------------------- Planung (Aufgaben, Termine)

export type DiaryTask = {
  id: number;
  schueler_id: number;
  klasse_id: number;
  title: string;
  description: string | null;
  due_date: string | null;
  highlighted: boolean;
  status: 'open' | 'closed';
};

export type TaskInput = {
  title: string;
  description: string | null;
  due_date: string | null;
  highlighted: boolean;
};

export type AppointmentInput = {
  title: string;
  description: string | null;
  start_date: string;
  start_time: string | null;
  end_time: string | null;
  is_recurring: boolean;
  recurring_type: 'daily' | 'weekly' | 'monthly' | null;
  pause_entries: boolean;
  class_ids: number[];
  group_ids: number[];
  schueler_ids: number[];
};

export type Appointment = AppointmentInput & {
  id: number;
  recurring_interval: number;
  recurring_end_date: string | null;
  is_own: boolean;
};

// ---------------------------------------------------------------- Klassenübersichten

export type StudentBrief = { id: number; firstname: string; lastname: string };

export type GradingOverview = {
  class: { id: number; name: string };
  grading_system: { id: number; name: string } | null;
  students_total: number;
  open_sessions_count: number;
  stages: {
    id: number;
    title: string;
    level: number;
    symbol: string | null;
    badge_image_url: string | null;
    count: number;
    students: StudentBrief[];
  }[];
  other_stages: (StudentBrief & { stage_title: string })[];
  without_stage: StudentBrief[];
};

export type DiagnosticCriterionOverview = {
  criterion_id: number;
  code: string;
  description: string;
  stage_id: number | null;
  stage_title: string | null;
  area_id: number | null;
  area_title: string | null;
  counts: { white: number; gray: number; dark_gray: number; assessed: number };
  students_not_yet: (StudentBrief & { assessed_on: string | null })[];
  students_partial: (StudentBrief & { assessed_on: string | null })[];
};

export type DiagnosticClassOverview = {
  class: { id: number; name: string };
  students_total: number;
  assessed_students: number;
  areas: { id: number; title: string }[];
  criteria: DiagnosticCriterionOverview[];
};
