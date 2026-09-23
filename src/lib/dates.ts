/** Datumshilfen. API-Daten sind `YYYY-MM-DD` (lokal) bzw. ISO-8601 mit Zeit. */

const pad = (n: number) => String(n).padStart(2, '0');

export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayIso(): string {
  return toIsoDate(new Date());
}

export function addDays(iso: string, days: number): string {
  const d = parseIsoDate(iso);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

export function addMonths(iso: string, months: number): string {
  const d = parseIsoDate(iso);
  d.setMonth(d.getMonth() + months);
  return toIsoDate(d);
}

/** `YYYY-MM-DD` als lokales Datum (nicht UTC) lesen; akzeptiert auch volle ISO-Zeitstempel. */
export function parseIsoDate(iso: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(iso);
}

const dateFormat = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
const shortFormat = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
const dateTimeFormat = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export const formatDate = (iso: string) => dateFormat.format(parseIsoDate(iso));
export const formatDateTime = (iso: string) => dateTimeFormat.format(new Date(iso));

/** „Heute“, „Gestern“ oder „Mo., 21.09.“ */
export function formatRelativeDay(iso: string): string {
  const today = todayIso();
  if (iso === today) return 'Heute';
  if (iso === addDays(today, -1)) return 'Gestern';
  return shortFormat.format(parseIsoDate(iso));
}

/** Schuljahresbeginn (1. August) des aktuellen Schuljahres. */
export function schoolYearStartIso(reference = new Date()): string {
  const year = reference.getMonth() >= 7 ? reference.getFullYear() : reference.getFullYear() - 1;
  return `${year}-08-01`;
}
