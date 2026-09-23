import type { DiagnosticRating, GoalStatus } from '@/api/types';

/** Bezeichnungen wie im Web (`resources/views/pdf/dossier.blade.php`). */
export const RATINGS: {
  value: DiagnosticRating;
  label: string;
  short: string;
  color: string;
  text: string;
  border: string;
}[] = [
  { value: 'white', label: 'Kann es', short: 'kann', color: '#FFFFFF', text: '#1B2130', border: '#9AA2B1' },
  { value: 'gray', label: 'Aktuelles Ziel', short: 'Ziel', color: '#CCCCCC', text: '#1B2130', border: '#9AA2B1' },
  {
    value: 'dark_gray',
    label: 'Kann es nicht',
    short: 'noch nicht',
    color: '#666666',
    text: '#FFFFFF',
    border: '#666666',
  },
];

export const ratingInfo = (r: DiagnosticRating | null | undefined) => RATINGS.find((x) => x.value === r) ?? null;

/** Tipp-Reihenfolge: leer → weiß → grau → dunkelgrau → leer */
export function nextRating(r: DiagnosticRating | null): DiagnosticRating | null {
  if (r === null) return 'white';
  if (r === 'white') return 'gray';
  if (r === 'gray') return 'dark_gray';
  return null;
}

export const GOAL_STATUS: Record<GoalStatus, { label: string; color: string; background: string }> = {
  open: { label: 'Offen', color: '#5B6475', background: '#EEF0F4' },
  in_progress: { label: 'In Arbeit', color: '#253364', background: '#E8EBF4' },
  achieved: { label: 'Erreicht', color: '#1F7A4D', background: '#E4F3EB' },
  not_achieved: { label: 'Nicht erreicht', color: '#9D1D34', background: '#F7E6E9' },
  archived: { label: 'Archiviert', color: '#9AA2B1', background: '#F7F8FA' },
};
