import type { DiaryWeek, WeekAppointment, WeekEntry, WeekStudent } from '@/api/types';

/**
 * Auswertung der Wochendaten – gleiche Regeln wie die Web-Wochenansicht:
 * - Abgeschlossene Einträge erscheinen nur an ihrem Datum.
 * - Offene Notizen erscheinen bei ihren Schülern an jedem Tag ab Startdatum,
 *   außer an pausierten Tagen (Pause, Abwesenheit, Ferien, Tagespause).
 * - Einträge ausgeblendeter Kategorien werden nicht angezeigt.
 */
export class WeekIndex {
  private pauses = new Set<string>();
  private absences = new Set<string>();
  private values = new Map<string, string | null>();
  private hidden: Set<number>;

  constructor(readonly week: DiaryWeek) {
    week.pauses.forEach((p) => this.pauses.add(`${p.entry_id}|${p.schueler_id}|${p.date}`));
    week.absences.forEach((a) => this.absences.add(`${a.schueler_id}|${a.date}`));
    week.column_values.forEach((v) => this.values.set(`${v.column_id}|${v.schueler_id}|${v.date}`, v.value));
    this.hidden = new Set(week.hidden_category_ids);
  }

  isPaused(entryId: number, studentId: number, date: string) {
    return this.pauses.has(`${entryId}|${studentId}|${date}`);
  }

  isAbsent(studentId: number, date: string) {
    return this.absences.has(`${studentId}|${date}`);
  }

  private visibleFor(e: WeekEntry, studentId: number) {
    return e.schueler_ids.includes(studentId) && !(e.category_id && this.hidden.has(e.category_id));
  }

  /** Sichtbare Einträge einer Zelle, sortiert nach Kategorie (ohne Kategorie zuletzt). */
  entriesForCell(studentId: number, date: string): WeekEntry[] {
    return this.week.entries
      .filter((e) => {
        if (!this.visibleFor(e, studentId) || this.isPaused(e.id, studentId, date)) return false;
        return e.is_completed ? e.entry_date === date : e.entry_date <= date;
      })
      .sort((a, b) => {
        const ca = (a.category_name ?? '').toLowerCase();
        const cb = (b.category_name ?? '').toLowerCase();
        if (ca === cb) return a.id - b.id;
        if (!ca) return 1;
        if (!cb) return -1;
        return ca.localeCompare(cb, 'de');
      });
  }

  /** Offene Notizen, die an diesem Tag pausiert sind. */
  pausedForCell(studentId: number, date: string): WeekEntry[] {
    return this.week.entries.filter(
      (e) =>
        !e.is_completed &&
        e.entry_date <= date &&
        this.visibleFor(e, studentId) &&
        this.isPaused(e.id, studentId, date),
    );
  }

  /** Alle offenen Notizen eines Schülers (Namensspalte im Web). */
  openEntriesFor(studentId: number): WeekEntry[] {
    return this.week.entries.filter((e) => !e.is_completed && this.visibleFor(e, studentId));
  }

  tasksFor(studentId: number) {
    return this.week.tasks.filter((t) => t.schueler_id === studentId);
  }

  columnsFor(student: WeekStudent) {
    return this.week.columns.filter((c) => c.class_id === student.class_id);
  }

  columnValue(columnId: number, studentId: number, date: string) {
    return this.values.get(`${columnId}|${studentId}|${date}`) ?? '';
  }

  /** Tagespause der Klasse des Schülers bzw. (ohne Schüler) irgendeiner geladenen Klasse. */
  dayPause(date: string, classId?: number) {
    return this.week.day_pauses.find((p) => p.date === date && (classId === undefined || p.class_id === classId));
  }

  /** Klassen-/Gruppentermine für den Tageskopf. */
  headerAppointments(date: string): WeekAppointment[] {
    return this.week.appointments.filter((a) => a.date === date && !isStudentOnly(a));
  }

  /** Termine, die nur einzelne Schüler betreffen. */
  studentAppointments(studentId: number, date: string): WeekAppointment[] {
    return this.week.appointments.filter(
      (a) => a.date === date && isStudentOnly(a) && a.schueler_ids.includes(studentId),
    );
  }
}

const isStudentOnly = (a: WeekAppointment) =>
  a.schueler_ids.length > 0 && a.class_ids.length === 0 && a.group_ids.length === 0;

export function appointmentLabel(a: WeekAppointment) {
  const time = a.start_time ? `${a.start_time}${a.end_time ? `–${a.end_time}` : ''} ` : '';
  return `${time}${a.title}`;
}

/** Ampel-Spalte: leer → ja → in Bearbeitung → nein → leer */
export const AMPEL_ORDER = ['', '1', '2', '3'] as const;

export function nextColumnValue(type: 'boolean' | 'ampel', current: string): string | null {
  if (type === 'boolean') return current === '1' ? null : '1';
  const idx = AMPEL_ORDER.indexOf(current as (typeof AMPEL_ORDER)[number]);
  const next = AMPEL_ORDER[(idx + 1) % AMPEL_ORDER.length];
  return next === '' ? null : next;
}

export const AMPEL_LABELS: Record<string, string> = {
  '': 'offen',
  '1': 'ja',
  '2': 'in Bearbeitung',
  '3': 'nein',
};
